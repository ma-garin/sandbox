# 003-agentlint — エージェント権限ポリシーLint（GT-15 AgentLint MVP）

Claude Codeのエージェント設定（`.claude/settings.json` / `.claude/settings.local.json`）と
MCP設定（`.mcp.json`）を静的検査し、最小権限原則違反・危険設定を検出するCLI。
ルールベース・LLM不使用。

## 状態

**実装待ち**。仕様・設計・タスクは確定済み:

- `docs/spec.md` — 要件（EARS形式・REQ-101〜117）
- `docs/design.md` — 確定設計（ルールAL-000〜010の検出条件表・出力書式）
- `docs/tasks.md` — 実装タスク T01〜T08（1セッション1タスク）

実装セッションの進め方は `AGENTS.md` を参照。

## 完成時の使い方（予定）

```bash
PYTHONPATH=src python -m agentlint /path/to/repo --json report.json --fail-on High
```

| 終了コード | 意味 |
|---|---|
| 0 | fail-on以上の指摘なし |
| 1 | fail-on以上の指摘あり |
| 2 | 検査対象ファイルが存在しない |
