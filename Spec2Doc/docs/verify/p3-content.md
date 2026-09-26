# P3 内容検証 — Spec2Doc 生成仕様書の壊れている箇所

対象: `out/20260925-142039-33847d/D01〜D09・D11・D12`（.md）
正解: `fixtures/sample-app/`（app.js・index.html・style.css・types.ts・package.json）
検証方法: ソースの読み込み・突き合わせ、および `node -e` によるロジックの再現実行（E-012 の到達可能性）。確かめられたものだけを記載し、確認していない推測は「未検証」と明記する。

## 件数サマリ

| severity | 件数 |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 5 |
| Low | 2 |
| 合計 | 13 |

## 指摘一覧

| # | severity | 文書・節 | ソース位置 | 期待（ソースの実際） | 実際（文書の記載） | 直す場所の推定 |
|---|---|---|---|---|---|---|
| 1 | Critical | D03 §2 画面遷移（`S-001\|P-001\|order-form の送信`、`S-001\|P-009\|予約する の押下`） | index.html:12,36 / app.js:136-137 | `<form action="#">` だが `onSubmit` 冒頭で `event.preventDefault()`（app.js:137）を呼んでおり、フォーム送信・送信ボタン押下では**ネイティブ遷移は発生しない**（非同期 fetch のみ）。ボタン押下（P-009）は submit イベントの一部であり、独立した遷移でもない | 「遷移先画面ID: （画面外）／遷移先の指定: #」として 2 行、あたかも画面外へ遷移するかのように記載 | analyze（HTML の `action` 属性だけを見て、同ファイル内の JS の `preventDefault` 呼び出しを突き合わせていない） |
| 2 | Critical | D05 §連携の組・D09-39／D09-40 と D11 §非機能の実装方式（同じ TIMEOUT_MS・MAX_RETRIES） | app.js:5-6（`const TIMEOUT_MS = 5000`／`const MAX_RETRIES = 3`） | `const` 宣言のトップレベル定数であり、設定ファイル読み込みは無い。REQ-F-034 の定義に従えば明確に「固定値」 | D05: 「5000 ms・固定／設定不明（D09-39）」「3 回・固定／設定不明（D09-40）」と書き、D09 に「設定で変えられる値か固定値かを確定できない」という確認事項を起票。**同じ事実を D11 §非機能の実装方式は「固定値（app.js:5）」「固定値（app.js:6）」と断定** — 同一ソース事実について D05/D09 は「不明」、D11 は「事実（固定）」と文書間で矛盾 | analyze（D05 生成側が `const` 判定ロジックを持たず不要に不明扱いしている。D11 側の判定が正しい） |
| 3 | High | D02 各機能の §-4 入力値の範囲／境界（F-002・F-003・F-004 いずれも同一の P-002〜P-007 一覧） | app.js:98-104（onCalcClick）, :24-27（change handler） | onCalcClick は `age`・`qty` の 2 項目しか読まない（app.js:100-101）。change ハンドラは `ticketType` しか扱わない（app.js:24-27）。氏名・メール・クーポンの境界はどちらの関数にも無関係 | F-002-4・F-003-4 に、氏名 40 文字／メール pattern／クーポン 8 文字など、その関数が一切使わないフィールドの境界まで機械的に列挙 | analyze または render（「画面 S-001 に属する全フィールド」をそのまま各関数の入出力節に複製しており、関数が実際に参照する変数で絞り込んでいない） |
| 4 | High | D02 F-004-6／D08 ERR-app.js-postWithRetry-throw-L133／D12 例外処理表（E-012「通信がタイムアウトしました」） | app.js:113-134（`postWithRetry`） | `node -e` で持続的タイムアウト（毎回 AbortError）を模擬した結果、ループは必ず `retryCount === MAX_RETRIES` の分岐で `throw err`（= AbortError そのものを再送出）して終了し、133 行目の `throw new Error('通信がタイムアウトしました')` には**到達しない**（到達不能コード） | 「発生条件: postWithRetry の実行時（条件分岐なし）」として、あたかも通常到達するエラーであるかのように記載。テスト設計者がこの文言をエラーメッセージ確認のテスト条件に使うと再現できない | analyze（到達可能性解析をしておらず、関数末尾の throw を単純に「無条件で発生」と分類している） |
| 5 | High | D02 §1 機能一覧・D01 §2 モジュール構成（app.js 関数 15 件のうち F-ID 付きは 4 件のみ） | app.js 全体（`calcPrice`・`validate`・`makeReservationNo`・`postWithRetry`・`setState`・`showError`・`clearError`・`exportCsv`・`render` など） | REQ-F-006 は「モジュール・関数・クラス」の網羅的抽出を要求。D01 は「関数 15 件」と数えている | D02 §1 の「機能一覧」表（機能ID 付き）は DOM イベントハンドラ 4 件（init/change/onCalcClick/onSubmit）だけで、残り 11 関数は独立した機能IDを持たない（一部は D02 の各機能の入れ子節に断片的に現れるのみ、setState/showError/clearError/render/exportCsv はどこにも機能として現れない）。テスト設計者が「機能一覧」だけを見ると 4 機能しか認識できない | analyze（機能=DOMイベントハンドラという前提で機能一覧を作っており、内部関数を機能として扱っていない） |
| 6 | Medium | D02 各所 boundary 表・D09-1／D09-23〜26／D09-42（3 系統で同一事実を重複記録） | index.html:20,23 | age/qty の HTML min/max 属性の「単位不明」は 1 つの事実 | D09-1（4 項目まとめて 1 件）、D09-23〜26（同じ 4 項目を 1 件ずつ、計 4 件）、D09-42（UNK-SCR-index_html-unit として再度 1 件）の **3 系統・計 6 件**で同一の「年齢/数量の単位不明」を別 ID として重複起票。件数をそのまま数えると確認事項が水増しされ、REQ-N-007 の「推測が要った箇所を D09 に記録」の集計にも影響しうる | generate（D09 の重複排除・統合ロジックが無い） |
| 7 | Medium | D05 §連携の組（1 行の「根拠」列） | app.js:118-123 | 事実として確定できる項目（方向・方式・接続先・データ形式・応答形式・異常条件）が複数ある | 行全体の根拠タグが「不明（app.js:118-123, app.js:118-123, app.js:118-123。D09-39）」と、**同一位置を 3 回重複列挙**した上で「不明」1 本にまとめている。REQ-F-017 は記述ごとに事実/推測/不明を 1 つ付ける規定だが、複数の事実混在行に単一の不明タグを付けるのは記述単位の粒度が粗い | generate（根拠位置の重複排除、タグの記述単位の見直し） |
| 8 | Medium | D02 F-004-4（qty の境界行が 2 種類: 「upper 10」と「upper 1」） | app.js:92（`qty<1\|\|qty>10`）, app.js:94（`ticketType==='annual' && qty>1`） | qty の一般上限は 10、ただし annual 券のときだけ 1（条件付き） | 表に「qty\|qty\|upper\|10\|含む」と「qty\|qty\|upper\|1\|含む」が条件列なしで併記され、qty の上限が 10 なのか 1 なのか一見矛盾して見える。94 行の条件（`ticketType==='annual'`）が表のどの列にも出てこない | render（境界表に「適用条件」列が無い。analyze 側でも条件を保持していない可能性） |
| 9 | Medium | D02 F-001-5・D04 状態遷移表（state の遷移が全て `遷移元: *`） | app.js:17-171 全体 | `init()` は `document` の `DOMContentLoaded` で一度だけ実行される（app.js:171）。done/error 状態から idle に戻す処理はソース中に無い | 遷移表は遷移元を一律「*」とし、「idle への遷移は起動時の 1 回のみで、done/error から idle へ戻る経路が無い」という事実が読み取れない。REQ-F-011 が要求する「状態ごとに受け付ける操作」の記載も無い | analyze（遷移元を具体化しない設計。状態ごとの受理操作は未実装） |
| 10 | Medium | D04 データ項目定義（`DATA-app.js-localStorage-reservations`） | app.js:145-154（`localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved, reservation]))`）, types.ts:2-7（`Reservation` interface） | localStorage の `reservations` キーの値は `Reservation[]`（4 項目のオブジェクト配列）で、その構造は同じ D04 内の `DATA-types.ts-interface-Reservation` と一致する | `DATA-app.js-localStorage-reservations` 行は 項目/型/桁/必須が全て「—」で、`Reservation` interface への相互参照が無い。テスト設計者は localStorage の値構造を D04 だけから復元できない | analyze／render（localStorage 値の型推論と type 定義への ID 相互参照が未実装） |
| 11 | Low | D02 F-003-3（onCalcClick の境界値行、age threshold 65 の「単位不明」重複） | app.js:71 | age>=65 は 1 箇所の条件 | 同一条件（app.js:71 の `age>=65 && !isWeekend`）から `BND-app.js-age-threshold-L71`（age<13 側）と `BND-app.js-age-threshold-L71-2`（age>=65 側）の 2 つの境界IDを切り出す一方、D09 側でも D09-3/D09-4/D09-30/D09-31 のように行ごとに別々の確認事項を起票しており、指摘6と同種の細分化が広範に見られる（指摘6の派生。個別の severity 加算はしないが件数として把握） | generate |
| 12 | Low | D02 §5 動作環境／D01 §1（言語一覧に「JSON」を含める） | package.json:1 | package.json はメタデータ（依存宣言）であり、アプリの「動作環境（対応言語）」としての言語ではない | 「解析した言語: css、html、javascript、json、typescript」として JSON を対応言語と並列表記。読み手が「JSON も解析対象の実行言語」と誤解しうる | render（言語一覧とファイル種別一覧の区別なし） |

