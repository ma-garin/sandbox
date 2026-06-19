/* smoke.js — プラットフォームのE2Eスモークテスト（回帰用）
 * 実行: cd tests && npm install && npm test
 * Playwright(Chromium)で実際に描画し、全9ツールの動作とナビ/検索を検証する。
 */
const { chromium } = require('playwright');
const path = require('path');

const INDEX = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  // CDN（フォント/axe）の証明書・ネットワークエラーは設計上のフォールバック対象のため除外
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_CERT|net::|Failed to load resource/.test(m.text()))
      errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(INDEX, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const results = [];
  const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}: ${name}${extra ? ' — ' + extra : ''}`);
  const openTool = async id => { await page.locator(`.nav-item[data-id="${id}"]`).click(); await page.waitForTimeout(150); };

  ok('ホームに全16サービスカード', await page.locator('#view-home .h-card').count() === 16);
  ok('ナビに実機能バッジ9件', await page.locator('#sidenav .tool-tag').count() === 9);

  await openTool('doc-verify'); await page.locator('#dv-run').click(); await page.waitForTimeout(100);
  ok('ドキュメント検証: 結果テーブル', await page.locator('#dv-result .tool-table').count() > 0);
  ok('ドキュメント検証: スコア', (await page.locator('#dv-result .score-chip').innerText()).includes('/100'));

  await openTool('trace'); await page.locator('#tr-run').click(); await page.waitForTimeout(100);
  ok('トレーサビリティ: カバレッジ', /\d+%/.test(await page.locator('#tr-result .score-chip').innerText()));

  await openTool('plan-ai'); await page.locator('#tp-run').click(); await page.waitForTimeout(100);
  ok('計画策定: ISO29119生成', (await page.locator('#tp-result .codeblock').innerText()).includes('ISO/IEC 29119'));

  await openTool('test-design');
  // 観点ベース設計（デフォルトタブ・差別化機能）
  await page.waitForTimeout(80);
  ok('テスト設計: 観点ベース既定生成', await page.locator('#vp-out .tool-table tbody tr').count() > 0);
  ok('テスト設計: 観点カバレッジ表示', (await page.locator('#vp-out .score-chip').innerText()).includes('%'));
  await page.locator('.subtab[data-t="pw"]').click(); await page.waitForTimeout(80);
  await page.locator('#pw-run').click(); await page.waitForTimeout(100);
  ok('テスト設計: ペアワイズ生成', await page.locator('#pw-out .tool-table tbody tr').count() > 0);

  await openTool('uiux'); await page.locator('#ux-run').click(); await page.waitForTimeout(400);
  ok('UI/UX検証: 検出結果', await page.locator('#ux-out .tool-table tbody tr').count() > 0);

  await openTool('defect-mgr');
  await page.locator('#dm-title').fill('スモークテスト用サンプル欠陥');
  await page.locator('#dm-add').click(); await page.waitForTimeout(100);
  ok('欠陥管理: 欠陥登録と一覧表示', await page.locator('#dm-list .tool-table tbody tr').count() > 0);
  ok('欠陥管理: severity バッジ表示', await page.locator('#dm-list .sev').count() > 0);

  await openTool('test-auto'); await page.locator('#ta-run').click(); await page.waitForTimeout(100);
  ok('テスト自動化: scaffold生成', (await page.locator('#ta-out .codeblock').innerText()).includes('playwright'));

  await openTool('cicd'); await page.locator('#ci-run').click(); await page.waitForTimeout(100);
  ok('CI/CD: YAML生成', (await page.locator('#ci-out .codeblock').innerText()).includes('jobs:'));

  await openTool('viewpoint-kb'); await page.waitForTimeout(200);
  ok('観点ライブラリ: 観点一覧表示', await page.locator('#kb-panel .tool-table tbody tr').count() > 0);
  ok('観点ライブラリ: 統計ウィジェット', await page.locator('#tool-host .kb-stat').count() === 4);

  await page.locator('.nav-item[data-id="consultant"]').click(); await page.waitForTimeout(100);
  ok('カタログ: CTAボタン', await page.locator('#view-detail .cta button').count() > 0);

  await page.locator('#search').fill('テスト'); await page.waitForTimeout(150);
  ok('検索: 結果表示', await page.locator('#search-cards .h-card').count() > 0);

  console.log(results.join('\n'));
  console.log('\nJSエラー: ' + (errors.length ? '\n' + errors.join('\n') : 'なし'));
  const passed = results.filter(r => r.startsWith('PASS')).length;
  const failed = results.length - passed + errors.length;
  console.log(`\n=== ${passed}/${results.length} PASS / JSエラー${errors.length}件 ===`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
