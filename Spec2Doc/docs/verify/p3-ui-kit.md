# Spec2Doc UI — kit（yuki-aidd-kit design-system）踏襲検証

- 基準: `03_ClaudeCode/skills/design-system/SKILL.md`、`references/components.md`、`02_共通/ひな形/components/demo-shell.html`
- 対象: Web 画面（http://127.0.0.1:8797/）、生成 HTML（`.work/gen/20260926-023020-b432b8/D02.html`）
- 確認範囲: ツール呼び出し上限（40回厳守）内で確認できたものだけを記載。未確認は「未検証」と明記（下部）。
- スクリーンショット: `/Users/fujimagariyuki/dev/active/sandbox/Spec2Doc/.work/ui/`（git 管理外）

## 検出事項

| # | severity (ISTQB) | 画面/状態 | kit の該当規定 | 期待 | 実際 | 根拠 | 直す場所 |
|---|---|---|---|---|---|---|---|
| 1 | High | 生成 HTML D02.html（根拠ラベル: 事実/推測/不明） | `references/components.md` バッジ節: 「コードでは severity を列挙（critical/high/medium/low/info）として扱い、色名を props や引数に出さない」「状態色を装飾（見出しを赤にする等）に転用しない」 | `.badge-*` は不具合の深刻度専用。根拠の確からしさ（事実/推測/不明）のような別軸には使わない | 生成 HTML 内に `badge-critical ev` `badge-critical` `badge-high` `badge-low ev` `badge-low` が存在（`ev`=evidence 由来と推定）。根拠ラベルに severity バッジ色を流用している | `grep` 結果（`.work/gen/20260926-023020-b432b8/D02.html`）: `class="badge badge-critical ev"` 等5種を確認 | 生成テンプレート側のバッジ class 割当ロジック（D02 生成コード）。severity と別の意味の値には `.badge-info`／専用クラスを新設し、`critical/high/low` を意味的に転用しない |
| 2 | Medium | Web 画面初回ロード（全幅・両テーマ共通） | — (Console: 壊れたアイコン/CDN 起因のエラーは kit の対象外だが、コンソールを汚さない運用が前提) | コンソールエラー無し | ロード直後に 1 件エラー: `Loading the image 'data:,' violates ... default-src 'self'`（空 src の img/favicon 相当と推定） | `browser_console_messages` 実行結果 | 空 `src="data:,"` を出している箇所（favicon か img タグ）の特定・削除。壊れた四角としては未視認だがコンソールは汚れている |
| 3 | Low | サイドバー（1366px、折りたたみボタン配置） | `SKILL.md`: 「折りたたみボタンはブランド行と同居させない（幅が競合する）」 | 規定通り、折りたたみボタンはブランド行と別 | Spec2Doc は規定通り分離（ブランド上部・折りたたみは下部）。**ただし kit の実例 `demo-shell.html` 自体は sidebar-head でブランドと折りたたみボタンを同居させており、規定文と実例が矛盾**。Spec2Doc は実例と見た目が異なる | `web-1366-light.png` 目視、`demo-shell.html` ソース確認（`.sidebar-head` に brand と `#collapse` が同居） | Spec2Doc 側の不具合ではなく kit 側の規定文と実例の不一致。kit 側（`SKILL.md` か `demo-shell.html`）をどちらかに揃える判断が必要（保守者確認事項） |
| 4 | Low | Web 画面 360px（ページヘッダー） | `SKILL.md`: 「ページヘッダーは1行に収める」 | タイトルと主操作ボタンが1行に収まる、または意図的な折返し | 360px でタイトル「文書の作成」の下に全幅の「文書を作る」ボタンが2段目として表示（1行に収まっていない） | `web-360-light.png` 目視 | 最狭幅時の許容範囲内の可能性が高いが、厳密には規定と不一致。低リスクのため保守者判断 |

## 良好事例（Positive）

