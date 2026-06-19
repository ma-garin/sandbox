---
name: personal-pwa
description: 個人のPWA開発・GitHub Pagesデプロイ・ゼロ予算AI連携に使うスキル。「PWA作って」「GitHub Pagesにデプロイ」「個人プロジェクト」の言及で使用。
---

# Personal PWA Pattern

## 環境制約（ゼロ予算）
- AIバックエンドはGemini API無料枠のみ（静的HTMLから直接呼び出し、サーバー不要）
- デプロイ先: GitHub Pages、`ma-garin`アカウント配下
- データ永続化: `localStorage`（サーバーDBなし）

## 開発〜デプロイフロー
1. single-html-toolスキルでデモ作成
2. PWA化（manifest.json + service worker追加）
3. `ma-garin`配下のリポジトリにpush
4. GitHub Actions（auto-deploy workflow）でPages公開
5. Galaxy Z Fold5でTailscale経由、または公開URLで動作確認

## Gemini API無料枠 呼び出し例
```javascript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }
);
```
APIキーはクライアント側に露出するため、個人利用・低トラフィック前提のみで許容。公開リポジトリにキーを直接コミットしない（pre-write-checkフックで検知）。

## マルチデバイス確認
- 開発: MacBook Air M1
- 常時稼働サーバー: NEC Mate SFF（Win11）
- モバイル確認: Galaxy Z Fold5（Tailscale + Remote Desktop経由でNEC Mateにアクセス）

## 既存PWA資産
cashflow tracker、kakeibo、girls bar accounting app、Nogizaka46 schedule trackerと同系列。新規PWAもこれらとデザイン統一する（design-systemスキル参照）。
