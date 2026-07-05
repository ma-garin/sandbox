# AGENTS.md — 003-agentlint

> 共通規約は親フォルダの `sandbox/AGENTS.md`、実装体制は `sandbox/ROADMAP.md` を参照。

---

## このプロジェクトの概要

GT-15「AgentLint」MVP。Claude Code設定（`.claude/settings*.json`）とMCP設定（`.mcp.json`）を
静的検査し、最小権限違反・危険設定を検出するCLI（ルールベース・LLM不使用）。

## 実装セッションへの指示（Sonnet向け・必読）

1. `CURRENT_STATE.md` → `docs/tasks.md` の順に読み、**次の未完了タスク1つだけ**を実施する
2. `docs/spec.md` / `docs/design.md` は確定済み・変更禁止。ルールの検出条件は
   design.mdの表がすべて。表にない条件を追加・推測しない。
   矛盾・不明点は `CURRENT_STATE.md` の「要確認」に記録して中断する
3. 依存追加禁止: Python 3.10+ 標準ライブラリのみ（pytestは開発時のみ）
4. 各ルールは1関数で実装し、`RULES` リストへの登録だけで有効化される構造を守る
5. 検証コマンドが通ってから `feat(agentlint): T0N <内容>` でコミット

## 対象ファイル

```
003-agentlint/
├── docs/       # spec.md / design.md / tasks.md（読み取り専用）
├── src/agentlint/
└── tests/
```

## 対象外ファイル

- このフォルダの外（T07のドッグフーディングで親リポジトリを「読む」のは可。書き込みは不可）

## 使用技術・制約

- Python 3.10+ / 標準ライブラリのみ / pytest（開発時）

## 現在のタスク

→ `CURRENT_STATE.md` を参照