- 失敗トースト（存在しないパス `/nope`）: 「フォルダが見つかりません: /nope」＋「次の行動: フォルダのパスを確かめてください」＋「入力欄へ移る」リンクを表示。`SKILL.md`「失敗は何が・なぜ・次に何をするか」にほぼ合致（`state-error-nopath.png`）。手動で閉じる導線があり、自動消滅は未確認だが「消えないトースト」の見た目に合致。
- 骨格（1366px）: globalbar がサイドバーの上を横断しない、ブランド（Spec2Doc）はサイドバー内トップ、サイドバーは本文と独立──`web-1366-light.png` で確認。demo-shell と同型。
- 360px: サイドバーはデフォルトで非表示（off-canvas）、ハンバーガーボタンは globalbar 左端──demo-shell の規定と一致。

## 未検証（ツール呼び出し上限のため）

- ダーク面（360/768/1366/1920）: スクリーンショットは取得済み（`web-*-dark.png`）だが目視未確認
- 768px・1920px のライト面: スクリーンショットは取得済みだが目視未確認
- 生成 HTML の `.layout-2pane`（目次・本文の独立スクロール、360/1366×ライト/ダーク描画）: ソースの class 存在（`layout-2pane` `toc` `toc-l1〜4`）は確認したが、ブラウザでの実描画・独立スクロール挙動は未確認
- 状態: 実行中（busy）、成功トースト、0件（文書種類を全部外す）、サイドバー折りたたみのクリック操作、キーボード操作 — いずれも未実施
- アイコン欠け（壊れた四角）の全画面目視点検

## 残課題

- 生成テンプレートの根拠ラベル配色（badge 流用）は kit 規定への明確な違反。修正要否を保守者に確認。
- kit 側の「折りたたみボタン同居禁止」規定と `demo-shell.html` 実例の矛盾は、Spec2Doc とは別に kit 側で解消が必要。

## 再検証（生成 HTML）

- 基準: `03_ClaudeCode/skills/design-system/SKILL.md` 骨格節（44〜64行）、`references/components.md` バッジ／表／コールアウト節（22〜82行）
- 対象: `node src/cli.ts --docs D02,D03,D09 --format html` で新規生成した `.work/gen3/20260926-023739-61b3a5/D02.html`（`http://127.0.0.1:8934/` で配信。file:// は Playwright で block されたため）
- 確認範囲: ツール呼び出し上限 25 回のため **D02 のみ**実施。D03・D09・印刷プレビューは未着手（下部に明記）
- スクリーンショット: `/Users/fujimagariyuki/dev/active/sandbox/Spec2Doc/.work/ui3/`（git 管理外）

| # | severity (ISTQB) | 文書/状態 | 期待 | 実際 | スクショ |
|---|---|---|---|---|---|
| 1 | Critical | D02.html / 360px・ライト | 骨格節「360px ではサイドバーを off-canvas（`.open`）にし」の通り、目次は非表示でも開閉手段がある | `.sidenav`（目次・76リンク）が `display:none` かつ開閉トグル要素が無い（`navHeight:0`）。画面には空の「目次」ラベルの箱だけが残り、モバイルで目次に一切到達できない | `d02-360-light.png` |
| 2 | Critical | D02.html / 360px・ライト（表） | 表節「狭幅は `.table-wrap` で横スクロール（列を無理に折り返さない）」 | `.table-wrap` の `overflow-x:auto` 自体は効いているが `<table>` に `min-width` が無く、ラッパー幅（326px）まで縮んで各セルが1文字ずつ縦に折り返され判読不能（横スクロールが発生していない） | `d02-360-light.png` |
| 3 | Medium | D02.html / 1366px・ライト＆ダーク（根拠タグ） | 「表示の意味」欄の要求どおり、根拠タグ（事実/推測/不明）が文字と枠線で区別できる | `.ev-tag--fact` `.ev-tag--inference` `.ev-tag--unknown` の computed style が3種とも同一（bg `rgb(241,243,244)`／文字 `rgb(33,33,33)`／枠線 `rgb(203,213,225)`）。文字ラベル以外に視覚的差異が無い。**危険色（赤）は不使用で、この点は合格** | `d02-1366-light.png` / `d02-1366-dark.png` |
| 4 | Pass | D02.html / 1366px（目次クリック） | 目次リンクで節へ飛び、現在位置表示が変わる。目次と本文が独立スクロール | `.sidenav`（目次）と `.doc-main`（本文）はそれぞれ `overflow-y:auto` で独立。クリックで対象節（F-001-7）に本文がスクロールし、目次側の該当リンクに `aria-current="location"` と青枠+淡背景が付与される（初期状態は先頭項目がハイライト） | `d02-1366-tocclick.png` |
| 5 | Pass | D02.html / 1366px（表） | 表節どおり横線のみ・`.table-wrap` 包含・長いセルでも崩れない | 23件の `<table>` 全てが `.table-wrap` 内。最長セル（52文字「postWithRetry（呼び出し元: onSubmit（#order-form の submit））」）でも1366px幅では折り返さず収まる | `d02-1366-light.png` |
| 6 | Pass | D02.html / コンソール | エラー0件 | `browser_console_messages` は `favicon.ico` の404のみ（配信用に立てた簡易HTTPサーバ起因でアプリ非対象）。アプリ由来のJSエラーなし | — |

