---
name: sdd-ecc-workflow
description: 仕様駆動開発(SDD)とeverything-claude-code(ECC)を組み合わせた開発フローを使う際のスキル。「SDD始める」「設計から」「仕様書作って」の言及で使用。本実装フェーズの標準ワークフロー。
---

# SDD + ECC Workflow

## SDD 10ステップ
1. 要求の明確化（誰のための何の機能か）
2. requirements.md作成（受け入れ基準含む）
3. design.md作成（アーキテクチャ・データフロー）
4. tasks.md作成（実装単位に分解）
5. レビュー（QA観点含む）
6. 実装（タスク単位、`/clear`で都度コンテキストリセット）
7. 単体確認
8. 結合確認
9. QAレビュー（qa-review-standards適用）
10. ドキュメント更新（CURRENT_STATE.md / ADR）

ツールチェーン: npm利用可なら`cc-sdd`、npm禁止環境（会社PC等）はマニュアルでrequirements.md/design.md/tasks.mdを手書き。

## ECC（everything-claude-code）導入方針
最小構成のみ取り込み、コンテキスト肥大化を避ける。

採用:
- `agents/planner.md`（実装前設計整理）
- `agents/code-reviewer.md`（レビュー自動化）
- `rules/coding-style.md`, `rules/security.md`
- `commands/plan.md`, `commands/build-fix.md`

不採用（個人開発では過剰）:
- `mcp-configs/`（外部サービス連携、必要時のみ個別追加）
- `agents/e2e-runner.md`（PoCフェーズでは不要）

## Codex対応
Codexは`AGENTS.md`を読む。スラッシュコマンド/hooksの仕組みはClaude Code専用なので、Codex使用時は`AGENTS.md.template`（このkit内）を`~/.codex/AGENTS.md`にコピーする。

## トークン規律
- フェーズ単位で`/clear`を実行、コンテキストを持ち越さない
- 大きいファイルの編集は`str_replace`差分編集（全体再生成しない）
- セッション開始時にCURRENT_STATE.mdを読み込み、終了時に更新（session-summaryフック参照）
