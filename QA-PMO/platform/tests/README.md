# E2Eスモークテスト

Playwright(Chromium)で実際にプラットフォームを描画し、全7ツール・ナビ・検索の動作を検証する回帰テスト。

```bash
cd QA-PMO/platform/tests
npm install
npm run setup   # chromiumブラウザ取得（初回のみ）
npm test
```

13項目（ホーム/ナビ/各ツール出力/カタログ/検索）を検証し、JSエラー0件で成功とする。
CDN（フォント/axe-core）の証明書・ネットワークエラーは設計上のフォールバック対象として除外している。
