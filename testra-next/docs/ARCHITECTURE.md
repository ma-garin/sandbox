# アーキテクチャ

## 設計原則

1. **共有コア（Shared Core）** — パイプラインの全ロジックを `core/` の純粋ESMに閉じ込め、
   オンプレ／クラウド／CLI の3ランタイムが**同一コードを再利用**する。ランタイム差はI/Oのみ。
2. **ビルドレス** — バンドラ・トランスパイラ不要。ブラウザ・Node がそのまま `import` できる標準ESM。
3. **決定論** — `Math.random`/`Date.now` をコアで使わず、IDは入力ハッシュから導出（`util/id.js`）。
   同一入力は常に同一成果物。回帰テストとレビューが容易。
4. **不変（immutable）** — `Run` は `Object.freeze`。各ステージは `(run) => 新しい run` の純粋関数。
5. **AIは補強、ルールが土台** — LLM無しでもフル動作。LLMは各ステージの `enrich` フックで品質を上乗せ。
6. **秘匿情報は注入** — APIキーはコアに持たず、web=localStorage / CLI=環境変数から渡す。

## レイヤ構成

```
        ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
ランタイム │ CLI          │   │ Web (SPA)    │   │ ライブラリ    │
        │ cli/testra   │   │ web/app.js   │   │ 直接import    │
        └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
               │  (fs/fetch)      │ (DOM/fetch)     │
               └──────────────────┼─────────────────┘
                                  ▼
                       ┌────────────────────┐
                       │ core/pipeline.js    │  ← 唯一の公開エントリ
                       └──────────┬─────────┘
             ┌───────────┬────────┼────────┬─────────────┐
             ▼           ▼        ▼        ▼             ▼
        stages/*    connectors/  llm/    model.js     util/
        (純粋関数)   qualityforward       (Run/immutable)
```

## データフロー（Run オブジェクト）

`Run` は各ステージ成果物を `artifacts[stage]` に積み上げる不変コンテナ。

```
run.meta        = { name, timestamp, engine }
run.artifacts   = { ingest, featureAnalysis, ..., report }   // ステージ名キー
run.trace       = [ { stage, ...件数 }, ... ]                 // 実行ログ
```

各ステージは前段の `artifacts` のみを入力に取り、後段は前段の出力にのみ依存する（一方向）。
これによりステージ単体テスト・部分再実行・可視化が容易になる。

## ランタイム別の責務

| ランタイム | 固有の責務 | コアへ渡すもの |
|---|---|---|
| CLI | ファイル/URL読込・apkメタ生成・成果物のファイル出力 | `{ sources }`, env由来の設定 |
| Web | DOM入力・localStorage設定・ダウンロード・進捗描画 | `{ sources }`, localStorage由来の設定 |
| ライブラリ | 呼び出し側が任意 | `{ sources }`, options |

## 拡張ポイント

- **LLMプロバイダ**: `core/llm/providers/` に追加し `resolveLlm` で解決。
- **実行器（runner）**: `runPipeline(input, { runner })` に注入すると `execution` が live に。
  Playwright/Appium 実行器を薄いアダプタで接続する想定。
- **コネクタ**: QualityForward 以外（Jira/TestRail等）も `connectors/` に同契約で追加可能。
- **入力パーサ**: docx/pdf/apk の実抽出は将来 `core/parsers/` を追加しランタイム層から供給。
