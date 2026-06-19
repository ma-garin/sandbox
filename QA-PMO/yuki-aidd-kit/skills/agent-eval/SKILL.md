---
name: agent-eval
description: AIエージェント/RAGシステムの評価・トレース・回帰テストを構築する際に使うスキル。「eval」「評価基盤」「Weaveみたいな」「トレース」「LLM-as-judge」「回帰テスト」の言及で使用。pmo_agent・stock swing multi-agent等の業務/個人エージェント開発に適用。
---

# Agent Eval Framework

## 推奨スタック

| 役割 | ツール | 配置 |
|---|---|---|
| eval本体（回帰ゲート） | **DeepEval**（pytest-native, MIT） | `evals/` |
| トレース・観測・データセットUI | **Langfuse セルフホスト**（MIT） | NEC Mate SFFにDocker |
| judgeモデル（業務） | **OpenAI API**（GPT-4o系。会社利用可） | eval/トレース評価 |
| judgeモデル（個人PWA） | **Gemini無料枠** or ローカルOllama | 課金ゼロ運用 |

DeepEvalがQA思考（pytest=テストとして書く）に最もフィットする。judgeは用途で切り分ける：業務システム（pmo_agent / stock swing）はOpenAI APIで精度重視、個人PWAはGemini無料枠/Ollamaで課金ゼロ。

## Langfuseセットアップ（NEC Mate SFF / Win11）

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
cat > .env << 'EOF'
NEXTAUTH_SECRET=<openssl rand -base64 32>
SALT=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
NEXTAUTH_URL=http://localhost:3000
EOF
docker compose up -d
```

Tailscale経由でFold5から `http://<NEC-Mate-tailscale-ip>:3000` でアクセス可能。

## アプリ計装例
```python
from langfuse.decorators import observe
from langfuse.openai import openai

@observe()
def call_llm(prompt: str) -> dict:
    resp = openai.chat.completions.create(...)
    return resp

@observe()
def pmo_decision_pipeline(situation: str):
    context = retrieve(situation)
    return call_llm(build_prompt(situation, context))
```

## DeepEval回帰テスト例
```python
from deepeval import assert_test
from deepeval.metrics import GEval, FaithfulnessMetric
from deepeval.test_case import LLMTestCase

def test_pmo_decision_faithfulness():
    test_case = LLMTestCase(
        input="プロジェクトAのキックオフ遅延リスクは？",
        actual_output=pmo_decision_pipeline("..."),
        retrieval_context=["..."],
    )
    metric = FaithfulnessMetric(threshold=0.8, model="gpt-4o")
    assert_test(test_case, [metric])
```

## 運用フロー
1. 本番トレースをLangfuse UIで確認、良い例/悪い例をデータセットに追加
2. データセットをDeepEvalのゴールデンデータとしてエクスポート
3. CI（or 定期実行）でDeepEval回帰テストを実行、閾値割れを検知
4. Langfuse側のLLM-as-judge（faithfulness等）を定期バッチで回しスコア推移監視

## 注意点
- judgeモデルの選択は精度重視（業務=OpenAI）/コスト重視（個人=Gemini無料枠）で固定的に切り分ける
- 長いエージェント実行はLangfuseのobservation数が膨らむ→ストレージ消費に注意、保持期間を設定
- 全コンテナのタイムゾーンはUTCで統一（Langfuse公式要件）
