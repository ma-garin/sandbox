# QualityForward API 要点メモ

出典: ユーザー提供のOpenAPI 3.0.3定義（`https://qualityforward.github.io/api-spec/` の元データ）。
このアプリ(`src/client.js`, `src/labels.js`)の設計根拠として、実装時に判明した仕様上の注意点をまとめる。

## 基本

- ベースURL: `https://cloud.veriserve.co.jp/api/v2`
- 認証: `Authorization: Bearer <project_api_key>`（プロジェクト単位のAPIキー）。後方互換で`?api_key=`クエリも可だがBearer推奨。
- レート制限: 1秒1リクエスト・日次約3000・月間約10万。超過時は429。
- 一覧系エンドポイントにページネーション・検索クエリパラメータは**存在しない**（全件取得してクライアント側でフィルタする前提）。

## リソースの親子関係（IDのネスト）

```
test_suites/{id}
  └ test_suite_versions/{id}
      └ test_cases/{id}          (category1..25, priority A-J)

test_phases/{id}                 (start_on/end_on必須、作成時にtest_suite_version_ids必須)
  └ test_suite_assignments/{id}  (test_suite_version_idのみ保持、test_suite_idは含まれない！)
      └ test_cycles/{id}
          └ test_results/{test_case_no}  (content1..10)
      └ multi_test_cycles/{id}（今回未実装）
  └ bug_count_snapshots/bulk_create（書込み専用、GET/一覧なし）
```

**重要な罠**: `test_suite_assignments`のレスポンスは`test_suite_version_id`と`test_suite_version_name`/`test_suite_name`しか含まず、`test_suite_id`（数値）を直接持たない。テストケースのcontentラベルを解決するには、全テストスイート→全バージョンを横断して`test_suite_version_id`が一致するスイートを探す必要がある（`views/execution.js`の`resolveSuiteForVersion`が実施）。

## result フィールドの非対称性（要注意）

- **書込み**（POST/PATCH `test_results`）: `result`は数値 `1-7`（PASS/FAIL/SKIP/CUT/BLOCK/N.A/Q&A）。
- **読込み**（GET `test_results`）: `result`は小文字文字列 `"pass"|"fail"|"skip"|"cut"|"block"|"na"|"qa"`。

同じ意味なのに型が異なる。`src/labels.js`の`buildResultLabelMap`（数値キー、フォーム用）と`buildResultStringLabelMap`（文字列キー、表示用）で吸収している。

## ラベル解決の階層

- テスト結果ラベル（PASS/FAIL等の表示名）: **プロジェクト単位**（`GET /current_project`の`label_pass`等）
- カテゴリ/コンテントラベルと使用可否: **テストスイート単位**（`label_categoryN`/`use_categoryN`、`label_contentN`/`use_contentN`）。プロジェクトの`default_label_categoryN`は新規スイート作成時の既定値であり、既存スイートの実際のラベルではない。

## POSTの「入力・上書き」(upsert)動作

`POST test_results`は仕様上「テスト結果入力・上書き」であり、同一`test_case_no`への再送信で上書きされる（別途PATCHを呼ぶ必要はない）。`updateTestResult`(PATCH)・`deleteTestResult`(DELETE)は個別の更新/削除用に別途用意している。

## 「課題(Issue)管理」はAPI非対応

個々の不具合チケットのCRUDエンドポイントは存在しない。唯一関連するのは`POST /test_phases/{id}/bug_count_snapshots/bulk_create`（OPEN/CLOSE件数の日次スナップショット登録）で、これも**GET/一覧が存在しない書込み専用API**。そのため`views/bugcounts.js`は登録した履歴をこのブラウザのlocalStorage（`qf-renkei.bugCountHistory.v1`）にのみ保持している。他ブラウザ・他端末とは共有されない点に注意。

## 自動テスト対象外にしていること

- 実際の`cloud.veriserve.co.jp`への疎通（サンドボックス用の実キーが無く、月間10万リクエストの割当を消費しない）
- 実ブラウザでのCORS挙動（唯一人手で確認する必要がある。ブロックされた場合はGitHub Pagesが静的ホスティングのみのため、Cloudflare Workers等の薄いプロキシ導入を検討する）
- 見た目のCSS・SVGの描画結果そのもの（データ→グラフの変換ロジックのみテスト対象）
