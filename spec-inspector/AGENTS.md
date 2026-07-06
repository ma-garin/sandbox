# AGENTS.md — spec-inspector

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

バルテス「QuintSpect」をレベルアップしたAI仕様書インスペクションツール。
ドキュメントを品質観点でスコアリング・改善提案・矛盾検知する。ブラウザ完結。

## 対象ファイル

```
spec-inspector/
├── README.md            # プロジェクト概要
├── AGENTS.md            # 本ファイル
├── CURRENT_STATE.md     # フェーズ・次タスク
├── docs/
│   ├── RESEARCH.md      # 元QuintSpectの調査レポート
│   ├── GOALS.md         # 改善バックログ（/goalコマンドで1件ずつ実行）
│   └── ux/              # スクリーンショット
├── index.html           # UIエントリ（解析/矛盾検知/トレーサビリティ/履歴/設定）
├── css/style.css
├── src/
│   ├── engine.js        # 6観点ルールベース解析
│   ├── consistency.js   # 文書間矛盾検知
│   ├── traceability.js  # 要件↔設計↔テスト矩阵
│   ├── testdesign.js    # （G-01予定）テスト設計レディネス
│   ├── parsers.js / history.js / charts.js / report.js / app.js
│   ├── llm.js           # AI補足オーケストレーション（OpenAI・既定gpt-5-mini）
│   ├── providers/openai.js  # リクエスト構築・応答抽出（fetch注入でモック可）
│   └── prompts/         # 内部プロンプトパック（契約・観点指示・few-shot・チャンク）
└── tests/               # node tests/*.mjs（engine/report/prompts/llm）
```

## AI設定（OpenAI）

- localStorage: `spec-inspector.openai.{key,org,project,model}.v1`／provider（rule|openai）
- 実APIの実行・キー設定は**別環境**で行う（このリポジトリにキーを置かない）
- 開発時の検証は fetchモック（tests/llm.test.mjs）と route stub のE2Eで行い、実APIは呼ばない

## 対象外ファイル

- なし

## 使用技術・制約

- クライアントサイド（HTML/CSS/JS、ビルドレス想定）。既存 `QA-PMO/pmo-menu.html` と同系統
- LLM APIキーは **localStorage** 保存（ハードコード禁止）
- immutableパターン／エラーは明示処理しUIに分かりやすく表示
- 成果物はISO/IEC 25010で自己レビュー、指摘はISTQB severityで報告

## 品質観点（コア5＋拡張）

正確性 / 理解性 / 視覚性 / 深層性 / 信頼性 ＋ 検証可能性（テスト容易性）

## 現在のタスク

→ `CURRENT_STATE.md` を参照
