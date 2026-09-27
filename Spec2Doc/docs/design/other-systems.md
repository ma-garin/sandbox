# 他システムの画面構成調査（yuki-aidd-kit design-system 利用先）

調査範囲: `/Users/fujimagariyuki/dev/active/` 配下、深さ4まで（node_modules・.git・out・.work除く）。
判定基準: `tokens.css`/`components.css`/`layout.css`/`feedback.js` の読み込み、または `.app-globalbar`/`.app-topbar`/`.app-sidebar`/`.app-nav`/kitトークン（`--color-`/`--space-`）の実使用。

## 除外した誤検出（evidence-only）

grep一致はしたが実際は kit を使っていない（自前の CSS・トークンのみ）ため対象から外した。

| パス | 一致理由 | 除外理由 |
|---|---|---|
| `PMO_Agent/pmo_agent/templates/pmo_agent/mvp.html:4082,4142` | `data-kpi-row` 属性（JS用）が `kpi-row` にマッチ | CSS は `__PMO_CSS_URL__` 差し込みの自前スタイル。`.kpi-row` クラス自体は無い |
| `quality-point/web/js/dashboard.js` | 自前クラス `dash-kpi-row` が `kpi-row` にマッチ | `/style.css` は自前。kitのCSSファイル読み込みなし |
| `my-study-qa-app/*.html` | ファイル名が `layout.css`/`components.css` と一致 | `css/base.css` の中身は独自トークン（`--primary`,`--surface` 等）。kitの `--color-`/`--space-` は0件 |

## 対象システム（確認できた4件、いずれも上位6件の枠内）

git更新日時（最新コミット）順:

| # | システム | 最終更新 | 種別 |
|---|---|---|---|
| 1 | WebSpec2Doc | 2026-09-21 | Flask Webアプリ（ワークスペース型） |
| 2 | QA Autopilot | 2026-09-16 | Flask Webアプリ（プロジェクト管理型） |
| 3 | UX_Auto_Reviewer | 2026-08-18 | Flask/静的併用 Webアプリ（マルチテナントSaaS型） |
| 4 | AIDD Process Next | 2026-06-17 | 単一HTMLツール（SPA） |

---

### 1. WebSpec2Doc

- パス: `/Users/fujimagariyuki/dev/active/webspec2doc`
- 種別: Flask + Jinja。ワークスペース型SPA（`templates/workspace.html` が `partials/view-*.html` を切り替える）
- 出典: `webspec2doc/templates/workspace.html:1-40`, `webspec2doc/templates/partials/{topbar,nav}.html`, `webspec2doc/templates/partials/view-{dashboard,auto-run}.html`

**画面一覧と遷移（左サイドバー `data-view` 切替）**
- ホーム / つくる（画面仕様・テストケース・地図）/ ダッシュボード / 実行履歴 / 品質観点 / 観点管理 / AutoRun（受付・過去履歴）/ サポート（ユーザーガイド・参考・設定）
- 認証系は別シェル: `templates/auth/{login,signup,setup,tenant}.html`

**トップ画面の構成**（`view-dashboard.html:2-19`）
- ヒーロー（見出し＋サブ説明＋URL入力＋「解析を始める」ボタン）
- ヒーロー直下に「1 画面を解析 → 2 画面仕様書 → 3 テスト設計」という3ステップの矢印表示と所要時間目安
- 初回訪問者向け `onboarding-checklist`（隠し要素、3ステップのチェックリスト、サンプルデモ導線）

**作業画面の型（入力→実行→結果）**（`view-auto-run.html:2-98`）
- 「受付」セクション: モード切替（URL / 仕様書）→ URL入力＋任意の「先に到達確認」ボタン→観点セット選択→詳細オプション（`<details>`）
- 実行中は `autorun-leadbar`（`role="status" aria-live="polite"`）でステータス表示
- 「途中2回だけ止まります（ログインが必要なとき／実行条件の確認）」という明示的な中断点の告知が入力画面に書かれている

**結果/一覧/詳細の見せ方**
- `templates/traceability.html`, `templates/healing_reports.html` など、レポート系はそれぞれ専用テンプレート。3ペイン構成（観点管理はツリー＋インライン編集、AI提案）

