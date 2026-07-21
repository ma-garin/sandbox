import { defineConfig, devices } from '@playwright/test';

// E2E は本番ビルドを preview サーバで配信して検証する（Service Worker / PWA を含めるため）。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4188',
    viewport: { width: 390, height: 780 },
    trace: 'off',
    // サンドボックスに同梱の Chromium を使用（バージョン差異回避のため明示指定可）
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 780 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4188 --strictPort',
    url: 'http://localhost:4188',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
