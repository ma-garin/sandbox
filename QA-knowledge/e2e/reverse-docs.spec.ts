import { expect, test } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const appURL = process.env.PLAYWRIGHT_BASE_URL;
let fixtureServer: http.Server;
let fixtureURL = '';

test.skip(!appURL, 'Set PLAYWRIGHT_BASE_URL to a running Streamlit app, e.g. http://localhost:8501');
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fixtureServer = http.createServer((request, response) => {
    const path = request.url?.split('?')[0] ?? '/';
    const html = (body: string) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    };

    if (path === '/sitemap.xml') {
      response.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>${fixtureURL}/customers</loc></url>
          <url><loc>${fixtureURL}/contact</loc></url>
          <url><loc>${fixtureURL}/pricing</loc></url>
        </urlset>`);
      return;
    }

    if (path === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Sitemap: ${fixtureURL}/sitemap.xml`);
      return;
    }

    if (path === '/pricing') {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('forbidden');
      return;
    }

    if (path === '/customers') {
      html(`<!doctype html>
        <html lang="ja">
          <head><title>顧客一覧</title></head>
          <body>
            <nav><a href="/contact">お問い合わせ</a></nav>
            <main>
              <h1>顧客一覧</h1>
              <input type="search" name="keyword" placeholder="会社名で検索">
              <button>検索</button>
            </main>
          </body>
        </html>`);
      return;
    }

    if (path === '/contact') {
      html(`<!doctype html>
        <html lang="ja">
          <head><title>問い合わせ</title></head>
          <body>
            <main>
              <h1>お問い合わせ</h1>
              <input type="email" name="email" placeholder="メールアドレス">
              <button>送信</button>
            </main>
          </body>
        </html>`);
      return;
    }

    html(`<!doctype html>
      <html lang="ja">
        <head>
          <title>顧客管理システム</title>
          <meta name="description" content="営業チーム向けの顧客管理と商談管理を行うWebシステム">
        </head>
        <body>
          <nav>
            <a href="/customers">顧客一覧</a>
            <a href="/contact">お問い合わせ</a>
            <a href="https://support.example.com">サポート</a>
          </nav>
          <main>
            <h1>顧客管理</h1>
            <form action="/customers" method="post">
              <input type="text" name="company_name" placeholder="会社名">
              <button type="submit">保存</button>
            </form>
          </main>
        </body>
      </html>`);
  });

  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, '127.0.0.1', resolve);
  });
  const address = fixtureServer.address() as AddressInfo;
  fixtureURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    fixtureServer.close((error) => (error ? reject(error) : resolve()));
  });
});

async function openWorkbench(page) {
  await page.goto(appURL!);
  await expect(page.getByText('QA Knowledge Reverse Docs').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('起点URL')).toBeVisible();
  await expect(page.getByRole('button', { name: '解析して文書生成' })).toBeVisible();
}

async function assertNoConsoleErrors(page, action: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await action();

  expect(errors).toEqual([]);
}

async function runFixtureAnalysis(page) {
  await openWorkbench(page);
  await page.getByLabel('起点URL').fill(fixtureURL);
  await page.getByRole('button', { name: '解析して文書生成' }).click();

  await expect(page.getByText('解析と文書生成が完了しました。')).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText('1件のURLは取得できませんでした')).toBeVisible();
}

test('初期導線とFold5幅で起点URL入力を最優先に表示する', async ({ page }) => {
  await assertNoConsoleErrors(page, async () => {
    await openWorkbench(page);
    await expect(page.getByText('最初にURLを解析してください')).toBeVisible();
    await page.getByText('詳細設定').click();
    await expect(page.getByLabel('追加URL（任意）')).toBeVisible();
    await expect(page.getByRole('slider', { name: '安全上限ページ数' })).toBeVisible();

    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(appURL!);
    await expect(page.getByLabel('起点URL')).toBeVisible();
    await expect(page.getByRole('button', { name: '解析して文書生成' })).toBeVisible();
  });
});

test('fixtureサイト解析後にレビュー残作業、改善、出力ゲートを表示する', async ({ page }) => {
  await assertNoConsoleErrors(page, async () => {
    await runFixtureAnalysis(page);

    await expect(page.getByText('レビュー完了までの残作業')).toBeVisible();
    await expect(page.getByText('未レビュー文書 16件を確認済みにする')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'ダッシュボード' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '画面' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '文書レビュー' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '根拠・確認事項' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '改善' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '出力' })).toBeVisible();

    await page.getByRole('tab', { name: '改善' }).click();
    await expect(page.getByText('High以上の改善項目')).toBeVisible();

    await page.getByRole('tab', { name: '出力' }).click();
    await expect(page.getByText('出力可能性: 保留')).toBeVisible();
    await expect(page.getByRole('button', { name: '文書別Markdown + CSV ZIPをダウンロード' })).toBeVisible();
  });
});

test('文書レビュー状態と未確認事項回答をユーザー操作で更新できる', async ({ page }) => {
  await assertNoConsoleErrors(page, async () => {
    await runFixtureAnalysis(page);

    await page.getByRole('tab', { name: '文書レビュー' }).click();
    await page.getByLabel('レビュー状態').click();
    await page.getByText('確認済み', { exact: true }).click();
    await expect(page.getByRole('combobox', { name: /Selected 確認済み.*レビュー状態/ })).toBeVisible();

    await page.getByRole('tab', { name: '根拠・確認事項' }).click();
    await page.getByLabel('Q-001 事業目的').fill('対象ユーザーは営業担当者。KPIは商談化率。');
    await page.getByRole('tab', { name: '出力' }).click();
    await expect(page.getByRole('button', { name: '文書別Markdown + CSV ZIPをダウンロード' })).toBeVisible();
  });
});
