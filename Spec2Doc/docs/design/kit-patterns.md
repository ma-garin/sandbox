# yuki-aidd-kit デザイン調査 — Spec2Doc 画面作り直しの手本

出典: `yuki-aidd-kit/01_利用者向け資料/{01_利用ガイド,02_操作マニュアル,90_サンプル/図書貸出/library-loan,note/yuki-aidd-kit導入ガイド}.html`、`02_共通/ひな形/{design-system.md,components/demo.html,components/demo-shell.html}`、`03_ClaudeCode/skills/design-system/{SKILL.md,references/components.md,references/tokens.md}`。

---

## 1. ページの型ごとの構成

### 1-1. 管理画面（ダッシュボード・一覧管理）— library-loan.html / demo-shell.html

骨格は3層固定。`.app-globalbar`（横いっぱい・製品名/テナント）→ `.app-body`（`.sidebar` + `.maincol`）→ `.maincol` 内が `.app-topbar`（パンくず+タイトル+主操作1つ）→ `.app-content`（本文だけスクロール）。

```html
<div class="app" id="app">
  <header class="app-globalbar">…</header>
  <div class="app-body">
    <aside class="sidebar" id="sidebar">…</aside>
    <div class="maincol">
      <header class="app-topbar">…</header>
      <main class="app-content">…</main>
    </div>
  </div>
</div>
```
出典: `library-loan.html:446-471`、`demo-shell.html:16-39`

- **ヘッダーはサイドバーの上を横断させない**。サイドバーは画面最上部から独立して伸ばし、ブランドもサイドバー内トップに置く（`skills/design-system/SKILL.md:56`）。
- ダッシュボードの並び順は固定: KPI カード列（`.kpi-row`、3〜5枚横並び）→ フィルタ行（`.filter-row`、チップで可視化・×で個別解除）→ データテーブル（`design-system.md:56-58`、`library-loan.html:475-487`）。
- サイドナビは折りたたみ可能（240px→72px、`.sidebar.collapsed` でラベル非表示）。768px 以下は off-canvas（`.sidebar.open`）。折りたたみボタンはブランド行と同居させない（`SKILL.md:57`）。

### 1-2. 一覧画面（蔵書・貸出中）— library-loan.html:490-527

構成順: `.toolbar`（検索ボックス→セグメント絞り込み→スペーサ→主操作ボタン）→ `.card` 内にテーブル → 空状態プレースホルダ → `.pagebar`（件数/総数 + ページャ）。

```html
<div class="toolbar">
  <input class="input" id="book-q" type="search" placeholder="書名・著者・ID で検索">
  <span class="seg" role="group"><span class="active" data-v="all">すべて</span>…</span>
  <span class="spacer"></span>
  <button class="btn" id="book-add"><span data-icon="add"></span>蔵書を追加する</button>
</div>
```
出典: `library-loan.html:491-496`

- 表側の主ボタンは常に**動作名**（「蔵書を追加する」「貸し出す」）。「はい/いいえ」「次へ」を使わない（`references/components.md:9`）。
- 表示件数変更でページを1に戻す。フッターに現在範囲/総数を併記（`references/components.md:40`）。

### 1-3. 入力フォーム（設定・モーダル）— library-loan.html:529-569

`.field`（ラベル→入力→エラー文の縦順）を `.form-grid` に並べ、保存ボタンは主操作1つだけ最後に置く。

```html
<div class="form-grid">
  <div class="field"><label for="set-days">貸出期間（日）</label><input class="input" id="set-days" type="number" min="1" max="60"></div>
  <div class="field"><label for="set-max">1 人あたりの冊数上限</label><input class="input" id="set-max" type="number" min="1" max="10"></div>
  <div><button class="btn btn--primary" id="set-save"><span data-icon="save"></span>設定を保存する</button></div>
</div>
```
出典: `library-loan.html:533-537`

- モーダルによる小フォーム（貸出登録）は `.modal` + `.modal-body.form-grid`、フッターに「やめる」（`.btn--ghost`）＋主操作（`.btn--primary`）の2つだけ（`library-loan.html:560-569`）。
- エラーは2段構え: 個別フィールド直下 `.field-err-text`、フォーム全体は上部 `.banner-err`（`references/components.md:16-17`）。
- 設定画面は「表側と裏側で地の色を変える」対象（`.app.is-settings`）にできる（`SKILL.md:60`）。

### 1-4. ダッシュボード（KPIカード）— library-loan.html:473-488, demo-shell.html:41-45

