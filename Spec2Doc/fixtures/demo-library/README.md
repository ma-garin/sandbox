# demo-library（Spec2Doc デモ用サンプル）

図書館の貸出システムを模した小さな Web アプリです。Spec2Doc の解析と文書生成を試すための入力として使います。
サーバは含みません。バックエンドは `js/api.js` から fetch で呼ぶ想定の API だけです。動かすためのアプリではありません。

## 画面

| 画面 | ファイル | 遷移先 |
|---|---|---|
| ログイン | index.html | 蔵書検索・ヘルプ |
| 蔵書検索 | pages/search.html | 貸出・返却・ログアウト |
| 貸出 | pages/loan.html | 返却・延滞一覧 |
| 返却・延滞一覧 | pages/returns.html | 検索・貸出 |

ヘルプ（pages/help.html）へのリンクはあるが、ファイルは置いていない（画面外）。

## API

| メソッド | パス | 呼び出し元 |
|---|---|---|
| POST | /sessions | ログイン |
| GET | /books | 蔵書検索 |
| GET | /members/{id} | 貸出・返却 |
| POST | /loans | 貸出 |
| DELETE | /loans/{id} | 返却 |

共通の送信処理 `requestWithRetry` はタイムアウト 8000ms、再試行 2 回、`!res.ok` と AbortError を扱う。

## 意図的に入れた論点

- 共通の検証（js/validate.js）が 4 画面から呼ばれる: 変更の影響範囲が広く出る
- 貸出可否のデシジョン（js/loan-rules.js）: 会員種別 × 延滞 × 冊数、AND/OR/NOT を含む。延滞料金は 1 日 10 円・上限 500 円
- 境界値: 会員番号 `^M\d{6}$`、ISBN 13 桁、検索語 1〜50 文字、冊数 1〜5、パスワード 8〜32 文字、延滞日数 0〜365
- 状態遷移（js/loan-state.js）: reserved / onLoan / returned / overdue と classList の is-overdue 等
- localStorage のキー: session・recentSearches・loanDraft
- 未参照コード（js/legacy/report.js）: exportMonthlyReport はどこからも呼ばれない。calcAnnualStats は循環的複雑度が 10 を超える。大域変数 window.LIB_CONFIG
- 画面外へのリンク（pages/help.html が存在しない）
- 動的な呼び出し（js/legacy/report.js の renderReport）: 形式名で関数を選ぶ `renderers[format](stats)` と `import()` の遅延読み込み。呼び出し先を静的解析で確定できず、D08「静的解析の限界」に出る
- HTML の制約（maxlength・pattern・min/max）と JS の検証が二重にある。冊数の上限は HTML が 5、職員の上限は 10 で食い違う
- innerHTML に API の値をそのまま入れている箇所（returns.js）
- 共通の送信処理を経由する呼び出し（js/api.js）: メソッドは呼び出し側のオプションで渡し、URL の途中はテンプレートリテラルで実行時に決まる（`/members/${encodeURIComponent(id)}`・`/loans/${encodeURIComponent(id)}`）
