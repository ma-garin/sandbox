---
description: agent-evalスキルを使い、DeepEval回帰テスト/Langfuseトレース確認をセットアップまたは実行
---

agent-evalスキルに従い、評価基盤の構築または実行を行います。

1. 対象が業務系（pmo_agent等）か個人系かを確認 → judgeモデルを切替（業務=OpenAI API / 個人=Gemini無料枠）
2. Langfuseセルフホスト（NEC Mate）が稼働中か確認
3. DeepEvalテストケースを`evals/`に作成または既存実行
4. 結果をLangfuse UIのデータセットと紐付け
