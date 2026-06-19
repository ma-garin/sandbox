"""LLMによるUI/UXヒューリスティック評価。

OpenAI GPT-4o Vision を使用（streamlit-rag-app / agent-eval の業務judge方針に準拠）。
プロンプトはEvidence-only・JSON強制（qa-review-standards）。
Langfuse観測は任意（未導入でも動作する）。
"""
from __future__ import annotations

import json
from pathlib import Path

from .schema import (
    AxeViolation,
    Finding,
    LighthouseScores,
    Severity,
    UXEvalResult,
)

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "ux_system_prompt.md"


def _load_system_prompt() -> str:
    """UX評価のsystemプロンプトを読み込む。"""
    return _PROMPT_PATH.read_text(encoding="utf-8")


# Langfuse（任意）。未導入なら素通しのデコレータにフォールバックする。
try:  # pragma: no cover - 観測基盤は任意
    from langfuse.decorators import observe
except ImportError:  # pragma: no cover

    def observe(*_args, **_kwargs):  # type: ignore[no-redef]
        def _decorator(func):
            return func

        return _decorator


def _build_context(
    axe_violations: list[AxeViolation], lighthouse: LighthouseScores
) -> str:
    """LLMへ渡す客観的証拠（axe / Lighthouse）をテキスト化する。"""
    lines: list[str] = ["# 客観的証拠"]

    lines.append("## axe-core アクセシビリティ違反")
    if axe_violations:
        for v in axe_violations:
            lines.append(
                f"- [{v.impact or 'n/a'}] {v.rule_id}: {v.description}（{v.node_count}件）"
            )
    else:
        lines.append("- 違反は検出されませんでした（または検査未実施）")

    lines.append("## Lighthouse スコア（0.0〜1.0）")
    lines.append(f"- Performance: {lighthouse.performance}")
    lines.append(f"- Accessibility: {lighthouse.accessibility}")
    lines.append(f"- Best Practices: {lighthouse.best_practices}")
    lines.append(f"- SEO: {lighthouse.seo}")

    lines.append(
        "\n上記の証拠と、添付スクリーンショットに実際に見える要素のみを根拠に評価せよ。"
    )
    return "\n".join(lines)


def _parse_findings(raw: dict) -> tuple[str, list[Finding]]:
    """LLMのJSON応答をsummaryとFindingリストへ変換する。"""
    summary = str(raw.get("summary", ""))
    findings: list[Finding] = []
    for item in raw.get("findings", []):
        try:
            findings.append(
                Finding(
                    severity=Severity(item["severity"]),
                    iso25010=str(item.get("iso25010", "運用操作性")),
                    title=str(item.get("title", "")),
                    evidence=str(item.get("evidence", "")),
                    recommendation=str(item.get("recommendation", "")),
                )
            )
        except (KeyError, ValueError):
            # 不正な要素はスキップ（JSON強制でも保険として防御）
            continue
    return summary, findings


@observe(name="uiux_llm_eval")
def evaluate(
    *,
    target: str,
    screenshot_b64: str | None,
    axe_violations: list[AxeViolation],
    lighthouse: LighthouseScores,
    model: str = "gpt-4o",
) -> UXEvalResult:
    """スクショ＋客観証拠をLLMに渡してUX評価を得る。

    OpenAI SDK（環境変数 OPENAI_API_KEY を使用）。キー未設定や未導入時は
    findings空・summaryに理由を入れて返す（パイプラインを止めない）。
    """
    try:
        from openai import OpenAI
    except ImportError:
        return UXEvalResult(
            target=target,
            summary="openaiパッケージが未インストールのためLLM評価をスキップしました。",
            axe_violations=axe_violations,
            lighthouse=lighthouse,
        )

    context = _build_context(axe_violations, lighthouse)
    user_content: list[dict] = [{"type": "text", "text": context}]
    if screenshot_b64:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"},
            }
        )

    try:
        client = OpenAI()
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _load_system_prompt()},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},  # JSON強制
            temperature=0,  # 再現性重視
        )
        raw = json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:  # APIエラー・キー未設定など
        return UXEvalResult(
            target=target,
            summary=f"LLM評価に失敗しました: {exc}",
            axe_violations=axe_violations,
            lighthouse=lighthouse,
        )

    summary, findings = _parse_findings(raw)
    return UXEvalResult(
        target=target,
        findings=findings,
        summary=summary,
        axe_violations=axe_violations,
        lighthouse=lighthouse,
    )
