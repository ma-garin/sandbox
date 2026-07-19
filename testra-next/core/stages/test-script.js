// ステージ8: テストスクリプト作成（test script）
// ローレベルテストケースから自動化スクリプトを生成する。
//  - Gherkin(.feature): 常に生成（人間可読・実装非依存）
//  - Playwright(.spec.js): Web対象
//  - Appium: apk（モバイル）対象があれば生成
//
// 生成はテンプレートベース。実行環境依存の値は TODO として明示する。

import { seqId } from '../util/id.js';

function esc(s) {
  return String(s).replace(/"/g, '\\"');
}

/** Gherkin フィーチャーファイルを1機能分生成 */
function toGherkin(featureName, cases) {
  const lines = [`Feature: ${featureName}`, ''];
  for (const c of cases) {
    lines.push(`  @${c.technique} @${c.priority}`);
    lines.push(`  Scenario: ${c.title}`);
    lines.push(`    Given ${c.precondition}`);
    lines.push(`    When ${c.steps[1] || '操作を行う'}`);
    lines.push(`    Then ${c.expected}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Playwright スペックを1機能分生成 */
function toPlaywright(featureName, cases) {
  const body = cases
    .map(
      (c) => `  test(${JSON.stringify(c.title)}, async ({ page }) => {
    // ${c.precondition}
    // TODO: 対象URL/セレクタを環境に合わせて設定
    // action: ${c.automationHint.action}
    // input: ${esc(c.testData.value)}
    // expect: ${esc(c.expected)}
    test.fixme(true, '実装待ち: セレクタ未確定');
  });`
    )
    .join('\n\n');
  return `import { test, expect } from '@playwright/test';

test.describe(${JSON.stringify(featureName)}, () => {
${body}
});
`;
}

/** Appium(WebdriverIO風) スペックを生成（apk向け） */
function toAppium(featureName, cases) {
  const body = cases
    .map(
      (c) => `  it(${JSON.stringify(c.title)}, async () => {
    // ${c.precondition}
    // action: ${c.automationHint.action} / input: ${esc(c.testData.value)}
    // expect: ${esc(c.expected)}
    // TODO: accessibility id を実APKに合わせて設定
  });`
    )
    .join('\n\n');
  return `describe(${JSON.stringify(featureName)}, () => {
${body}
});
`;
}

/**
 * @param {object} lowArtifact caseLow 出力
 * @param {object} doc ingest 出力（apk 有無の判定）
 */
export function generateScripts(lowArtifact, doc) {
  const hasApk = (doc.sources || []).some((s) => s.kind === 'apk');
  // 機能ごとにグルーピング
  const byFeature = new Map();
  for (const c of lowArtifact.cases || []) {
    const key = c.featureName || c.featureId;
    if (!byFeature.has(key)) byFeature.set(key, []);
    byFeature.get(key).push(c);
  }

  const scripts = [];
  let idx = 0;
  for (const [featureName, cases] of byFeature) {
    const slug = String(featureName).replace(/[^\w一-龠ぁ-んァ-ン]/g, '_').slice(0, 40);
    idx += 1;
    scripts.push({
      id: seqId('SCR', idx),
      feature: featureName,
      format: 'gherkin',
      filename: `${slug}.feature`,
      content: toGherkin(featureName, cases),
      caseIds: cases.map((c) => c.id),
    });
    scripts.push({
      id: seqId('SCR', idx * 100 + 1),
      feature: featureName,
      format: hasApk ? 'appium' : 'playwright',
      filename: hasApk ? `${slug}.appium.test.js` : `${slug}.spec.js`,
      content: hasApk ? toAppium(featureName, cases) : toPlaywright(featureName, cases),
      caseIds: cases.map((c) => c.id),
    });
  }
  return {
    scripts,
    stats: {
      total: scripts.length,
      target: hasApk ? 'mobile(appium)' : 'web(playwright)',
    },
  };
}