```html
<div class="kpi-row">
  <div class="card kpi"><span class="kpi-label">今週のレビュー</span><span class="kpi-value">128</span><span class="kpi-delta up">+12 前週比</span></div>
</div>
```
出典: `demo-shell.html:42-44`

- KPI カードは縦順固定: ラベル（小文字グレー）→ 等幅の大きな数値 → 前回比（小さく、良し悪しは `.kpi-delta.up/.down` の色だけ）。**カードに背景色は塗らない**（`references/components.md:33`、`references/tokens.md`）。
- 延滞や期限超過など業務固有の強調は severity トークンをそのまま流用（`.due-soon{color:var(--color-high)}` `.due-over{color:var(--color-critical);font-weight:700}`、`library-loan.html:428-429`）。新しい色を発明しない。

### 1-5. 文書閲覧（読み物ページ）— 01_利用ガイド.html / 02_操作マニュアル.html

Qiita 風の記事レイアウトで、3パターン（Webアプリ/スライド/管理画面）とは**別ジャンル**として明示的に適用除外（`design-system.md:66-68`）。

- 2ペイン: 左に追従サイドバー目次（`.sidebar` sticky top:80px）、右にメインカラム（`max-width:920〜1240px`）。
- 記事本文はカード化: `.hero`/`.article`（白背景・1px ボーダー・box-shadow・角丸8px）の中に `section` を積む。各 section も同じカード意匠で区切る（`01_利用ガイド.html:43-56`、`02_操作マニュアル.html:94-158`）。
- 見出し階層は3段: `h2`（下線+アイコン、セクション区切り）→ `h3` → `h4`。1画面の見出しレベルは3段まで（`design-system.md:34`）。
- モバイルはサイドバーを隠し `<details class="mobile-toc">` に畳む（`01_利用ガイド.html:127-138`）。
- 章送り: `.chapter-nav`（前へ/次へリンク、次へは強調ボタン）で長い読み物を分割表示する（`02_操作マニュアル.html:563-601`、`section[hidden]` 切替）。

---

## 2. 見た目を決めている要素

| 要素 | 値・方針 | 出典 |
|---|---|---|
| 書体 | 本文/UI = Noto Sans JP 系、コード/数値/ID = JetBrains Mono（`--font-mono`）。既定はシステムフォントスタックのみ、CDN は任意強化 | `tokens.md:57-69` |
| 文字サイズ | 7段階 `--text-xs`(11px)〜`--text-2xl`(28px)。段の間2px以上。1px刻みは「揃っていないだけ」に見える | `tokens.md:30-42`, `demo.html:tokens.css:64-65` |
| 色（地） | `--color-bg`（ページ地・薄灰）/ `--color-surface`（カード・白）/ `-2`（入れ子カード・サイドナビ）/ `-3`（表ヘッダ行） | `tokens.md:11` |
| 色（強調） | プライマリ `#176DC2` 系は操作・選択・リンクにのみ。1画面に「プライマリ＋状態色＋グレー階調」以外を持ち込まない | `tokens.md:10,18` |
| 色（状態） | ISTQB severity 5段 + `-bg` + `-border` の3点セット。medium は文字だけ濃色（`--color-medium-text`）でコントラスト確保 | `tokens.md:14-15` |
| 境界線と影 | **影で語らずボーダーで区切る**。影は浮かせる要素（ポップオーバー・トースト・モーダル）だけ4段階 | `tokens.md:51`, `design-system.md:19` |
| 角丸 | 4段階 sm4/md8/lg12/xl16 + full。内側は外側より小さく。四角い角は作らない | `tokens.md:50` |
| アイコン | Material Symbols 同梱・外部CDN不使用。`<span data-icon="save" data-icon-size="16"></span>` を読み込み後置換、`aria-hidden` | `SKILL.md:81-85`, `library-loan.html:572-699` |
| 主/副ボタン | 塗り（`.btn--primary`）は**1画面に1つ**。それ以外は白地+ボーダー（`.btn`）かテキストボタン（`.btn--ghost`）。破壊操作は`.btn--danger` | `references/components.md:6-11` |
| 余白 | 4pxの倍数のみ。カード内側24px相当、部品間8〜16px相当 | `design-system.md:21`, `tokens.md:49` |
| タッチターゲット | 押せる要素は44×44px以上 | `design-system.md:23`, `tokens.md:53` |

---

## 3. 良い見た目を作っている具体的な手法

