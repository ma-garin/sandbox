# design.md — PMO統合プラットフォーム（AIなしMVP）

## アーキテクチャ
ゼロ依存の**静的サイト**（HTML/CSS/Vanilla JS）。バックエンド・ビルドなし。
唯一の外部依存は axe-core（CDN、UI/UX検証用）で、未取得時はヒューリスティックにフォールバック。

```
platform/
├── index.html        # 骨格（topbar / sidenav / main / modal）
├── styles.css        # design-system 紺系トークン + ツールUI
└── js/
    ├── data.js       # SERVICES（カタログ）+ NAV_TREE（メニュー構造）
    ├── tools.js      # 7つの実working MVPツール（確立アルゴリズム）
    └── app.js        # ルーター・ナビ生成・検索・問い合わせ
```

## ルーティング
サイドナビのリーフ `id` クリック → `route(id)`:
- `SERVICES[id].kind === 'catalog'` → カタログ詳細を描画
- `SERVICES[id].kind === 'tool'`    → `Tools[toolKey].render(container)` で実ツールを起動

## 各MVPツールのアルゴリズム（AIなし）
| ツール | 中核ロジック |
|---|---|
| ドキュメント検証 | 曖昧語辞書＋正規表現、文長閾値、必須見出し照合。行番号付きでseverity判定 |
| トレーサビリティ | `REQ-xxx` / `TC-xxx` をパースしマトリクス化。カバレッジ％・未カバー要件・孤立テストを算出 |
| 計画策定 | ISO 29119-3アウトラインのテンプレートにフォーム値を差し込みMarkdown生成 |
| テスト設計 | 境界値（min±1等）/同値分割（有効・無効）/ペアワイズ（貪欲all-pairs） |
| UI/UX検証 | srcdocのiframeへ描画→axe-core実行＋自前DOM検査（alt/lang/label/ボタン名） |
| テスト自動化 | 種別ごとのコードテンプレート（Playwright Page Object / pytest+requests / bats） |
| CI/CD構築 | ランタイム別にGitHub Actions YAMLを文字列生成（build→test→gate→deploy） |

## デザイン
design-system 紺系（`#1a3a6b`）。サイドバー固定・ヘッダー固定・メインのみスクロール。
実ツールには「実機能」バッジを付け、カタログ項目と区別する。

## 品質
各検出は ISTQB severity と根拠（行/ルールID/要素）を必ず提示（Evidence-only）。