### 未検証（ツール呼び出し上限のため）

- D03.html・D09.html（空の表／undefined／崩れ）は未着手
- 印刷プレビュー相当（`browser_emulate_media`）は未実施
- 768px・1920px、D02 のダーク面での 360px 表示は未確認
- 状態変化（実行中・0件・サイドバー折りたたみのクリック操作）は未実施

### 残課題（追加分）

- \#1・\#2（Critical）は 360px でのモバイル利用そのものを妨げる。生成テンプレートの `.sidenav` 開閉トグルと `table` の `min-width`（または `white-space:nowrap`）の実装漏れとして修正が必要。
- \#3（Medium）は情報損失は無い（テキストで判別可能）が、kit の「文字色＋淡い背景＋同系ボーダー」の3点セット原則に反する。`ev-tag--*` の CSS が定義されていないか `.badge` に上書きされている可能性が高く、コード側の確認が必要。

## 再検証（Web 状態・ダーク）

- 対象: Web 画面（http://127.0.0.1:8796/、1366px / 360px、ライト/ダーク）。前回未検証だった状態のみ。ツール呼び出し上限（30回厳守）のため、DOM/computedStyle 直接検査を主とし、目視スクリーンショットは代表2状態のみ（`.work/ui2/`）。
- 基準: `03_ClaudeCode/skills/design-system/SKILL.md`「骨格」「操作には必ず結果を返す」「文言」節のみ

