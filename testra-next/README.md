# TESTRA-Next

## 概要

ベリサーブ「TESTRA」を圧倒的上位互換として再設計した、**一気通貫テスト自動化パイプライン**。
仕様書（テキスト/URL）や apk を入力に、以下 11 ステージを end-to-end で自動処理する。

```
ドキュメント取込 → テストフィーチャー分析 → テストモデル分析
→ テスト設計(基本) → テスト設計(詳細)
→ テストケース(ハイレベル) → テストケース(ローレベル)
→ テストスクリプト作成 → テスト実行
→ Quality Forward 連携 → テストレポート生成
```

**オンプレ・クラウド・CLI の3ランタイムで同一コアが動く**（ビルド不要のESM）。

> TESTRA / QualityForward の調査と上位互換ポイントは [`docs/RESEARCH.md`](docs/RESEARCH.md)、
> アーキテクチャは [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)、ステージ仕様は [`docs/PIPELINE.md`](docs/PIPELINE.md)。

## TESTRAからの強化点

| 観点 | TESTRA | TESTRA-Next |
|---|---|---|
| 範囲 | テスト設計中心 | 取込〜設計〜スクリプト〜実行〜レポートまで一気通貫 |
| 入力 | 仕様テキスト | 仕様テキスト＋**URL＋apkメタ** |
| 設計技法 | 観点適用 | 29119-4 の8技法を要件シグナルで**自動選定** |
| 実行形態 | SaaS | **オンプレ／クラウド／CLI** 共通コア |
| 連携 | — | **Quality Forward** 双方向マッピング |
| 再現性 | — | 決定論的ID（同一入力＝同一成果物） |
| AI | 人×AI | ルールベースを常時フォールバックし、LLMは**補強フック** |

## セットアップ

```bash
# 依存なし・ビルド不要（Node.js 20+ のみ）
node --version   # v20 以上
```

## 使い方

### CLI

```bash
# サンプル仕様で一気通貫実行（out/ に成果物を出力）
npm run demo
# または
node cli/testra.mjs run samples/login-spec.md --name ログイン --out out
node cli/testra.mjs run https://example.com/spec --apk app.apk --out out
```

出力: `out/report.md` `out/testcases.csv` `out/scripts/*` `out/qualityforward.json` `out/run.json`

### Web（オンプレ／クラウド）

```bash
python3 -m http.server 8000       # 静的配信
# ブラウザで http://localhost:8000/web/index.html を開く
```

### ライブラリ（組込み）

```js
import { runPipeline } from './core/pipeline.js';
const run = await runPipeline({ title: 'ログイン', sources: [{ name: 'spec', kind: 'spec', text }] });
console.log(run.artifacts.report.markdown);
```

## テスト

```bash
npm test          # node --test（13件）
```

## 構成

```
testra-next/
├── core/                     # 共有コア（純粋ESM・依存なし・3ランタイム共通）
│   ├── pipeline.js           # 11ステージ・オーケストレーション
│   ├── model.js              # 共通データモデル / immutable helper
│   ├── stages/               # 各ステージ（純粋関数）
│   ├── connectors/qualityforward.js  # QF連携アダプタ（fetch注入でモック）
│   ├── llm/                  # AI補強アダプタ（既定rule / openai骨組み）
│   └── util/                 # id / text ユーティリティ
├── cli/testra.mjs            # CLIランタイム（URL取得・apkメタ・ファイル出力）
├── web/                      # Webランタイム（SPA・coreを直接import）
├── samples/login-spec.md     # サンプル仕様
├── tests/                    # node:test 単体テスト
└── docs/                     # ARCHITECTURE / PIPELINE / RESEARCH / GOALS
```

## メモ

- 学習・検証目的（sandbox配下）。商用サービスの複製ではなく再設計版。
- 実行ステージは既定 `simulated`（ドライラン）。実行器を注入すると実結果に置換される。
- APIキー（LLM / QualityForward）は **コードに置かない**。web=localStorage、CLI=環境変数から注入。
