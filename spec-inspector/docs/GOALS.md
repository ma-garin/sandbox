# GOALS.md — spec-inspector 改善バックログ（/goal コマンドで1件ずつ実行）

> 実行方法: `/goal G-XX`（ID省略時は依存充足済みの先頭「未着手」）。
> 実行者はSonnetを想定。各ゴールは1時間以内・自己検証可能な粒度に分解済み。
> 共通規約: immutable／明示的エラー処理／evidence-only／キーのハードコード禁止／1ゴール=1コミット。
> 共通回帰: 実装後は必ず `node tests/engine.test.mjs && node tests/report.test.mjs && node tests/prompts.test.mjs && node tests/llm.test.mjs` も通すこと。

## 凡例

- 状態: 未着手 / 進行中 / 完了(日付) / 保留(理由)
- UIゴールのE2E: playwright-core＋`/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`。
  scratchpadの `verify2.mjs`/`verify3.mjs` パターンを流用。実APIは呼ばない（route stub）。

---

## G-01 テスト設計レディネス: 検出＋ドラフト生成モジュール

- **目的**: 仕様文からテスト技法（デシジョンテーブル/境界値分析/状態遷移）の適用候補を検出し、下書きを生成する（ベリサーブGIHOZの思想を仕様書レビュー段階に前倒し）
- **対象ファイル**: `src/testdesign.js`（新規）、`src/consistency.js`（`NUM_UNIT` のexport化1行のみ）、`tests/testdesign.test.mjs`（新規）
- **仕様**:
  - `detectDecisionTableCandidates(text)`: 段落単位で条件語（場合/とき/かつ/または/もし/ならば）の密度（接続詞1＋条件語2以上）で検出 → `[{type:"decision-table", location, evidence, conditions:[…]}]`
  - `detectBoundaryCandidates(text)`: `NUM_UNIT`＋比較語（以上/以下/未満/超/以内/上限/下限）の近接 → `[{type:"boundary", location, evidence, value, unit, comparator}]`
  - `detectStateCandidates(text)`: 語彙（状態/遷移/ステータス）＋接尾（〜中/〜済み/〜待ち/〜完了）の名詞抽出 → `[{type:"state", location, evidence, states:[…]}]`
  - `decisionTableDraft(cand)` / `boundaryDraft(cand)` / `stateDraft(cand)`: Markdownドラフト。DTは条件最大4件でY/N全組合せ（超過は縮約注記）、境界値はcomparator意味論に従い min-1/min/min+1（または max側）＋単位、状態は一覧＋N×N遷移表スケルトン
  - `analyzeTestDesignReadiness(docs)`: 上記を統合し `Object.freeze({candidates:[{...cand, doc, draft}], counts:{decisionTable, boundary, state}})`
- **受入基準**:
  1. `node tests/testdesign.test.mjs` 全パス。テスト内容: 条件クラスタ検出の正例/負例、「8文字以上」→7/8/9の境界値ドラフト、「承認待ち・承認済み」→状態抽出、候補ゼロ文書で空結果、draftが有効なMarkdown表（`|`行を含む）、全候補にevidence＋location（evidence-only）
  2. 共通回帰が全パス（NUM_UNIT export化でconsistencyが壊れていないこと）
- **依存**: なし ／ **状態**: 完了(2026-07-06)

## G-02 テスト設計レディネス: UIタブ統合

- **目的**: G-01の結果を「テスト設計」タブで提示し、ドラフトをコピー可能にする
- **対象ファイル**: `index.html`、`src/app.js`、`css/style.css`（必要最小限）
- **仕様**: タブボタン `data-tab="testdesign"`（ラベル「テスト設計」）＋panel追加。`runAnalysis`で`analyzeTestDesignReadiness(targets)`を実行し`lastResult.testdesign`に格納。候補カード（種別タグ＋文書/L行＋evidence引用＋`<details>`内ドラフト＋コピーボタン）。`setTabBadge("testdesign", 候補数)`。空状態は既存`emptyWithCta`を再利用
- **受入基準**:
  1. E2E: サンプル3文書解析→テスト設計タブに候補カード表示・バッジ数が候補数と一致・コピーボタンでclipboard書き込み（`navigator.clipboard`はE2Eで権限付与）・JSエラーゼロ
  2. 共通回帰＋`node tests/testdesign.test.mjs` 全パス
- **依存**: G-01 ／ **状態**: 完了(2026-07-06)

## G-03 テスト設計書診断: ルールモジュール

- **目的**: ベリサーブ「テスト設計書診断サービス」のツール化。テスト文書専用の品質ルール
- **対象ファイル**: `src/testdoc.js`（新規）、`tests/testdoc.test.mjs`（新規）
- **仕様**: `analyzeTestDocQuality(text, name)` → engine.jsと同形のfindings配列（`category:"testdoc"`付与）。ルール5種:
  1. 期待結果の欠落（テストケース行に「〜こと/〜されること」等の期待結果がない）
  2. テスト技法の明示なし（境界値/同値/デシジョンテーブル/状態遷移等の語が皆無）
  3. カバレッジ根拠なし（網羅/カバレッジ/観点の記述なし）
  4. 事前条件・テストデータの再現性（前提/事前条件/データの記述なし）
  5. 要件トレースなし（REQ-等のIDが1つもない）
  - viewpointへのマップ: 1→verifiability、2・3→depth、4→verifiability、5→reliability
