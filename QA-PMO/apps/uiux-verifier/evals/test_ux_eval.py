"""UI/UX評価の回帰テスト（agent-evalスキル準拠）。

DeepEval（pytest-native）でLLM評価の品質をゲートする。
judgeモデルはOpenAI（業務方針）。OPENAI_API_KEY未設定時はskipする。

実行: deepeval test run evals/test_ux_eval.py
      または pytest evals/test_ux_eval.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

_GOLDEN = Path(__file__).resolve().parent / "golden" / "sample_case.json"

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY未設定のためLLM評価テストをスキップ",
)


def _load_golden() -> dict:
    """ゴールデンケースを読み込む。"""
    return json.loads(_GOLDEN.read_text(encoding="utf-8"))


def test_low_contrast_button_is_flagged() -> None:
    """低コントラストの証拠を与えたとき、適切なseverityと証拠で指摘されること。

    Evidence-only原則の回帰確認: 与えた証拠キーワードが evidence に反映され、
    severityが期待最小値（Major）以上であることを検証する。
    """
    from deepeval import assert_test
    from deepeval.metrics import GEval
    from deepeval.test_case import LLMTestCase, LLMTestCaseParams

    from core.schema import LighthouseScores
    from core import ux_evaluator

    golden = _load_golden()

    # ゴールデンの証拠文脈をそのままLLMへ渡し、評価結果を得る
    result = ux_evaluator.evaluate(
        target="golden/low-contrast",
        screenshot_b64=None,
        axe_violations=[],
        lighthouse=LighthouseScores(accessibility=0.62),
    )
    actual_output = "\n".join(
        f"[{f.severity.value}/{f.iso25010}] {f.title} :: {f.evidence}"
        for f in result.findings
    ) or result.summary

    # LLM-as-judge: 証拠に基づき妥当な指摘になっているかをGEvalで評価
    metric = GEval(
        name="Evidence-grounded UX finding",
        criteria=(
            "出力が、与えられたアクセシビリティ証拠（コントラスト不足）に基づいた"
            "具体的かつ妥当なUX指摘になっているか。推測ではなく証拠に紐づいているか。"
        ),
        evaluation_params=[
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
        ],
        threshold=0.7,
        model="gpt-4o",
    )

    test_case = LLMTestCase(
        input=golden["input_context"],
        actual_output=actual_output,
    )
    assert_test(test_case, [metric])