**KPIの見せ方** — ラベル小文字グレー→等幅大数値→前回比の縦積み、良し悪しは色だけ。
```html
<div class="card kpi"><span class="kpi-label">未対応の指摘</span><span class="kpi-value">7</span><span class="kpi-delta down">-3 前週比</span></div>
```
出典: `demo.html:54`

**空状態（2用途を区別）** — フィルタ0件と新規データ未作成で文言・ボタンを変える。JS版は`Feedback.emptyState()`。
```js
Feedback.emptyState({ title: 'まだレビュー結果がありません', description: 'URL を登録して最初のレビューを実行すると…',
  action: { label: 'レビューを実行する', onClick: () => {} } });
```
出典: `demo.html:108-110`, `references/components.md:71-75`

**表の密度** — 罫線は横線のみ（縦線なし）、ヘッダ行は薄灰地+太字、数値列は右揃え+等幅、行ホバーで淡ハイライト、読込中は`.skeleton`行。
```html
<td class="num">72</td> ... <span class="skeleton" style="width:40%"></span>
```
出典: `demo.html:64-71`, `components.css`(components/demo.html:225-229,303-304)

**ステップ表示（読み物ページ）** — 番号円＋タイトル太字＋本文、「なぜ」注記を`::before`で自動付与。
```css
.steps > li::before { counter-increment: step; content: counter(step); border-radius:50%; background: var(--accent); }
.why::before { content: "なぜ: "; font-weight:700; }
```
出典: `01_利用ガイド.html:73-81`

**ヒーロー（読み物冒頭）** — カード化した導入部にタイトル・リード文・メタタグ列。
```html
<div class="hero"><h1>…</h1><p class="lead">…</p><div class="tags"><span class="tag">…</span></div></div>
```
出典: `01_利用ガイド.html:218-226`

**段組み比較（Before/After）** — 左右2カラムで「入れる前/入れた後」を対比、左=危険色地、右=好意色地。
```html
<div class="ba"><div class="b"><strong>入れる前</strong>…</div><div class="a"><strong>入れた後</strong>…</div></div>
```
出典: `01_利用ガイド.html:237-250`

**見出し下の説明・階層** — セクションh2に下線+アイコンバッジ、直後に導入文、その後h3細分。1画面3段まで。
出典: `01_利用ガイド.html:56-60`, `design-system.md:34`

**操作フィードバックの一貫化** — `feedback.js`に集約。成功=消えるトースト、失敗=消えないトースト+詳細+次の行動、処理中=`aria-busy`（`disabled`は使わない=値欠落防止）、危険操作=対象名を動的に埋めた確認。
```js
Feedback.error('保存できませんでした', { detail: 'サーバが応答しませんでした。', action: { label: 'もう一度保存する', onClick: () => {} } });
await Feedback.confirm({ title: '…削除する', consequence: '…元に戻せません。', actionLabel: '削除する', danger: true });
```
出典: `demo.html:96-103`, `SKILL.md:64-79`

**モーダルの開閉3経路** — 開くボタン／`.modal-close`／backdrop自身のクリック（`e.target===backdrop`判定）。
出典: `demo.html:104-107`, `references/components.md:58`

**ツールチップの端対応** — 中央揃えが既定だが、サイドバー等の左端では`.edge-left`、右端では`.edge-right`（実不具合由来）。
出典: `references/components.md:53`

---

## 4. design-system.md 再現チェックリスト（そのまま列挙）

出典: `02_共通/ひな形/design-system.md:74-92`