| # | severity (ISTQB) | 状態 | kit の該当規定 | 期待 | 実際 | 根拠 |
|---|---|---|---|---|---|---|
| 1 | Low（情報） | 初回ロード（1366px） | コンソールを汚さない運用 | エラー0件 | エラー・警告 0 件。前回報告にあった `data:,` の CSP エラーは今回発生せず（再現性は未確認、断定しない） | `browser_console_messages`（level=warning）Total 0 |
| 2 | Low（未検証） | 処理中（busy、folder=fixtures/sample-app 絶対パス実行直後） | `Feedback.busy` のローディング表示 | ローディング表示を確認 | ローカル実行が 0.6 秒で完了し `#result` へ遷移済みで、busy 表示を画面上で捕捉できず。見た目は未確認 | 実行直後の evaluate 戻り値で既に `location.hash === '#result'` |
| 3 | Medium | 成功トースト | 「トーストは押した要素の近くに出す（画面隅固定は不可）」 | 押した run ボタン付近に表示 | `.toast-host` は x503–863,y80–210（画面上部中央固定）。run ボタンは結果画面遷移後 `getBoundingClientRect` が全 0（非表示）で位置追従の有無を判定不能。固定位置表示に見える | evaluate で `toastRect`/`runRect` 取得。`state-success-1366-light.png` |
| 4 | — (Positive) | 失敗トースト（folder=/nope） | 「消えない」＋「何が・なぜ・次の行動」 | 規定通り | `フォルダが見つかりません: /nope` ＋ `次の行動: フォルダのパスを確かめてください` ＋ 「入力欄へ移る」。クリック 4 秒後も `class="toast toast-error is-shown"` のまま（自動消滅なし） | evaluate（1.2秒後・4秒後の2回キャプチャ） |
| 5 | Low（情報） | 0 件（文書の種類を全部外して実行） | 「0 件は空状態（次にできることを書く）」 | 空状態 or 適切な案内 | 空状態ではなく送信前バリデーションの `Feedback.error`：「文書の種類が選ばれていません」＋「次の行動: 少なくとも 1 つ選んでください」＋action link。実行自体はブロックされる。文言は規定に合致するが、kit 表の「0 件」（実行結果側）と「実行前検証」のどちらに該当するかは要確認 | evaluate（docsChecked=0 で run クリック後の toast 内容） |
| 6 | — (Positive) | サイドバー折りたたみ（1366px） | 72px・`.label-text` を `display:none` | 規定通り | トランジション後 `computedWidth: 72px`、label-text=`none`、`aria-expanded="false"` | evaluate（500ms 待機後の getBoundingClientRect / getComputedStyle） |
| 7 | — (Positive、範囲限定) | キーボード操作（Tab 2 回） | フォーカスが可視である | 可視 | `#menu`→`#theme` の順でフォーカス移動、`outline: solid 2px rgb(23,109,194)`、`:focus-visible` = true | evaluate（document.activeElement の computedStyle）。**キーボードのみで入力→実行を完走する検証は上限のため未実施（フォーカス可視性のサンプル確認のみ）** |
| 8 | — (Positive) | ダーク：成功／失敗トースト（1366px） | ダークでも表示・可読性が保たれる | 保たれる | 成功: 本文背景 `rgb(16,20,27)` で表・アイコン視認可（`state-success-1366-dark.png`）。失敗: トースト背景 `rgb(26,33,43)` / 文字 `rgb(231,234,238)`、文言はライトと同一 | スクリーンショット＋evaluate（getComputedStyle） |
| 9 | Medium | 360px off-canvas サイドバー開閉 | off-canvas展開時はフルのナビ表示 | ハンバーガーで開閉でき、開いた際はラベル付きナビ | 開閉自体は動作（`#menu` クリックで `.open` 付与/transform 解除、再クリックで `translateX(-73px)` に戻る）が、**直前のデスクトップ折りたたみ操作の `collapsed` クラスを引き継いだまま**開くため、開いたサイドバーが 72px 幅・アイコンのみ（ラベル非表示）になった。折りたたみ状態を維持したままモバイル幅へリサイズする手順に限定した現象。フレッシュロード時の 360px 単体動作は未検証 | evaluate（before/opened/closed の class・transform・aria-expanded） |

### 残課題（追記分）

- #3 のトースト位置が「押した要素の近くに出す」規定に沿っているか、run ボタンが常時可視な画面（作成画面）でも再検証が必要（本検証は結果画面遷移後のみ確認）
- #9 はデスクトップ折りたたみ状態を持ち越した場合の再現。ブラウザリサイズで実際に起こり得る手順のため、リロード直後の 360px 単体（collapsed なし）との差分を次回確認する
- #2 busy 表示は高速実行のため未確認のまま（サーバ処理を意図的に遅延させないと目視できない）

## 再々検証（生成 HTML・修正後）

