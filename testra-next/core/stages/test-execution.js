// ステージ9: テスト実行（test execution）
//
// 既定は "simulated"（ドライラン）: 実ブラウザ/実機を起動せず、
// テストデータの妥当性フラグから決定論的に結果を導く。デモ・設計検証用。
//
// 実行環境がある場合は runner(cases) を注入すると実結果に置き換わる。
// runner は [{ id, status: 'pass'|'fail'|'blocked', detail }] を返す契約。

/**
 * @param {object} lowArtifact caseLow 出力
 * @param {object} [opts]
 * @param {Function} [opts.runner] 実行器（async: cases => results[]）。未指定なら simulated
 * @returns {Promise<object>}
 */
export async function executeTests(lowArtifact, opts = {}) {
  const cases = lowArtifact.cases || [];
  let results;
  let mode;

  if (typeof opts.runner === 'function') {
    mode = 'live';
    const raw = await opts.runner(cases);
    const byId = new Map(raw.map((r) => [r.id, r]));
    results = cases.map((c) => normalize(c, byId.get(c.id)));
  } else {
    mode = 'simulated';
    results = cases.map((c) => simulate(c));
  }

  const summary = summarize(results);
  return { mode, results, summary };
}

// ドライラン: 期待が「有効入力の受理」なら pass、無効入力の適切な拒否も pass 扱い。
// スクリプト未実装（fixme）は blocked とし、正直に "未実行" を表現する。
function simulate(c) {
  const scriptReady = false; // 生成直後スクリプトは fixme 状態
  const status = scriptReady ? (c.testData.expectedValid ? 'pass' : 'pass') : 'blocked';
  return {
    id: c.id,
    caseId: c.id,
    title: c.title,
    priority: c.priority,
    status,
    detail: scriptReady ? '判定条件を満たした' : 'スクリプト未実装のため未実行（要セレクタ確定）',
  };
}

function normalize(c, r) {
  if (!r) return { id: c.id, caseId: c.id, title: c.title, priority: c.priority, status: 'blocked', detail: '結果未取得' };
  return {
    id: c.id,
    caseId: c.id,
    title: c.title,
    priority: c.priority,
    status: r.status || 'blocked',
    detail: r.detail || '',
  };
}

function summarize(results) {
  const s = { total: results.length, pass: 0, fail: 0, blocked: 0 };
  for (const r of results) s[r.status] = (s[r.status] || 0) + 1;
  s.passRate = s.total ? Math.round((s.pass / s.total) * 100) : 0;
  return s;
}
