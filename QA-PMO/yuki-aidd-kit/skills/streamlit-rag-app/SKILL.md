---
name: streamlit-rag-app
description: PMOエージェント系（VeriRAG等）のStreamlit + RAG + multi-agentアプリ開発に使うスキル。「Streamlit」「RAG」「PMOエージェント」「multi-agent」の言及で使用。
---

# Streamlit RAG/Multi-Agent App Pattern

PMOエージェント（VeriRAG_test）系で確立したアーキテクチャ。大規模SIer向け、PC専用、マルチテナント/マルチユーザー対応。

## アプリモード
- RAGモード: ドキュメント検索+回答生成
- multi-agentモード: Planner/Explorer/Critic/Reporter等の役割分担

## レイアウト原則
- Material Design、落ち着いた雰囲気（design-systemの紺系`#1a3a6b`トークン使用）
- 左サイドバー固定ナビ + ヘッダー固定 + メインのみスクロール（ノースクロール原則）
- PC専用（モバイル最適化は対象外）

## 3機能構成（PMOエージェントの場合）
1. **意思決定支援**: Jira/Confluence/Office文書連携→ダッシュボード可視化、OpenAI API+RAGで状況別提案、人間レビューworkflow
2. **作成物支援**: チャット形式RAGで構成管理表・キックオフ文書等のテンプレート出力
3. **教育支援**: 左で作業提出→右でAIレビュー+正解例、Office/text/HTML出力

## eval/観測
agent-evalスキルを適用。業務系のためjudgeモデルはOpenAI API（GPT-4o系）を使用。

## モジュール管理
16モジュール構成等、大規模になる場合はCURRENT_STATE.mdで状態管理し、フェーズ単位で`/clear`を挟みながら実装する（sdd-ecc-workflow参照）。
