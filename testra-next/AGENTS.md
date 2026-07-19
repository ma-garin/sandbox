# AGENTS.md — testra-next

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

ベリサーブ「TESTRA」を上位互換化した一気通貫テストパイプライン。
仕様書/URL/apk を入力に、取込→分析→設計→ケース→スクリプト→実行→QualityForward連携→レポートを自動化。
オンプレ／クラウド／CLI が同一の純粋ESMコアを共有する（ビルド不要）。

## 対象ファイル

```
testra-next/
├── README.md / AGENTS.md / CURRENT_STATE.md
├── package.json              # type:module / npm test・demo
├── docs/
│   ├── ARCHITECTURE.md       # 3ランタイム共有コア設計
│   ├── PIPELINE.md           # 11ステージ仕様・トレーサビリティ
│   ├── RESEARCH.md           # TESTRA/QualityForward調査と上位互換戦略
│   └── GOALS.md              # 改善バックログ（1件ずつ着手）
├── core/                     # 共有コア（純粋・依存なし・決定論・immutable）
│   ├── pipeline.js           # 公開エントリ（runPipeline）
│   ├── model.js              # Run / STAGE_ORDER / TECHNIQUES / immutable helper
│   ├── stages/               # ingest, feature-analysis, model-analysis,
│   │                         #   test-design, test-case, test-script, test-execution, report
│   ├── connectors/qualityforward.js  # QF連携（toPayload / sync, fetch注入可）
│   ├── llm/llm.js + providers/openai.js  # AI補強（既定rule）
│   └── util/id.js, util/text.js
├── cli/testra.mjs            # CLI（node:fs/fetch使用。coreのみ純粋）
├── web/index.html + app.js + css/style.css  # SPA（coreを直接import）
├── samples/login-spec.md
└── tests/*.test.mjs          # node:test（pipeline/stages/qualityforward）
```

## 対象外ファイル

- `out/`（生成物・gitignore）

## 使用技術・制約

- Node.js 20+ / 標準ESM / **依存パッケージなし・ビルドなし**
- `core/` は純粋関数のみ（node:組込みも使わない）。I/Oはランタイム層（cli/web）に限定
- 決定論厳守: コアで `Math.random`/`Date.now`/`new Date()` を使わない（IDは入力ハッシュ由来、timestampは注入）
- immutable: `Run` は `Object.freeze`、ステージは `(run)=>新run`
- APIキー（LLM/QualityForward）は**コードに置かない**（web=localStorage / CLI=env）
- 成果物はISO/IEC 25010で自己レビュー、指摘はISTQB severityで報告

## テスト/実行

```bash
npm test              # node --test tests/*.test.mjs
npm run demo          # samples/login-spec.md を一気通貫実行→out/
```

## 現在のタスク

→ `CURRENT_STATE.md` を参照
