# 002-tracegate — 仕様・テスト整合性監査CLI（INF-01 TraceGate MVP）

仕様ファイルの要件ID（`REQ-NNN`）とテストコードの `@covers REQ-NNN` アノテーションを突合し、

1. トレーサビリティマトリクス（Markdown / JSON）の生成
2. 乖離率（未カバー要件の割合）によるCIゲート判定（終了コード）

を行うCLIツール。規約ベースの決定的処理のみで、LLM・AST解析は使わない（MVPスコープ）。

## 状態

**実装待ち**。仕様・設計・タスクは確定済み:

- `docs/spec.md` — 要件（EARS形式・REQ-001〜019）
- `docs/design.md` — 確定設計（モジュール・シグネチャ・出力書式）
- `docs/tasks.md` — 実装タスク T01〜T11（1セッション1タスク）

実装セッションの進め方は `AGENTS.md` を参照。

## 完成時の使い方（予定）

```bash
PYTHONPATH=src python -m tracegate --specs "specs/**/*.md" --tests "tests/**/*.*" \
  --max-divergence 0.1 --json report.json
```

| 終了コード | 意味 |
|---|---|
| 0 | ゲート通過 |
| 1 | 乖離率超過 or 孤立カバレッジあり |
| 2 | 設定誤り（要件が0件） |
