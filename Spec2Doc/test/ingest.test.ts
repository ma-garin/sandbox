// 取得層（zip 以外）: ネットワークに接続しない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingest, InputError } from '../src/ingest/index.ts';
import { createExcluder } from '../src/ingest/exclude.ts';
import { performance } from 'node:perf_hooks';
import { buildGitEnv, buildGitPlan, fetchGithub, parseGithubUrl } from '../src/ingest/github.ts';
import type { GitRunner } from '../src/ingest/github.ts';
import { makeReadOnly } from '../src/ingest/local.ts';

async function makeTree(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'spec2doc-ingest-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, body);
  }
  return root;
}

test('folder: 3 階層を再帰で集め、既定・.gitignore・否定・利用者指定の除外を理由付きで積む', async () => {
  const root = await makeTree({
    'a.js': '',
    'src/b.ts': '',
    'src/deep/c.ts': '',
    'src/deep/keep.log': '',
    'src/deep/x.log': '',
    'app.min.js': '',
    'node_modules/pkg/index.js': '',
    'dist/out.js': '',
    'legacy/old/d.js': '',
    'tmp/e.txt': '',
    '.gitignore': '# comment\n\n*.log\n!keep.log\ntmp/\n',
  });
  await symlink(join(root, 'a.js'), join(root, 'link.js'));
  try {
    const r = await ingest({ kind: 'folder', path: root }, { exclude: ['legacy/**'] });
    assert.deepEqual(
      r.files.map((f) => f.path).sort(),
      ['.gitignore', 'a.js', 'src/b.ts', 'src/deep/c.ts', 'src/deep/keep.log'],
    );
    const reasons = Object.fromEntries(r.excluded.map((e) => [e.path, e.reason]));
    assert.equal(reasons['node_modules/'], 'node_modules');
    assert.equal(reasons['dist/'], 'dist');
    assert.equal(reasons['app.min.js'], '*.min.js');
    assert.equal(reasons['src/deep/x.log'], '.gitignore: *.log');
    assert.equal(reasons['tmp/'], '.gitignore: tmp/');
    assert.equal(reasons['legacy/old/'], '利用者指定: legacy/**');
    assert.equal(reasons['link.js'], 'シンボリックリンク（辿らない）');
    assert.equal(r.commit, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('folder: 存在しないパスは InputError', async () => {
  await assert.rejects(ingest({ kind: 'folder', path: join(tmpdir(), 'spec2doc-none-xyz') }), InputError);
});

test('files: 指定した 2 ファイルだけを対象にし、不在なら InputError', async () => {
  const root = await makeTree({ 'x/a.ts': '', 'x/b.ts': '', 'y/c.ts': '' });
  try {
    const r = await ingest({ kind: 'files', paths: [join(root, 'x/a.ts'), join(root, 'y/c.ts')] });
    assert.deepEqual(r.files.map((f) => f.path), ['x/a.ts', 'y/c.ts']);
    await assert.rejects(ingest({ kind: 'files', paths: [join(root, 'x/none.ts')] }), InputError);
    await assert.rejects(ingest({ kind: 'files', paths: [] }), InputError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('exclude: ** と ? と先頭 / の固定', () => {
  const ex = createExcluder('/root.txt\ndocs/**/*.md\nf?.js\n', []);
  assert.equal(ex.check('root.txt', false), '.gitignore: /root.txt');
  assert.equal(ex.check('sub/root.txt', false), null);
  assert.equal(ex.check('docs/a/b/c.md', false), '.gitignore: docs/**/*.md');
  assert.equal(ex.check('docs/c.md', false), '.gitignore: docs/**/*.md');
  assert.equal(ex.check('lib/f1.js', false), '.gitignore: f?.js');
  assert.equal(ex.check('lib/f12.js', false), null);
});

test('github: URL は https://github.com/<o>/<r> だけを許す', () => {
  assert.equal(parseGithubUrl('https://github.com/o-1/r.x').cloneUrl, 'https://github.com/o-1/r.x.git');
  assert.equal(parseGithubUrl('https://github.com/o/r.git/').repo, 'r');
  for (const bad of [
    'http://github.com/o/r',
    'https://gitlab.com/o/r',
    'https://github.com/o',
    'https://github.com/o/r/tree/main',
    'https://user:pw@github.com/o/r',
    'git@github.com:o/r.git',
    'https://github.com/o/..',
  ]) {
    assert.throws(() => parseGithubUrl(bad), InputError, bad);
  }
});

test('github: git 引数の組み立て（トークンは引数に入れず、github.com に限った環境変数で渡す）', () => {
  const byTag = buildGitPlan('https://github.com/o/r.git', 'v1.0', '/w/repo');
  assert.deepEqual(byTag, [{ cwd: 'work', args: ['clone', '--depth', '1', '--branch', 'v1.0', '--', 'https://github.com/o/r.git', '/w/repo'] }]);
  const sha = 'a'.repeat(40);
  assert.deepEqual(buildGitPlan('https://github.com/o/r.git', sha, '/w/repo'), [
    { cwd: 'work', args: ['clone', '--depth', '1', '--', 'https://github.com/o/r.git', '/w/repo'] },
    { cwd: 'repo', args: ['fetch', '--depth', '1', 'origin', sha] },
    { cwd: 'repo', args: ['checkout', '--detach', sha] },
  ]);
  assert.deepEqual(buildGitEnv('tkn'), {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
    GIT_CONFIG_VALUE_0: 'Authorization: Bearer tkn',
  });
  assert.deepEqual(buildGitEnv(undefined), {});
});

test('github: モックの git で取得し、GITHUB_TOKEN を使い、commit を返し、cleanup で消す', async () => {
  const calls: string[][] = [];
  const envs: Readonly<Record<string, string>>[] = [];
  const sha = 'b'.repeat(40);
  const run: GitRunner = async (args, _cwd, extraEnv) => {
    calls.push([...args]);
    envs.push(extraEnv);
    const i = args.indexOf('clone');
    if (i >= 0) {
      const dest = args[args.length - 1] ?? '';
      await mkdir(dest, { recursive: true });
      await writeFile(join(dest, 'a.ts'), '');
    }
    return args[0] === 'rev-parse' ? `${sha}\n` : '';
  };
  const got = await fetchGithub({ url: 'https://github.com/o/r', ref: 'main' }, run, { GITHUB_TOKEN: 'envtok' });
  assert.equal(got.commit, sha);
  assert.equal(calls[0]?.[0], 'clone');
  for (const c of calls) for (const a of c) assert.ok(!a.includes('envtok'), `引数にトークン: ${a}`);
  for (const e of envs) assert.equal(e['GIT_CONFIG_VALUE_0'], 'Authorization: Bearer envtok');
  assert.ok(calls[0]?.includes('https://github.com/o/r.git'));
  assert.deepEqual(calls.at(-1), ['rev-parse', 'HEAD']);
  await makeReadOnly(got.root);
  assert.equal((await stat(join(got.root, 'a.ts'))).mode & 0o777, 0o444);
  await got.cleanup();
  await assert.rejects(stat(got.root));
});

test('github: 参照の注入と git の失敗は InputError', async () => {
  const run: GitRunner = async () => {
    throw new Error('fatal: repository not found');
  };
  await assert.rejects(fetchGithub({ url: 'https://github.com/o/r', ref: '--upload-pack=x' }, run, {}), InputError);
  await assert.rejects(fetchGithub({ url: 'https://github.com/o/r' }, run, {}), InputError);
});

test('exclude: 文字クラス [..]・[!..] と、末尾 ** は中身だけに当たる', () => {
  const ex = createExcluder('*.[oa]\nx[!0-9].c\nlegacy/**\n', []);
  assert.equal(ex.check('lib/x.o', false), '.gitignore: *.[oa]');
  assert.equal(ex.check('x.a', false), '.gitignore: *.[oa]');
  assert.equal(ex.check('x.c', false), null);
  assert.equal(ex.check('xa.c', false), '.gitignore: x[!0-9].c');
  assert.equal(ex.check('x1.c', false), null);
  assert.equal(ex.check('legacy', true), null);
  assert.equal(ex.check('legacy/a/b.js', false), '.gitignore: legacy/**');
});

test('exclude: 細工したパターンでも照合が 50ms 以内（REDoS にならない）', () => {
  const cases: [string, string][] = [
    ['*'.repeat(20) + 'b', 'a'.repeat(200) + '.js'],
    ['*a'.repeat(12) + '*b', 'a'.repeat(63)],
    ['**/'.repeat(10) + 'z', Array.from({ length: 25 }, () => 'd').join('/')],
    ['?'.repeat(100) + '*[!a]', 'a'.repeat(500)],
  ];
  for (const [pat, path] of cases) {
    const ex = createExcluder(`${pat}\n`, [pat]);
    const t0 = performance.now();
    ex.check(path, false);
    const ms = performance.now() - t0;
    assert.ok(ms < 50, `${pat.slice(0, 20)}… が ${ms.toFixed(1)}ms`);
  }
});

test('exclude: 長すぎるパターンは使わず、その旨を知らせに積む', () => {
  const ex = createExcluder(`x\n${'a'.repeat(600)}\n`, ['b'.repeat(600)]);
  assert.equal(ex.check('a'.repeat(600), false), null);
  assert.equal(ex.notices.length, 2);
  assert.match(ex.notices[0]?.reason ?? '', /パターン長の上限（512 文字）を超えた 1 行（2 行目）を無視。除外したいファイルは除外パターン欄で指定してください/);
  assert.equal(ex.notices[1]?.path, '除外パターン欄');
});

test('folder: .gitignore の規則数・サイズの上限超過は excluded に理由付きで載る', async () => {
  const many = Array.from({ length: 2001 }, (_, i) => `p${i}.txt`).join('\n') + '\n';
  const root = await makeTree({ 'a.js': '', '.gitignore': many });
  const big = await makeTree({ 'a.js': '', '.gitignore': `${'#'.repeat(1000)}\n`.repeat(300) + 'a.js\n' });
  try {
    const r = await ingest({ kind: 'folder', path: root });
    const note = r.excluded.find((e) => e.path === '.gitignore');
    assert.match(note?.reason ?? '', /規則の上限（2000 件）を超えたため 2001 行目以降を無視。除外したいファイルは除外パターン欄で指定してください/);
    const r2 = await ingest({ kind: 'folder', path: big });
    const note2 = r2.excluded.find((e) => e.path === '.gitignore');
    assert.match(note2?.reason ?? '', /ファイルの上限（256KB）を超えたため \d+ 行目以降を無視/);
    assert.ok(r2.files.some((f) => f.path === 'a.js'));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(big, { recursive: true, force: true });
  }
});