**特徴的で良い工夫**
```html
<!-- topbar.html: 常時テナントチップ。JSが埋めるまで空表示にしないためinline style -->
<a id="topbar-tenant" class="app-topbar-tenant" href="/auth/tenant" style="display:none">
<!-- dashboard: 所要時間の見積りをヒーロー直下に明示 -->
<span class="dash-hero-note">目安: 1画面あたり約2〜3秒（10画面で30秒前後）</span>
```
- CSSの読み込み順にコメントで理由を明記（`app.css` の後に `ta2.css`/`ws.css` を置く理由＝トークン上書き順）— 設計判断が消えない工夫

**Spec2Docに取り入れられる点**
- ヒーロー直下の「N画面あたり約M秒」という所要時間の即時提示（体感速度への配慮）
- AutoRunの「途中で止まる回数を先に宣言する」UX（ユーザーの離脱防止）
- 初回訪問者向け `onboarding-checklist`（hidden→JS表示、3ステップ固定）

---

### 2. QA Autopilot

- パス: `/Users/fujimagariyuki/dev/active/qa-autopilot`
- 種別: Flask + Jinja。プロジェクト管理型（S1〜S8のライフサイクル画面）
- 出典: `qa-autopilot/qa_autopilot/web/templates/base.html:1-70`

**画面一覧と遷移**
- `base.html` のコメントに明記: 「共通レイアウト（plan_0909 A-12 / UI改修Step2でシェルをwebspec2doc構造に刷新）」— WebSpec2Docの構造を直接踏襲
- 左ナビは3グループ「つくる」「まわす」「サポート」、S1〜S8（プロジェクト/計画/監視/分析/設計/実装/インシデント/完了）がステータスに応じて活性化・プレースホルダ化

**トップ画面の構成**
- S1 `s1_projects.html`（プロジェクト一覧）が入口。「＋ 新規プロジェクト」ボタンがサイドバー最上部固定

**作業画面の型**
- S1→S8の直列パイプライン自体が「計画→監視→分析→設計→実装→インシデント→完了」という段階型ワークフロー。dev-lifecycleのV字工程に近い構造

**結果/一覧/詳細の見せ方**
- パンくず＋見出しに `<details class="evidence">` で根拠情報を折りたたみ表示（`base.html:60`付近）

**特徴的で良い工夫**
```html
{# constitution 第7条: 1280x800でページスクロールしない。一覧はペイン内スクロール #}
<li class="nav-item {{ 'active' if item.screen == screen }}" ... aria-current="page">
```
- 画面遷移の可否をJinjaの `{% if project and item.screen == 'S2' %}` で分岐し、未到達画面は `pointer-events:none` で無効化（進行制御をナビ自体に埋め込む）

**Spec2Docに取り入れられる点**
- S1〜S8のような「工程が進むとナビの項目が有効化される」進行制御パターン（Spec2Docの解析→仕様化→テスト設計のステップ管理に応用可）
- 根拠（evidence）を `<details>` で折りたたみ、通常時は画面を圧迫しない見せ方

---

### 3. UX_Auto_Reviewer

- パス: `/Users/fujimagariyuki/dev/active/UX_Auto_Reviewer`
- 種別: 静的HTML＋JS（マルチテナントSaaS型、`login`/`signup`/`tenant`/`workspaces` あり）
- 出典: `UX_Auto_Reviewer/web/index.html:1-140`, `UX_Auto_Reviewer/web/explore-run.html:98-124`

**画面一覧と遷移**
- 左サイドバー `app-nav`、グループ「診断する」（オートクローリング／ルールベース実行／AI実行）「見る」（実行履歴）「その他」（CLIガイド／設定）
- 認証・組織系: `login.html`/`signup.html`/`tenant.html`/`workspaces.html`/`account.html`

**トップ画面の構成**（`index.html:79-134`）
- `top-summary`（実行数／最新スコア／最新実行、`role="status" aria-live="polite"`）
- `top-command-panel`「診断を始める」に3つの実行方式をカード表示。各カードの2行目を「接続要否・1画面あたりの時間」で統一（コメントに「3枚を見比べても選べなかった」という過去の失敗からの修正が明記）

**作業画面の型（入力→実行→結果）**（`explore-run.html:112-124`）
- `wizard-progress` によるステップ表示: `wizard-step-node`（丸数字）＋`wizard-step-line`（接続線）で「1 探索の設定 → 2 探索と結果」を可視化する2ステップウィザード

