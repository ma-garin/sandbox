# PMO統合プラットフォーム（AIなしMVP）

上司依頼の **提供メニュー** ＋ **それらを搭載したプラットフォーム** ＋ **実working MVP機能** を1つに統合した、ゼロ依存の静的サイト。

## 使い方

```bash
# ビルド不要。ブラウザで開くだけ
open QA-PMO/platform/index.html
```

> UI/UX検証のWCAGエンジン（axe-core）はCDNから読み込みます。オフライン時は決定的ヒューリスティック検査のみで動作します。

## 構成

```
platform/
├── index.html      # 骨格（topbar / sidenav / main / modal）
├── styles.css      # design-system 紺系（#1a3a6b）
└── js/
    ├── data.js     # SERVICES（カタログ）+ NAV_TREE（メニュー）
    ├── tools.js    # 7つの実working MVPツール
    └── app.js      # ルーター・ナビ生成・検索・問い合わせ
```

## 搭載機能

### 品質PMO（カタログ：人的支援サービス）
コンサルタント派遣 / 各種策定支援 / 実装推進支援 / 顧問型支援 / 教育・示唆 / プロジェクト推進 / テスト推進

### AIサービス（実working MVP・**AIなし＝確立技術**）

| ツール | 中核技術（車輪の再発明をしない） | できること |
|---|---|---|
| ドキュメント検証 | textlint/RedPen系ルール | 曖昧語・冗長文・必須節欠落を行番号付きで検出＋品質スコア |
| トレーサビリティ | RTM（要件追跡マトリクス） | 要件↔テストのカバレッジ%・未カバー・孤立テスト算出 |
| 計画策定 | ISO/IEC 29119-3 | テスト計画書をMarkdown生成・DL |
| テスト設計 | ISTQB技法 | 境界値・同値分割・**ペアワイズ(貪欲all-pairs)**生成＋CSV |
| UI/UX検証 | axe-core＋DOM検査 | WCAG違反・alt/lang/ラベル/ボタン名の検出 |
| テスト自動化 | Playwright/pytest/bats | UI/API/BATのテストscaffold生成・DL |
| CI/CD構築 | GitHub Actions | パイプラインYAML生成・DL |

## 設計方針
- **AI不使用**：すべて決定的アルゴリズム／確立OSSで実装（MVP）
- **ゼロ依存**：バックエンド・ビルド・DBなし。GitHub Pages等へ即デプロイ可
- **品質基準**：ISTQB severity / ISO 25010 / ISO 29119 を非交渉で適用（qa-review-standards）
- **将来のAI化**：AI版は `QA-PMO/apps/` 配下で別途実装（例: `uiux-verifier` はOpenAI連携版）