- **受入基準**: `node tests/testdoc.test.mjs` 全パス（5ルール各正例/負例、全指摘にevidence＋suggestion）＋共通回帰
- **依存**: なし ／ **状態**: 完了(2026-07-06)

## G-04 テスト設計書診断: findings合流

- **目的**: role=testの文書にのみG-03診断を適用し、既存の指摘一覧・エクスポートに合流させる
- **対象ファイル**: `src/app.js`
- **仕様**: `runAnalysis`内で `targets.filter(t=>t.role==="test")` に `analyzeTestDocQuality` を適用し `allFindings` に合流（doc名付与）。フィルタ・CSV・コメント付きMD・HTMLレポートは既存パイプラインで自動的に処理される
- **受入基準**: E2E: サンプル3文書解析→テスト仕様書.md由来のtestdoc指摘が一覧に表示され、要件定義書.mdには出ない。CSVエクスポートに含まれる。JSエラーゼロ。共通回帰＋testdocテスト全パス
- **依存**: G-03 ／ **状態**: 完了(2026-07-06)

## G-05 IV&V: チェックリスト＋自動判定

- **目的**: 第三者検証（IV&V）観点のチェックリスト（IEEE 1012 / ISO/IEC/IEEE 29119由来）と自動判定
- **対象ファイル**: `src/ivv.js`（新規）、`tests/ivv.test.mjs`（新規）
- **仕様**: `IVV_CHECKLIST`: 15〜20項目 `{id:"IVV-NN", area:"要求|設計|テスト|管理", label, ref, auto}`。autoは`(docs, ruleResults)=>{status:"ok"|"ng", evidence}`の関数またはnull（null=手動確認項目）。`runIVV(docs, ruleResults)` → `Object.freeze({items:[{...item, status:"ok"|"ng"|"manual", evidence?}], counts})`。自動判定できる例: 要求へのID付番（trace結果流用）、受入基準の存在、版管理欄、文書間矛盾の有無（consistency結果流用）
- **受入基準**: `node tests/ivv.test.mjs` 全パス（auto項目がサンプル文書でok/ng判定される、auto:nullは必ずstatus:"manual"、ng判定はevidence必須）＋共通回帰
- **依存**: なし ／ **状態**: 完了(2026-07-06)

## G-06 IV&V: タブUI＋手動チェック永続化

- **目的**: IV&Vチェックリストの表示と、手動確認項目のチェック状態保存
- **対象ファイル**: `index.html`、`src/app.js`
- **仕様**: タブ「IV&V」追加。解析後に`runIVV`を実行し表形式で表示（項目/領域/参照規格/判定/根拠）。manual項目はチェックボックスで確認済みを記録し `spec-inspector.ivv.v1`（localStorage）に永続化。バッジはng件数
- **受入基準**: E2E: 解析→IV&Vタブに項目表示・ng項目に根拠表示・手動チェックONがリロード後も復元・JSエラーゼロ。共通回帰＋ivvテスト全パス
- **依存**: G-05 ／ **状態**: 完了(2026-07-06)

## G-07 IV&V: 検証計画書ドラフト出力

- **目的**: IV&V結果から検証計画書ドラフト（Markdown）を出力
- **対象ファイル**: `src/report.js`、`tests/report.test.mjs`、`src/app.js`（出力ボタン1個）
- **仕様**: `buildVerificationPlanMarkdown({docs, ivv, trace, consistency, scores, generatedAt})` → 章立て: 1.目的と対象文書 2.検証観点（チェックリスト結果） 3.指摘サマリ（severity別件数） 4.文書間整合の検証結果 5.手動確認が必要な項目 6.トレーサビリティ状況。IV&Vタブにダウンロードボタン追加
- **受入基準**: report.test.mjsに追加したテストが全パス（全章見出しを含む・ng項目とmanual項目が列挙される）＋E2Eでダウンロード発火＋共通回帰
- **依存**: G-05 ／ **状態**: 完了(2026-07-06)

## G-08 テスト設計レディネスのAI強化

- **目的**: provider=openai時に `src/prompts/features.js` の `buildTestDesignPrompt` で候補を精緻化
- **対象ファイル**: `src/llm.js`、`src/app.js`、`tests/llm.test.mjs`
- **仕様**: `enrichTestDesign(candidates, docs, {fetchImpl})` を llm.js に追加（enrichWithAIと同じ契約: 失敗時 `{enabled, candidates:[], error?}`、AI由来候補は `source:"ai"`）。応答契約 `{"candidates":[...]}` のパーサ（valid=falseの候補は除外）。UIはAI候補に「AI補足」タグ
- **受入基準**: llm.test.mjsに追加したモックテスト全パス（正常系/失敗時縮退/valid:false除外）＋E2E（route stub）でAI候補表示＋共通回帰
- **依存**: G-01, G-02 ／ **状態**: 未着手

