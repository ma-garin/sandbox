# パイプライン仕様（11ステージ）

各ステージは `core/stages/`（または `connectors/`）の純粋関数として実装され、
`core/pipeline.js` が `STAGE_ORDER` の順に連結する。入力は前段成果物、出力は次段入力になる。

| # | stage キー | 名称 | 入力 | 主な出力 | 実装 |
|---|---|---|---|---|---|
| 1 | `ingest` | ドキュメント取込 | sources(text/url/apk) | sections, requirements | `stages/ingest.js` |
| 2 | `featureAnalysis` | テストフィーチャー分析 | doc | features(機能/非機能) | `stages/feature-analysis.js` |
| 3 | `modelAnalysis` | テストモデル分析 | features, doc | models(技法選定) | `stages/model-analysis.js` |
| 4 | `designBasic` | テスト設計(基本) | models, features, doc | conditions(テスト条件) | `stages/test-design.js` |
| 5 | `designDetail` | テスト設計(詳細) | conditions | coverageItems | `stages/test-design.js` |
| 6 | `caseHigh` | テストケース(ハイレベル) | coverageItems | 論理テストケース | `stages/test-case.js` |
| 7 | `caseLow` | テストケース(ローレベル) | 論理ケース | 具体テストケース+データ | `stages/test-case.js` |
| 8 | `script` | テストスクリプト作成 | 具体ケース, doc | gherkin/playwright/appium | `stages/test-script.js` |
| 9 | `execution` | テスト実行 | 具体ケース | 実行結果(既定simulated) | `stages/test-execution.js` |
| 10 | `qfSync` | Quality Forward連携 | run全体 | QFペイロード/送信結果 | `connectors/qualityforward.js` |
| 11 | `report` | テストレポート生成 | run全体, qf | markdown + summary | `stages/report.js` |

## 各ステージ詳細

### 1. ingest（取込）
- 仕様テキストを段落→節→要件行に分解。要件マーカー（できる/しなければ/以内 等）で要件抽出。
- apk はメタ（package/権限/Activity）から節を作り、**権限を非機能要件へ変換**。
- URL/バイナリの実取得はランタイム層。コアは取得済みテキスト/メタを受ける。

### 2. featureAnalysis（フィーチャー分析）
- 要件を機能フィーチャー（代表動詞/名詞句でクラスタ）へ集約。
- ISO/IEC 25010 のキーワードで非機能フィーチャー（security/performance/usability/...）を検出。
- 各フィーチャーに初期リスク（要件数×種別重み）を付与し、後段の優先度に反映。

### 3. modelAnalysis（モデル分析）
- 要件文のシグナル→ISO/IEC/IEEE **29119-4 技法**へマッピング（STT/DT/BVA/EP/PW/UC/ERR）。
- 例: 「5回連続で誤入力するとロック」→ STT、「8文字以上」→ BVA、「ブラウザ組合せ」→ PW。
- 未該当の機能には EP+ERR を最低保証（網羅の底上げ）。

### 4-5. testDesign（基本/詳細設計）
- 基本: モデル×要件から**テスト条件**（カバレッジアイテムの親）を生成し優先度付け。
- 詳細: 技法別テンプレートで**カバレッジアイテム**へ展開（BVAなら境界4点、STTなら遷移3種 等）。

### 6-7. testCase（ハイ/ローレベル）
- ハイ: カバレッジアイテム→論理テストケース（データ非依存の手順・期待結果）。
- ロー: 論理ケース→具体ケース（テストデータ・事前条件・`automationHint` を確定）。
- カバレッジアイテム数 = ハイ = ロー を保証（**設計トレーサビリティ**）。

### 8. script（スクリプト作成）
- 常に Gherkin(.feature)。Web対象は Playwright、apk対象は Appium を追加生成。
- 環境依存値（セレクタ/URL）は `TODO`/`fixme` で明示（未確定を隠さない）。

### 9. execution（実行）
- 既定 `simulated`（ドライラン）。スクリプトは生成直後 `fixme` のため **Blocked（未実行）** を正直に返す。
- `runner(cases)` を注入すると `live` モードで実結果に置換（Pass/Fail/Blocked）。

### 10. qfSync（Quality Forward連携）
- フィーチャー→Test Suite、ローケース→Test Case、実行結果→Test Result にマッピング。
- 既定 dry-run（送信せずペイロード生成）。`baseUrl`+`apiKey` 指定時のみ POST。

### 11. report（レポート）
- 成果サマリ表・実行結果・技法分布・QF連携状況・自動品質所見を Markdown 化。
- `summary` オブジェクトも同時出力（機械可読）。

## トレーサビリティ

`requirement → feature → model → condition → coverageItem → highCase → lowCase → script → result → QF`
の各ノードは ID 参照でつながり、要件から実行結果まで往復追跡できる。
