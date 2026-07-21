/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages（プロジェクトサイト）ではサブパス配信になるため相対 base を使う。
// これによりルート配信・/<repo>/ 配信のどちらでも資産が解決できる。
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt', // 更新は利用者に通知して適用（NFR-010）
      injectRegister: 'inline',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      manifest: {
        name: 'Body Record — 体重・体組成記録',
        short_name: 'Body Record',
        description: '毎日の体重・体組成を記録し、推移と目標達成を確認する個人用アプリ',
        lang: 'ja',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f8fa',
        theme_color: '#2f6f4f',
        categories: ['health', 'lifestyle', 'fitness'],
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // 初回訪問時から SW がページを制御しオフライン起動を可能にする。
        // 更新は skipWaiting=false のまま prompt で通知（NFR-010）。
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2021',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