## G-09 指摘トリアージ

- **目的**: 指摘に「未対応/対応済み/対象外」の状態を付け、レビューワークフロー化（単発解析のQuintSpectとの運用差別化）
- **対象ファイル**: `src/app.js`、`src/report.js`、`tests/report.test.mjs`
- **仕様**: 指摘キー＝`doc|viewpoint|message|evidence` のハッシュ。状態を `spec-inspector.triage.v1` に保存し、再解析後も同一キーの指摘に復元。指摘カードに状態セレクタ、フィルタに「未対応のみ」トグル。CSVに「対応状態」列を追加
- **受入基準**: E2E: 状態変更→再解析→状態が復元される。CSVに状態列（report.test.mjsで検証）。共通回帰
- **依存**: なし ／ **状態**: 未着手

## G-10 観点重みカスタマイズ

- **目的**: 組織ごとの観点重視度（例: 検証可能性を重視）を総合スコアに反映
- **対象ファイル**: `src/app.js`、`index.html`、`tests/`（新規 or 既存追記）
- **仕様**: 設定タブに観点別重みスライダ（0.5〜2.0、既定1.0）。`spec-inspector.weights.v1` に保存。総合スコア＝重み付き平均（観点別スコア自体は不変・レーダーも不変、総合のみ変化）。既定値では従来の等重み平均と完全一致
- **受入基準**: 単体テスト: 等重みで従来値一致／重み変更でoverallが期待値に変化。E2E: スライダ変更→再解析→総合スコア変化。共通回帰
- **依存**: なし ／ **状態**: 未着手

## G-11 検出力エビデンス測定

- **目的**: 既知欠陥入り仕様書セットで検出率を測定し、「数字で語れる」根拠を作る（本家のPoC実績への対抗）
- **対象ファイル**: `tests/fixtures/`（新規: 既知欠陥入り仕様書3本＋正解ラベルJSON）、`tests/benchmark.mjs`（新規）
- **仕様**: fixtureは各50行程度の日本語仕様書で、欠陥（曖昧語/矛盾/欠落/検証不能等）を意図的に20件以上埋め込み、正解ラベル（観点・行・種別）を併記。`node tests/benchmark.mjs` が観点別の検出率（recall）と取りこぼし一覧を表形式で出力し、全体recall≥60%をアサート（下回ったら失敗させ、ルール改善の契機にする）
- **受入基準**: `node tests/benchmark.mjs` がレポート出力＋アサート通過。共通回帰
- **依存**: なし ／ **状態**: 未着手

## G-12 HTMLレポートへ新機能セクション追加

- **目的**: エクスポートHTMLレポートにテスト設計候補・IV&V結果を同梱し、配布物としての完成度を上げる
- **対象ファイル**: `src/report.js`、`tests/report.test.mjs`、`src/app.js`（exportHtmlへの受け渡し）
- **仕様**: `buildHtmlReport` に `testdesign` / `ivv` オプション引数を追加（未指定なら従来出力と同一＝後方互換）。テスト設計候補は種別別テーブル、IV&Vは判定付きチェックリスト表
- **受入基準**: report.test.mjs追加テスト全パス（新セクションの有無・未指定時の後方互換）＋共通回帰
- **依存**: G-01, G-05 ／ **状態**: 完了(2026-07-06)

## G-13 AI実キーE2E手順書（別環境・人間実施）

- **目的**: org/project/keyが設定された別環境で、実OpenAI APIの動作確認とプロンプト実測チューニングを行うための手順書
- **対象ファイル**: `docs/AI-E2E.md`（新規）
- **仕様**: 手順書に含める内容: (1) 設定手順（org/project/key/モデル） (2) 確認チェックリスト: 正常系（AI補足タグ表示・件数・evidenceが原文引用か）、401（無効キー）、403（org/project不一致）、429（レート制限時の縮退表示）、JSONモード動作（非JSON応答が来ないか）、長文チャンク分割時の動作 (3) プロンプト実測チューニング記録欄（モデル/日付/検出率所感/誤検出例/prompts配下の修正内容） (4) 課金注意
- **受入基準**: 上記4点を網羅した `docs/AI-E2E.md` が存在する（実行自体は人間＋実キー環境）
- **依存**: なし ／ **状態**: 未着手

---

## 実行順の推奨

依存なし並列可: G-01, G-03, G-05, G-09, G-10, G-11, G-13
推奨順: **G-01 → G-02 → G-03 → G-04 → G-05 → G-06 → G-07 → G-12 → G-08 → G-09 → G-10 → G-11 → G-13**
（ベリサーブ3機能を先に完成させ、レポート統合→AI強化→運用機能の順）
