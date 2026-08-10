import { test, expect, type Page } from '@playwright/test';

// 各テスト前に IndexedDB / localStorage をクリーンにする
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(dbs.map((d) => d.name && indexedDB.deleteDatabase(d.name)));
  });
  await page.reload();
});

// 日付を設定し、その日のデータ読み込み（非同期）完了を待ってから体重を入力する。
async function setDate(page: Page, date: string) {
  await page.fill('#f-date', date);
  await page.waitForFunction(
    (d) => document.querySelector('#f-date')?.getAttribute('data-loaded') === d,
    date,
    { timeout: 10000 },
  );
}

async function saveWeight(page: Page, date: string, weight: string) {
  await page.locator('nav.bottom [data-tab="record"]').click();
  await setDate(page, date);
  await page.fill('#f-weight', weight);
  await page.locator('#f-save').click();
  await expect(page.locator('#toast')).toContainText('保存しました');
}

test('AC-01 日次記録: 保存 → 再読込でデータが残る', async ({ page }) => {
  // 設定（身長・目標）
  await page.locator('nav.bottom [data-tab="settings"]').click();
  await page.fill('#s-height', '172');
  await page.fill('#s-goal', '60');
  await page.locator('#s-save').click();

  await saveWeight(page, '2026-07-21', '64.9');

  // ダッシュボードに最新値
  await expect(page.locator('.dash-hero .num')).toContainText('64.9');

  // 再読込しても残る（IndexedDB 永続化）
  await page.reload();
  await expect(page.locator('.dash-hero .num')).toContainText('64.9');
});

test('AC-02 BMI: 身長172/体重64.9 → 21.9 前後を表示', async ({ page }) => {
  await page.locator('nav.bottom [data-tab="settings"]').click();
  await page.fill('#s-height', '172');
  await page.locator('#s-save').click();
  await saveWeight(page, '2026-07-21', '64.9');
  // BMI = 64.9 / 1.72^2 = 21.9
  await expect(page.locator('.stat-grid')).toContainText('21.9');
});

test('ナビ・グラフ・履歴が描画される', async ({ page }) => {
  await saveWeight(page, '2026-07-19', '65.5');
  await saveWeight(page, '2026-07-21', '65.0');

  await page.locator('nav.bottom [data-tab="graph"]').click();
  await expect(page.locator('#main-chart')).toBeVisible();

  await page.locator('nav.bottom [data-tab="history"]').click();
  await expect(page.locator('.rec')).toHaveCount(2);
  await expect(page.locator('.badge-count')).toContainText('2件');
});

test('AC-04 オフライン: 一度起動後、オフラインでも再読込で起動する', async ({ page, context }) => {
  await saveWeight(page, '2026-07-21', '64.9');
  // Service Worker が active になるまで待つ（登録→インストール→有効化）
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), undefined, { timeout: 20000 });
  // 一度オンラインで再読込し、ページが SW の制御下に入ることを保証
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 20000 });

  await context.setOffline(true);
  await page.reload();
  // オフラインでもアプリシェルが起動し、保存済みデータを閲覧できる
  await expect(page.locator('.appbar h1')).toContainText('Body Record');
  await expect(page.locator('.dash-hero .num')).toContainText('64.9');
  await context.setOffline(false);
});

test('スタンプの選択トグル', async ({ page }) => {
  await page.locator('nav.bottom [data-tab="record"]').click();
  // 日付を先に確定（日付変更はその日のデータを読み込みスタンプをリセットするため）
  await setDate(page, '2026-07-21');
  const stamp = page.locator('[data-stamp="exercise"]');
  await stamp.click();
  await expect(stamp).toHaveAttribute('aria-pressed', 'true');
  await page.fill('#f-weight', '65');
  await page.locator('#f-save').click();
  await page.locator('nav.bottom [data-tab="history"]').click();
  await expect(page.locator('.rec .meta')).toContainText('🏃');
});