| 項目 | 判定 |
|---|---|
| CSS に直値（`#xxxxxx` / `Npx`）が残っていない（`tokens.css` 以外）。残すなら同じ行に `/* token-exempt: 理由 */` | 機械 |
| `var(--*)` が `tokens.css` に定義されている（打ち間違い・独自トークンが無い） | 機械 |
| アイコン・フォントは同梱で、外部 CDN を読んでいない | 機械 |
| `alert()` / `confirm()` / `prompt()` を使っていない（`feedback.js` を使う） | 機械 |
| 画面が `tokens.css` を読み込んでいる（`<link>` か `<style>` 先頭に貼る） | 機械 |
| `<html lang="ja">`、画像に `alt`（装飾は `alt=""`）、入力欄に `<label>`（か `aria-label`）、アイコンだけのボタン・リンクに `aria-label` がある | 機械（D20〜D23。見出しの飛びは D24 が WARN） |
| 文字色×背景色の対が 4.5:1 以上（大きい文字・UI 部品は 3:1）。対は `contrast-pairs.md` に書く | 機械（D25。ライトとダークの両方） |
| 装飾目的のグラデーション・絵文字のアイコンを使っていない（アイコンは `icons.js`） | 目視（D26・D27 が WARN で知らせる） |
| プライマリ #1976D2 は「操作・選択・リンク」にだけ使われている（装飾に使っていない） | 目視 |
| 本文 Noto Sans JP／数値・コード JetBrains Mono の使い分けができている（ID・スコアが等幅） | 目視 |
| 塗りボタンは1画面1つ。severity 表現はピル型バッジ | 目視 |
| 余白がすべて 4px の倍数で、白カード＋1px ボーダー＋ライト背景の骨格になっている | 目視（直値が無ければ余白は自動的に倍数になる） |
| 360px 幅（キット統一のモバイル検証基準）で崩れない。横スクロールが出ない | 目視（360×820 / 768 / 1366×768 / 1920×1080） |
| ライトとダークの両方で severity の見分けが崩れていない | 目視 |
| すべての操作に結果が返る（成功トースト／消えない失敗＋次の行動／処理中／0 件の空状態／危険操作の確認） | 目視（全状態を実際に起こす） |
| ボタンは動作名。見出しに動詞が無い。「（任意）」が無い | 目視 |
| 破壊的操作の確認に対象名が動的に入っている | 目視 |

---

## 5. 「やってはいけない」とされていること

- CSS に直値（hex色・px）を書く。書くなら `/* token-exempt: 理由 */` を同じ行に付ける（`design-system.md:76`, `SKILL.md`「トークン運用の規律」）。
- `alert()` / `confirm()` / `prompt()` を使う。ブラウザ標準のバリデーションポップアップも不可（`design-system.md:79`, `references/components.md:19`）。
- 外部 CDN からアイコン・フォントを読む（オフライン・閉域網で欠ける。フォントはオンライン前提の社内配布ツールのみ任意で例外）（`SKILL.md:83`, `tokens.md:61-69`）。
- 1画面に塗りボタンを複数置く（`design-system.md:38`, `references/components.md:6`）。
- 状態色（severity）を装飾に転用する（見出しを赤にする等）。未読/既読のような軽い区別も専用色でなく背景濃淡で表す（`tokens.md:19`, `references/components.md:26,69`）。
- 影を多用する／影で意味を語る。境界はボーダーで表現する（`design-system.md:19,38`）。
- 二重送信対策に `disabled` を使う（フォーム値が送信されなくなる）。`aria-busy="true"`+「処理中…」を使う（`references/components.md:11`, `SKILL.md:79`）。
- ツールチップ・情報アイコンを常時表示にする（下の行のクリックを妨げた実不具合）。ホバー/`:focus-visible`のみで表示する（`references/components.md:52`）。
- 破壊的操作の確認文言を一般化する（「〇〇を削除しますか」で対象名を埋めない）（`references/components.md:60`, `design-system.md:92`, チェックリスト）。
- ボタンラベルに「はい/いいえ」「次へ」「OK」を使う。動作名にしない（`SKILL.md`「文言」表, `references/components.md:9`）。
- 見出しに動詞を入れる、「（任意）」を付ける、実装語（button の作り等）を利用者向け文言に書く、同じ意味の2文目を書く（`SKILL.md`「文言」表）。
- 失敗メッセージを「エラーが発生しました」だけで済ませる（何が・なぜ・次に何をするか、が必須）（`SKILL.md:78`, `design-system.md`「文言」表）。
- ヘッダーをサイドバーの上に横断させる構造にする（`SKILL.md:56`）。
- 列ごとの絞り込みと全体検索を1つのUIに混在させる（`references/components.md:39`）。
- 情報ツールチップ・付加要素を「本当に説明が要る項目」以外に乱用する（`references/components.md:34,51`）。
- グローバルバー（`.app-globalbar`）を折り返す実装にする（高さ固定・`white-space: nowrap`が前提。狭幅ではラベルを隠しアイコンのみにする）（`references/components.md:90`）。

---

## 残課題

- library-loan.html の JS ロジック本体（貸出/返却の状態遷移・レンダリング関数）は未読（後半のスクリプト部）。画面構成・CSS・文言規約の抽出には影響なし。
- `design-system.md`「パターン2: HTMLスライド」はSpec2Docの画面タイプ外のため本書では割愛（必要なら追加調査）。
