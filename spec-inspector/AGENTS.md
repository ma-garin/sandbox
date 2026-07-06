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
│   └── RESEARCH.md      # 元QuintSpectの調査レポート
├── index.html           # （予定）UIエントリ
├── src/                 # （予定）解析ロジック・プロンプト
└── tests/               # （予定）検証
```

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