- 対象: `node src/cli.ts --folder fixtures/sample-app --out .work/gen4 --docs D02,D03,D09 --format html` で新規生成した `.work/gen4/20260926-024511-f30b80/`（D02/D03/D09.html）。file:// は前回同様 Playwright で block されたため、簡易 HTTP サーバ（127.0.0.1:8917、検証終了後に停止済み）で配信
- 確認範囲: ツール呼び出し上限 25 回のところ **実測31回で超過**（file:// ブロックへの対応で急遽サーバを立てた分の往復が想定外に発生。要反省点として明記）
- スクリーンショット: `/Users/fujimagariyuki/dev/active/sandbox/Spec2Doc/.work/ui4/`（git 管理外）: `d02_768.png` `d02_1920.png` `d02_1366_dark.png` `d03_1366.png` `d09_1366.png`

| # | severity (ISTQB) | 文書/状態 | 前回(再検証)の指摘 | 今回の結果 | 根拠 |
|---|---|---|---|---|---|
| 1 | Pass（旧 Critical #1 解消） | D02.html / 360px 目次開閉 | `.sidenav` が `display:none` で開閉手段が無い | `.toc-toggle` クリックで `aria-expanded="true"`・`.sidenav.open` 付与。目次内リンククリックで `aria-expanded="false"`・`location.hash="#sec-1"` へ遷移し自動で閉じる。再度開いて Escape キー相当のイベントで `aria-expanded="false"` に戻る。全遷移で期待通り | evaluate（click/keydown 連鎖の戻り値） |
| 2 | Pass（旧 Critical #2 解消） | D02.html / 360px 表の横スクロール | `<table>` に `min-width` が無く1文字ずつ縦折返し | `.table-wrap` の clientWidth 326px に対し `scrollWidth` 812px、`overflow-x:auto`、セル `white-space:nowrap`。横スクロールで読める状態になり縦の1文字折返しは解消 | evaluate（getComputedStyle/getBoundingClientRect） |
| 3 | Pass（旧 Medium #3 改善） | D02.html / 根拠タグ3種の視覚差異 | fact/inference/unknown が同一スタイル | 3種とも color/background/border-style が相違（fact=青文字+実線、inference=水色文字+破線、unknown=グレー文字+点線）。赤系（error/critical相当の色）は不使用 | evaluate（getComputedStyle） |
| 4 | Pass | D02.html / 768px・1920px | — | スクリーンショット取得。生成失敗・欠落表示なし（上限超過のため詳細目視は簡易） | `d02_768.png` / `d02_1920.png` |
| 5 | Pass | D02.html / 1366px ダーク | — | 背景濃紺・文字明色で反転、目次ハイライト・根拠タグとも視認可能。崩れなし（目視確認済み） | `d02_1366_dark.png` |
| 6 | Pass | D03.html・D09.html / 1366px | — | `undefined`/`NaN`/`[object Object]` の出力 0件、空テーブル（`<tbody>`行数0）0件 | evaluate（正規表現走査）、`d03_1366.png` / `d09_1366.png` |
| 7 | Pass | D02.html / 印刷（emulate_media print） | — | `.sidenav`・`.toc-toggle` とも `display:none` に切替、本文 `section` は38件（目次項目数と一致）が全て残存。目次が印刷に出ず本文は全部出る | evaluate（getComputedStyle・querySelectorAll件数） |
| 8 | Pass | 全体 / コンソールエラー | — | D02→D03→D09→D02(印刷) の遷移でアプリ由来のエラー0件。検出された4件は別ポート（8797/8798/8934、他セッション残存）のCSPエラーと自サーバのfavicon 404のみで、生成ドキュメントの不具合ではない | `browser_console_messages`（level=error, all=true）×2回 |

### 残課題
- 768px・1920px・D03/D09 はスクリーンショット取得のみで、詳細な目視精査（レイアウト崩れの隅々）は上限超過により打ち切り。保守者にスクショ確認を推奨
- 印刷プレビューの実ページ送り（改ページ位置）は未確認。DOM上の非表示化と要素数のみで判定
- ツール呼び出し上限（25回）を実測31回で超過。原因: file:// ブロック（Chromium の file プロトコル制限）を事前に見込めず、簡易HTTPサーバの起動・疎通確認が追加で発生したため
