# tasks.md — PMO統合プラットフォーム（AIなしMVP）

| # | タスク | 対応 | 状態 |
|---|---|---|---|
| P-01 | サイドナビ2階層（NAV_TREEから動的生成） | js/app.js | ✅ |
| P-02 | カタログ詳細表示（品質PMO） | js/app.js | ✅ |
| P-03 | 検索・ホーム・問い合わせモーダル | js/app.js | ✅ |
| T-DOC | ドキュメント検証（ルールベース校正） | js/tools.js | ✅ |
| T-TRC | トレーサビリティ（RTM） | js/tools.js | ✅ |
| T-PLN | 計画策定（ISO 29119生成） | js/tools.js | ✅ |
| T-TD  | テスト設計（境界値/同値/ペアワイズ） | js/tools.js | ✅（全ペア網羅を検証済） |
| T-UX  | UI/UX検証（axe-core＋ヒューリスティック） | js/tools.js | ✅ |
| T-AUTO| テスト自動化（Playwright/pytest/bats生成） | js/tools.js | ✅ |
| T-CI  | CI/CD構築（GitHub Actions生成） | js/tools.js | ✅ |
| QA    | qa-review-standardsレビュー（12/12 PASS・Critical/Major 0件） | docs/qa-review.md | ✅ |
| TEST  | E2Eスモークテスト（回帰資産） | tests/smoke.js | ✅ |
