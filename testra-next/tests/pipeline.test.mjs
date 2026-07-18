import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../core/pipeline.js';
import { STAGE_ORDER } from '../core/model.js';

const SPEC = `# ログイン

- ユーザーはメールアドレスとパスワードでログインできる。
- パスワードは8文字以上32文字以下でなければならない。
- パスワードを5回連続で誤入力するとアカウントがロックされる。
- ログイン成功後はダッシュボードへ遷移する。
- ログイン処理は3秒以内に応答すること。`;

function input() {
  return { title: 'ログイン', sources: [{ name: 'spec', kind: 'spec', text: SPEC }] };
}

test('全11ステージの成果物が生成される', async () => {
  const run = await runPipeline(input(), { timestamp: '2026-01-01T00:00:00Z' });
  for (const stage of STAGE_ORDER) {
    assert.ok(run.artifacts[stage], `${stage} の成果物が無い`);
  }
  assert.equal(run.trace.length, STAGE_ORDER.length);
});

test('決定論: 同一入力は同一の件数/IDを生成する', async () => {
  const a = await runPipeline(input(), { timestamp: '2026-01-01T00:00:00Z' });
  const b = await runPipeline(input(), { timestamp: '2026-01-01T00:00:00Z' });
  assert.deepEqual(
    a.artifacts.caseLow.cases.map((c) => c.id),
    b.artifacts.caseLow.cases.map((c) => c.id)
  );
  assert.equal(a.artifacts.report.summary.lowCases, b.artifacts.report.summary.lowCases);
});

test('ロック要件から状態遷移(STT)技法が選定される', async () => {
  const run = await runPipeline(input(), {});
  const usage = run.artifacts.modelAnalysis.stats.techniqueUsage;
  assert.ok(usage.STT >= 1, 'STT が選定されていない');
});

test('境界値要件から BVA カバレッジ(4件)が展開される', async () => {
  const run = await runPipeline(input(), {});
  const items = run.artifacts.designDetail.items;
  const bva = items.find((it) => it.technique === 'BVA');
  assert.ok(bva, 'BVA 条件が無い');
  assert.equal(bva.coverageItems.length, 4);
});

test('カバレッジアイテム数とハイ/ローレベルケース数が一致（トレーサビリティ）', async () => {
  const run = await runPipeline(input(), {});
  const cov = run.artifacts.designDetail.stats.coverageItems;
  assert.equal(run.artifacts.caseHigh.stats.total, cov);
  assert.equal(run.artifacts.caseLow.stats.total, cov);
});

test('実行器を注入すると live モードで結果が反映される', async () => {
  const runner = async (cases) => cases.map((c) => ({ id: c.id, status: 'pass', detail: 'ok' }));
  const run = await runPipeline(input(), { runner });
  assert.equal(run.artifacts.execution.mode, 'live');
  assert.equal(run.artifacts.execution.summary.passRate, 100);
});

test('不変性: Run はフリーズされ元オブジェクトは変化しない', async () => {
  const run = await runPipeline(input(), {});
  assert.ok(Object.isFrozen(run));
  assert.ok(Object.isFrozen(run.artifacts));
});
