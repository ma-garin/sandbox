import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, stat, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { extractZip } from '../src/ingest/zip.ts';
import { InputError } from '../src/ingest/index.ts';

interface ZipItem {
  name: string;
  data?: string | Buffer;
  symlink?: boolean;
  dosDir?: boolean;
  /** 名前の生バイト（UTF-8 フラグを立てずに格納する） */
  rawName?: Buffer;
}

/** テスト用の最小 ZIP 書き出し（deflate・データ記述子なし） */
function buildZip(items: ZipItem[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const it of items) {
    const nameBuf = it.rawName ?? Buffer.from(it.name, 'utf8');
    const flags = it.rawName ? 0 : 0x0800;
    const raw = Buffer.isBuffer(it.data) ? it.data : Buffer.from(it.data ?? '', 'utf8');
    const comp = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);
    const mode = it.symlink ? 0o120777 : 0o100644;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(((mode << 16) | (it.dosDir ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(items.length, 8);
  eocd.writeUInt16LE(items.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

async function setup(items: ZipItem[] | Buffer): Promise<{ base: string; zipPath: string; dest: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), 'spec2doc-zip-'));
  const zipPath = path.join(base, 'in.zip');
  await writeFile(zipPath, Buffer.isBuffer(items) ? items : buildZip(items));
  return { base, zipPath, dest: path.join(base, 'out') };
}

async function listAll(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const ents = await readdir(dir, { recursive: true, withFileTypes: true });
  return ents.filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort();
}

test('正常な .zip を展開し、ファイルは読み取り専用になる', async () => {
  const { base, zipPath, dest } = await setup([
    { name: 'a.txt', data: 'hello' },
    { name: 'dir/' },
    { name: 'dir/b.md', data: '# title' },
  ]);
  try {
    const res = await extractZip(zipPath, dest);
    assert.deepEqual(res.rejected, []);
    assert.deepEqual(await listAll(dest), ['a.txt', path.join('dir', 'b.md')]);
    assert.equal(await readFile(path.join(dest, 'dir', 'b.md'), 'utf8'), '# title');
    assert.equal((await stat(path.join(dest, 'a.txt'))).mode & 0o777, 0o444);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('危険な項目（../evil・絶対パス・シンボリックリンク）はその項目だけ拒否し、正常な項目は展開する', async () => {
  const { base, zipPath, dest } = await setup([
    { name: 'ok.txt', data: 'fine' },
    { name: '../evil.txt', data: 'x' },
    { name: '/tmp/spec2doc-abs-evil.txt', data: 'x' },
    { name: 'dir/../../evil2.txt', data: 'x' },
    { name: 'link', data: '/etc/passwd', symlink: true },
    { name: 'sub/ok2.txt', data: 'fine2' },
  ]);
  try {
    const res = await extractZip(zipPath, dest);
    assert.deepEqual(await listAll(dest), ['ok.txt', path.join('sub', 'ok2.txt')]);
    assert.deepEqual(res.rejected.map((r) => r.path), ['../evil.txt', '/tmp/spec2doc-abs-evil.txt', 'dir/../../evil2.txt', 'link']);
    for (const r of res.rejected) assert.match(r.reason, /展開拒否（パス走査/);
    assert.equal(existsSync(path.join(base, 'evil.txt')), false);
    assert.equal(existsSync(path.join(base, 'evil2.txt')), false);
    assert.equal(existsSync('/tmp/spec2doc-abs-evil.txt'), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('合計サイズの上限を超えたら中断し、途中まで書いたものを消す', async () => {
  const { base, zipPath, dest } = await setup([
    { name: 'a.txt', data: 'a'.repeat(60) },
    { name: 'b.txt', data: 'b'.repeat(60) },
  ]);
  try {
    await assert.rejects(extractZip(zipPath, dest, { maxTotalBytes: 100 }), (e: unknown) => e instanceof InputError && /サイズが上限/.test(e.message));
    assert.deepEqual(await listAll(dest), []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('ファイル数の上限を超えたら展開を始めずに InputError', async () => {
  const { base, zipPath, dest } = await setup([
    { name: 'a.txt', data: 'a' },
    { name: 'b.txt', data: 'b' },
    { name: 'c.txt', data: 'c' },
  ]);
  try {
    await assert.rejects(extractZip(zipPath, dest, { maxFiles: 2 }), (e: unknown) => e instanceof InputError && /ファイル数が上限/.test(e.message));
    assert.deepEqual(await listAll(dest), []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('壊れた .zip は InputError', async () => {
  const good = buildZip([{ name: 'a.txt', data: 'hello world' }]);
  const { base, zipPath, dest } = await setup(Buffer.from('this is not a zip file at all, just text'));
  const trunc = path.join(base, 'trunc.zip');
  await writeFile(trunc, good.subarray(0, good.length - 10));
  try {
    await assert.rejects(extractZip(zipPath, dest), (e: unknown) => e instanceof InputError && /読み取れません/.test(e.message));
    await assert.rejects(extractZip(trunc, dest), (e: unknown) => e instanceof InputError);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('Windows 区切り（src\\）のディレクトリ項目でも展開できる（属性あり・なし）', async () => {
  for (const dosDir of [false, true]) {
    const { base, zipPath, dest } = await setup([
      { name: 'src\\', dosDir },
      { name: 'src\\a.js', data: 'x=1' },
      { name: 'src\\..\\..\\evil.txt', data: 'x' },
    ]);
    try {
      const res = await extractZip(zipPath, dest);
      assert.deepEqual(await listAll(dest), [path.join('src', 'a.js')]);
      assert.deepEqual(res.rejected.map((r) => r.path), ['src\\..\\..\\evil.txt']);
      assert.equal(existsSync(path.join(base, 'evil.txt')), false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }
});

test('重複名・ファイルとディレクトリの衝突・「.」はその項目だけ拒否し、文に絶対パスを出さない', async () => {
  const { base, zipPath, dest } = await setup([
    { name: 'a.txt', data: 'first' },
    { name: 'a.txt', data: 'second' },
    { name: 'a', data: 'file' },
    { name: 'a/b.txt', data: 'x' },
    { name: '.', data: 'x' },
    { name: 'ok.txt', data: 'ok' },
  ]);
  try {
    const res = await extractZip(zipPath, dest);
    assert.deepEqual(await listAll(dest), ['a', 'a.txt', 'ok.txt']);
    assert.equal(await readFile(path.join(dest, 'a.txt'), 'utf8'), 'first');
    assert.deepEqual(res.rejected.map((r) => r.path), ['a.txt', 'a/b.txt', '.']);
    for (const r of res.rejected) {
      assert.match(r.reason, /展開拒否/);
      assert.equal(r.reason.includes(base), false);
      assert.equal(r.path.includes(base), false);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('書き込みの失敗（fs のエラー）は絶対パスを含まない InputError になる', async () => {
  const { base, dest } = await setup([{ name: 'a.txt', data: 'x' }]);
  try {
    await assert.rejects(extractZip(path.join(base, 'missing.zip'), dest), (e: unknown) =>
      e instanceof InputError && !e.message.includes(base) && !e.hint.includes(base));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('件数上限はディレクトリを数えない', async () => {
  const { base, zipPath, dest } = await setup([{ name: 'd/' }, { name: 'd/a.txt', data: 'a' }, { name: 'd/b.txt', data: 'b' }]);
  try {
    const res = await extractZip(zipPath, dest, { maxFiles: 2 });
    assert.deepEqual(res.rejected, []);
    assert.equal((await listAll(dest)).length, 2);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('サイズ上限の文は単位を丸めて出す', async () => {
  const { base, zipPath, dest } = await setup([{ name: 'a.txt', data: 'a'.repeat(3 * 1024 * 1024) }]);
  try {
    await assert.rejects(extractZip(zipPath, dest, { maxTotalBytes: 2 * 1024 * 1024 }), (e: unknown) =>
      e instanceof InputError && e.message.includes('上限 2MB'));
    assert.deepEqual(await listAll(dest), []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('UTF-8 フラグ無しの CP932 の名前（仕様書/画面.html）を正しい名前で展開する', async () => {
  // CP932: 仕=8E64 様=976C 書=8F91 画=89E6 面=96CA
  const sjis = Buffer.from('8e64976c8f912f89e696ca2e68746d6c', 'hex');
  const { base, zipPath, dest } = await setup([
    { name: '', rawName: sjis, data: '<p>x</p>' },
    { name: '', rawName: Buffer.from('docs/readme.md', 'utf8'), data: '# r' },
  ]);
  try {
    const res = await extractZip(zipPath, dest);
    assert.deepEqual(res.rejected, []);
    assert.deepEqual(await listAll(dest), [path.join('docs', 'readme.md'), path.join('仕様書', '画面.html')]);
    assert.equal(await readFile(path.join(dest, '仕様書', '画面.html'), 'utf8'), '<p>x</p>');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
