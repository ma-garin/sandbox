// 実機の挙動確認（docs/verify/p4-browser-scenarios.md）で見つかった不具合の回帰テスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function generate(): string {
  const out = mkdtempSync(join(tmpdir(), 'spec2doc-qa-'));
  execFileSync('node', ['src/cli.ts', '--folder', 'fixtures/demo-library', '--out', out, '--docs', 'D02,D12', '--format', 'md,trace'], { timeout: 120_000 });
  const run = readdirSync(out)[0];
  assert.ok(run, '実行フォルダができる');
  return join(out, run);
}

const runDir = generate();

test('S8: サーバから開いたときは保存済みの確認状態を読み込み、読み込み前は保存しない（上書きによる消失を防ぐ）', () => {
  const html = readFileSync(join(runDir, 'traceability.html'), 'utf8');
  assert.match(html, /function loadRemote\(\)/, '起動時に保存済みの状態を読み込む関数がある');
  assert.match(html, /loadRemote\(\);\s*<\/script>|loadRemote\(\);\s*$/m, '起動処理の最後で読み込みを呼ぶ');
  assert.match(html, /if \(API && !state\.remoteReady\)/, '読み込みが終わるまで保存を待つ');
  assert.match(html, /mergeReviews\(state\.review, normalizeReview\(json/, 'サーバの状態を優先して重ねる');
});

test('S7: 関係図の点の名前に内部表記 <anonymous@…> を出さない', () => {
  const graph = JSON.parse(readFileSync(join(runDir, 'trace.json'), 'utf8')) as { nodes: { label: string }[] };
  const raw = graph.nodes.filter((n) => n.label.includes('<anonymous@'));
  assert.equal(raw.length, 0, `内部表記の点が ${raw.length} 件ある`);
  assert.ok(graph.nodes.some((n) => n.label.startsWith('無名関数（')), '無名関数は「無名関数（file:line）」で出る');
});