## 詳細（Critical/High の根拠）

- **#1（D03 画面遷移）**: `index.html:12` の `<form id="order-form" action="#">` と `app.js:136-137` の `async function onSubmit(event) { event.preventDefault(); ... }` を突き合わせると、フォームの `action` 属性は JS が `preventDefault` するため実行時には使われない。D03 の画面遷移表はこの `preventDefault` を無視し、HTML の静的属性だけから「画面外（#）へ遷移する」と誤った 2 行を生成している。実際に画面外へ遷移するのは `P-013`（`help-link`、`href="help.html"`）の 1 行のみ。
- **#2（D05/D09 と D11 の矛盾）**: `app.js:5-6` の `const TIMEOUT_MS = 5000; const MAX_RETRIES = 3;` はファイル冒頭のトップレベル `const` であり、設定ファイル読み込みを示すコードは存在しない。D11 §非機能の実装方式はこれを正しく「固定値」と記載しているのに対し、D05・D09（D09-39/D09-40）は同じ値を「固定か設定か確定できない」として確認事項に回しており、文書間で断定と不明が食い違う。
- **#4（E-012 到達不能）**: `node -e` で `postWithRetry` のループ制御構造を再現し、常時 `AbortError` を発生させるケースを模擬した結果、4 回目の試行（`retryCount === MAX_RETRIES`）で必ず内部の `throw err`（AbortError の再送出）が発生し、ループ後方の `throw new Error('通信がタイムアウトしました')`（133 行目）には到達しないことを確認した（実行結果: `{ result: 'thrown', errName: 'AbortError', attempts: 4 }`）。

## 対象外・未検証

- D08 の後半（記述数の総数などの集計値）、D02 の途中省略部分は精読していない（ページ制限のため）。個別の数値集計の正誤は未検証。
- D11/D12 の非機能実装方式の網羅性（REQ-F-038 の「非機能の実装方式」の抜け漏れ）は今回の観点1〜4に沿って表面的に確認したのみで、深掘りはしていない。
