// ステージ6/7: テストケース（ハイレベル caseHigh / ローレベル caseLow）
//
// ハイレベル: カバレッジアイテム→論理テストケース（データ非依存の手順・期待結果）
// ローレベル: 論理ケース→具体テストケース（テストデータ・事前条件・具体手順を確定）

import { seqId, stableId } from '../util/id.js';

/* ---------------- ハイレベル ---------------- */

/**
 * @param {object} detailArtifact designDetail 出力
 * @param {object} basicArtifact designBasic 出力（条件メタ参照）
 */
export function caseHigh(detailArtifact, basicArtifact) {
  const condById = new Map((basicArtifact.conditions || []).map((c) => [c.id, c]));
  const cases = [];
  let n = 0;
  for (const item of detailArtifact.items || []) {
    const cond = condById.get(item.conditionId);
    for (const cov of item.coverageItems) {
      n += 1;
      cases.push({
        id: seqId('HTC', n),
        coverageId: cov.id,
        conditionId: item.conditionId,
        featureId: item.featureId,
        featureName: cond?.featureName || '',
        technique: item.technique,
        priority: item.priority,
        title: `${cond?.featureName || ''} / ${cov.label}`,
        // 論理手順（データは未確定のプレースホルダ）
        steps: [
          `事前条件を満たす（${cond?.featureName || '対象機能'}が利用可能）`,
          `${cov.label} に相当する操作/入力を行う`,
          '結果を観測する',
        ],
        expected: cov.expected,
        requirementRefs: cond?.requirementRefs || [],
      });
    }
  }
  return { cases, stats: { total: cases.length } };
}

/* ---------------- ローレベル ---------------- */

// カバレッジラベルから代表テストデータを決める（ルールベースの具体化）
function dataFor(label) {
  if (/下限直下|無効|禁止|不正|エラー/.test(label)) return { input: '境界外/無効値', valid: false };
  if (/上限直上|タイムアウト|中断/.test(label)) return { input: '上限超/中断シナリオ', valid: false };
  if (/下限|上限|有効|基本|正常|規則1/.test(label)) return { input: '代表的な有効値', valid: true };
  return { input: '既定値', valid: true };
}

/**
 * @param {object} highArtifact caseHigh 出力
 */
export function caseLow(highArtifact) {
  const cases = (highArtifact.cases || []).map((hc, i) => {
    const label = hc.title.split('/').pop().trim();
    const d = dataFor(label);
    return {
      id: seqId('LTC', i + 1),
      parentId: hc.id,
      featureId: hc.featureId,
      featureName: hc.featureName,
      technique: hc.technique,
      priority: hc.priority,
      title: hc.title,
      precondition: `${hc.featureName || '対象機能'}にアクセス可能。テストデータ準備済み。`,
      // 具体化された実行可能ステップ（自動化スクリプト生成の入力になる）
      steps: hc.steps.map((s) => s.replace('相当する操作/入力を行う', `「${d.input}」を入力/操作する`)),
      testData: { value: d.input, expectedValid: d.valid },
      expected: hc.expected,
      // 自動化のためのセレクタ/アクション抽象（実装非依存の意図表現）
      automationHint: {
        action: d.valid ? 'submit_valid' : 'submit_invalid',
        assert: hc.expected,
      },
      requirementRefs: hc.requirementRefs,
      status: 'designed',
    };
  });
  return { cases, stats: { total: cases.length } };
}
