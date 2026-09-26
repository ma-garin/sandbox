// REQ-F-026: CLI の引数の誤りで終了コード 2、--help で使い方と終了コード 0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function cli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    execFile(process.execPath, ['src/cli.ts', ...args], { cwd: ROOT, timeout: 30_000, env }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      done({ code, stdout, stderr });
    });
  });
}

test('--help: 使い方を表示して 0 で終わる', async () => {
  const r = await cli(['--help']);
  assert.equal(r.code, 0);
  for (const flag of ['--github', '--folder', '--files', '--zip', '--out', '--docs', '--format', '--llm', '--exclude']) {
    assert.ok(r.stdout.includes(flag), `${flag} が説明にある`);
  }
  assert.match(r.stdout, /想定外の失敗.*1 で終わる/);
  assert.match(r.stdout, /trace: トレーサビリティの HTML（関係図と確認の管理）/);
});

const inputErrors: [string, string[]][] = [
  ['入力が無い', ['--out', 'out']],
  ['知らない引数', ['--folder', '.', '--bogus']],
  ['入力が 2 つ', ['--folder', '.', '--zip', 'a.zip']],
  ['--ref だけ', ['--folder', '.', '--ref', 'main']],
  ['不正な文書の種類', ['--folder', '.', '--docs', 'D01,D99']],
  ['不正な出力形式', ['--folder', '.', '--format', 'md,pdf']],
  ['不正な出力形式（trace の誤記）', ['--folder', '.', '--format', 'traces']],
  ['存在しないフォルダ', ['--folder', 'no/such/dir/xyz', '--out', 'out']],
];

for (const [name, args] of inputErrors) {
  test(`入力の誤り（${name}）: 原因と次の行動を出して 2 で終わる`, async () => {
    const r = await cli(args);
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /エラー: /);
    assert.match(r.stderr, /次の行動: /);
  });
}

test('--llm でキーが無い: 原因と次の行動を出して 2 で終わる', async () => {
  const env = { ...process.env };
  delete env['ANTHROPIC_API_KEY'];
  const r = await cli(['--folder', 'fixtures/sample-app', '--out', 'out', '--llm'], env);
  assert.equal(r.code, 2, r.stderr);
  assert.match(r.stderr, /エラー: .*ANTHROPIC_API_KEY/);
  assert.match(r.stderr, /次の行動: /);
});
