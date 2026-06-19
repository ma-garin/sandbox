# CURRENT STATE

## プロジェクト
PMOサービス提供基盤（QA-PMO）

## 全体アーキテクチャ
- **フロント**: pmo-menu.html（営業・提案用カタログ・完成）
- **バックエンド**: apps/ 配下に各AIサービスを段階的にモジュール実装
  - 方針: 確立OSSの薄いオーケストレーション（車輪の再発明をしない）

## 現在のフェーズ
第一弾スライス「UI/UX検証」実装完了 → 実環境結合確認待ち

## 直近の決定事項
- スコープ: フロント（カタログ）＋裏（実working AIツール）を段階構築
- 第一弾: UI/UX検証
- AI基盤: OpenAI API（GPT-4o系。業務judge方針）
- UI/UX検証の採用技術: Playwright / axe-core / Lighthouse / GPT-4o Vision / DeepEval

## 完了
- apps/uiux-verifier/ 一式（SDD・core・app.py・evals・設定）
- 全Pythonファイル構文チェック済み

## 未解決事項
- UX-10: 実環境での結合確認（OPENAI_API_KEY・playwright install・lighthouse導入が必要）
- 次スライス候補: ドキュメント検証 / テスト設計（純LLMで横展開しやすい）

## 次回セッションでやること
- ユーザー環境でstreamlit起動・実URLで結合確認
- 問題なければ次のAIサービスを同パターンで横展開

## 最終更新
2026-06-19
