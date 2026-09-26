// E2E: CLI をプロセスとして起動し、フォルダ入力から全文書・全形式が生成されることを確認する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOC_IDS = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D11', 'D12'];
const FORMATS = ['md', 'html', 'docx', 'xlsx'];

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done, fail) => {
    execFile(
      process.execPath,
      ['src/cli.ts', ...args],
      { cwd: ROOT, timeout: 60_000 },
      (err, stdout, stderr) => {
        if (err && typeof err.code !== 'number' && err.signal) {
          fail(err);
          return;
        }
        const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
        done({ code, stdout, stderr });
      },
    );
  });
}

test('フォルダ入力から全文書・全形式を生成する', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'spec2doc-e2e-'));
  try {
    const r = await run([
      '--folder',
      'fixtures/sample-app',
      '--out',
      outDir,
      '--docs',
      DOC_IDS.join(','),
      '--format',
      FORMATS.join(','),
    ]);
    assert.equal(r.code, 0, r.stderr);

    const runPath = r.stdout.trim();
    assert.ok(runPath.length > 0, 'stdout に出力先パスがある');

    const files = await readdir(runPath);
    for (const docId of DOC_IDS) {
      for (const fmt of FORMATS) {
        assert.ok(files.includes(`${docId}.${fmt}`), `${docId}.${fmt} が生成されている`);
      }
    }
    assert.ok(files.includes('ir.json'), 'ir.json が生成されている');
    assert.ok(files.includes('run-log.json'), 'run-log.json が生成されている');

    const expectedDocFiles = DOC_IDS.length * FORMATS.length;
    const actualDocFiles = files.filter((f) => DOC_IDS.some((d) => f.startsWith(`${d}.`))).length;
    assert.equal(actualDocFiles, expectedDocFiles);

    for (const fmt of ['docx', 'xlsx']) {
      const buf = await readFile(join(runPath, `${DOC_IDS[0]}.${fmt}`));
      assert.equal(buf[0], 0x50, `${fmt} の先頭バイトは P`);
      assert.equal(buf[1], 0x4b, `${fmt} の先頭バイトは K`);
    }

    const html = await readFile(join(runPath, `${DOC_IDS[0]}.html`), 'utf8');
    assert.match(html, /<title>/, 'html に <title> がある');

    for (const docId of DOC_IDS) {
      const md = await readFile(join(runPath, `${docId}.md`), 'utf8');
      assert.doesNotMatch(md, /undefined/, `${docId}.md に undefined が無い`);
      assert.doesNotMatch(md, /\[object Object\]/, `${docId}.md に [object Object] が無い`);
      assert.doesNotMatch(md, /NaN/, `${docId}.md に NaN が無い`);
    }

    const log = JSON.parse(await readFile(join(runPath, 'run-log.json'), 'utf8')) as {
      durationMs: number;
      fileCounts: { total: number };
    };
    assert.ok(typeof log.durationMs === 'number' && log.durationMs >= 0, 'run-log.json に処理時間がある');
    assert.ok(typeof log.fileCounts?.total === 'number' && log.fileCounts.total > 0, 'run-log.json にファイル件数がある');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('存在しないフォルダを指定すると終了コード 2 になる', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'spec2doc-e2e-'));
  try {
    const r = await run(['--folder', 'no/such/dir/xyz-e2e', '--out', outDir]);
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /エラー: /);
    assert.match(r.stderr, /次の行動: /);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
