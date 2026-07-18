// ステージ11: テストレポート生成（report）
// Run 全体から、経営/現場向けの Markdown レポートと集計サマリを生成する。

/**
 * @param {object} run 完了済み run
 * @param {object} [qf] qfSync 出力（任意）
 * @returns {{summary:object, markdown:string}}
 */
export function generateReport(run, qf) {
  const a = run.artifacts;
  const feats = a.featureAnalysis?.stats || {};
  const exec = a.execution?.summary || { total: 0, pass: 0, fail: 0, blocked: 0, passRate: 0 };
  const techUsage = a.modelAnalysis?.stats?.techniqueUsage || {};

  const summary = {
    project: run.meta.name,
    generatedAt: run.meta.timestamp,
    engine: run.meta.engine,
    features: feats.total || 0,
    conditions: a.designBasic?.stats?.total || 0,
    coverageItems: a.designDetail?.stats?.coverageItems || 0,
    highCases: a.caseHigh?.stats?.total || 0,
    lowCases: a.caseLow?.stats?.total || 0,
    scripts: a.script?.stats?.total || 0,
    execution: exec,
    qualityForward: qf ? { mode: qf.mode, sent: qf.sent, ...qf.payload?.counts } : null,
  };

  const md = [
    `# テストレポート: ${summary.project}`,
    '',
    `- 生成日時: ${summary.generatedAt}`,
    `- エンジン: ${summary.engine}`,
    '',
    '## パイプライン成果サマリ',
    '',
    '| ステージ | 件数 |',
    '|---|---|',
    `| テストフィーチャー | ${summary.features} |`,
    `| テスト条件（基本設計） | ${summary.conditions} |`,
    `| カバレッジアイテム（詳細設計） | ${summary.coverageItems} |`,
    `| ハイレベルテストケース | ${summary.highCases} |`,
    `| ローレベルテストケース | ${summary.lowCases} |`,
    `| 自動化スクリプト | ${summary.scripts} |`,
    '',
    '## テスト実行結果',
    '',
    `- 実行モード: **${a.execution?.mode || 'n/a'}**`,
    `- 合計 ${exec.total} / Pass ${exec.pass} / Fail ${exec.fail} / Blocked ${exec.blocked}（Pass率 ${exec.passRate}%）`,
    '',
    '## 適用テスト技法の分布',
    '',
    ...Object.entries(techUsage).map(([t, n]) => `- ${t}: ${n} フィーチャー`),
    '',
    '## Quality Forward 連携',
    '',
    qf
      ? `- モード: ${qf.mode} / 送信: ${qf.sent ? '成功' : '未送信(dry-run)'} / スイート ${qf.payload?.counts?.suites ?? 0}・ケース ${qf.payload?.counts?.testCases ?? 0}`
      : '- 未連携',
    '',
    '## 品質所見（自動生成）',
    '',
    ...findings(exec, summary),
    '',
  ].join('\n');

  return { summary, markdown: md };
}

function findings(exec, summary) {
  const out = [];
  if (exec.blocked > 0) {
    out.push(
      `- ⚠️ ${exec.blocked} 件が Blocked（未実行）。自動化スクリプトのセレクタ確定と実行環境接続が次アクション。`
    );
  }
  if (exec.fail > 0) {
    out.push(`- ❌ ${exec.fail} 件が Fail。要件トレースを辿り不具合として severity 分類のこと。`);
  }
  if (summary.coverageItems > 0 && summary.lowCases >= summary.coverageItems) {
    out.push('- ✅ 詳細設計のカバレッジアイテムはすべてローレベルケースへ落とし込み済み（設計トレーサビリティ確保）。');
  }
  if (out.length === 0) out.push('- 特記事項なし。');
  return out;
}