**結果/一覧/詳細の見せ方**
- `coverage-map.html`, `detail.html`, `history.html` など個別画面。一覧→詳細の遷移が明確に分離

**特徴的で良い工夫**
```html
<!-- 3つの実行方式カードの2行目を統一フォーマットにする -->
<small>集めた画面をそのまま診断へ渡したいとき。ログインの先も辿れる<br>探索に接続先の設定は要らない・1画面あたり数秒</small>
```
- ウィザードの `wizard-step-node`/`wizard-step-line` はCSSだけで見た目の進行状況を表現でき、JSは `is-active` クラス切替のみで済む軽量設計

**Spec2Docに取り入れられる点**
- `wizard-progress` の2〜3ステップ型ウィザード（Spec2DocのURL解析→仕様生成→レポート確認にそのまま適用可）
- 実行方式が複数ある画面でのカード比較フォーマットの統一（接続要否・所要時間を必ず2行目に書く規約）

---

### 4. AIDD Process Next

- パス: `/Users/fujimagariyuki/dev/active/aidd-process-next`
- 種別: 単一HTMLツール（SPA、`docs/index.html` 592行）
- 出典: `aidd-process-next/docs/index.html:11,29-73,264-492`

**画面一覧と遷移**
- `id="screen-*"` のJS切替（`class="screen active"` で表示）: welcome → assessment → results → report、他に guide/help/catalog/rationale/admin
- ヘッダーのグローバルナビ（ユーザーガイド／診断項目一覧／根拠・論拠／ヘルプ／管理者ログイン）とサイドナビの二段構成

**トップ画面の構成**
- `screen-welcome` が入口。サイドナビに「診断を始める」系のCTA（`sidenav-cta`、新規開始／サンプル読込）

**作業画面の型**
- assessment（入力）→ results（結果）→ report（レポート）の直列3画面。dev-lifecycleに近い一直線フロー

**特徴的で良い工夫**
```html
<div class="url-import-banner" id="url-import-banner" role="status" aria-live="polite" hidden>
```
- URLインポート時のバナー、コピー用トースト（`copy-toast`）など、単一HTMLでも状態フィードバックを丁寧に用意

**Spec2Docに取り入れられる点**
- 単一HTMLでも `screen-*` + `active` クラスのみで多画面SPAを実現する最小構成（サーバ不要な配布物として参考になる）

---

## 共通して使われている画面の型

1. **左サイドバー（`app-sidebar`/`app-nav`、グループ見出し付き）＋ 右上パンくず＋タイトルの `app-topbar`** — WebSpec2Doc・QA Autopilot・UX_Auto_Reviewerで共通。グループ名は「つくる／まわす／サポート」「診断する／見る／その他」など動詞的に分類
2. **トップ画面はダッシュボード型**: 上部にKPI/サマリー（件数・最新スコア等）、中央に「実行を始める」ためのカード/ヒーローフォーム、所要時間や接続要否を明示
3. **作業画面はウィザード／ステップ型**: 「入力（受付）→ 実行中ステータス → 結果」の3段。UX_Auto_Reviewerは `wizard-step-node` で視覚化、WebSpec2DocのAutoRunは受付フォーム内にステップ表示を埋め込み、QA AutopilotはS1〜S8の工程全体をステップ化
4. **根拠・詳細は折りたたみ表示**（`<details>`）で通常時は画面を圧迫しない

## 代表3画面（実機確認用）

| システム | 開き方 |
|---|---|
| WebSpec2Doc トップ（ダッシュボード） | `cd /Users/fujimagariyuki/dev/active/webspec2doc && make demo` 起動後、ブラウザで表示されるワークスペースURL（README記載、APIキー不要） |
| QA Autopilot S1（プロジェクト一覧） | `cd /Users/fujimagariyuki/dev/active/qa-autopilot && python app.py` → `http://127.0.0.1:<WEB_PORT>/`（ポートは `qa_autopilot/config.py` の `WEB_PORT`） |
| UX_Auto_Reviewer 探索ウィザード | `file:///Users/fujimagariyuki/dev/active/UX_Auto_Reviewer/web/explore-run.html`（静的HTML、サーバ不要） |
