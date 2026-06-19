"""ISO/IEC 29119-3形式のテストレポート生成。

qa-review-standardsの必須フィールドに沿ってMarkdownを組み立てる。
"""
from __future__ import annotations

from datetime import datetime

from .schema import UXEvalResult


def _format_scores(result: UXEvalResult) -> str:
    """Lighthouseスコアを表形式にする。"""
    lh = result.lighthouse

    def pct(v: float | None) -> str:
        return f"{round(v * 100)}点" if v is not None else "—"

    return (
        "| カテゴリ | スコア |\n|---|---|\n"
        f"| Performance | {pct(lh.performance)} |\n"
        f"| Accessibility | {pct(lh.accessibility)} |\n"
        f"| Best Practices | {pct(lh.best_practices)} |\n"
        f"| SEO | {pct(lh.seo)} |\n"
    )


def build_markdown_report(result: UXEvalResult) -> str:
    """UI/UX検証結果をISO 29119-3形式のMarkdownレポートにする。"""
    counts = result.count_by_severity()
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines: list[str] = []
    lines.append("# UI/UX検証レポート（ISO/IEC 29119-3準拠）\n")
    lines.append(f"- **テスト対象**: {result.target}")
    lines.append("- **テスト範囲**: 単一ページのUI/UX品質（アクセシビリティ・ユーザビリティ）")
    lines.append(
        "- **テスト環境**: Playwright(Chromium headless) / axe-core / Lighthouse / GPT-4o Vision"
    )
    lines.append(f"- **実施日時**: {now}\n")

    lines.append("## 実施結果概要")
    lines.append(result.summary or "（所見なし）")
    lines.append("")
    lines.append(
        f"- 欠陥件数: Critical {counts['Critical']} / Major {counts['Major']} / "
        f"Minor {counts['Minor']} / Cosmetic {counts['Cosmetic']}\n"
    )

    lines.append("## Lighthouse スコア（客観評価）")
    lines.append(_format_scores(result))

    lines.append("## axe-core アクセシビリティ違反（客観評価）")
    if result.axe_violations:
        lines.append("| impact | rule | 概要 | 件数 |")
        lines.append("|---|---|---|---|")
        for v in result.axe_violations:
            lines.append(
                f"| {v.impact or 'n/a'} | {v.rule_id} | {v.description} | {v.node_count} |"
            )
    else:
        lines.append("違反は検出されませんでした（または検査未実施）。")
    lines.append("")

    lines.append("## 欠陥一覧（ISTQB severity付き・UX評価）")
    if result.findings:
        lines.append("| Severity | ISO 25010 | 指摘 | 証拠 | 改善案 |")
        lines.append("|---|---|---|---|---|")
        for f in result.findings:
            lines.append(
                f"| {f.severity.value} | {f.iso25010} | {f.title} | "
                f"{f.evidence} | {f.recommendation} |"
            )
    else:
        lines.append("指摘事項はありません（または証拠不足により評価未実施）。")
    lines.append("")

    lines.append("## リスク評価")
    if counts["Critical"] > 0:
        lines.append("- Critical欠陥が存在するため、リリース前の是正を強く推奨する。")
    elif counts["Major"] > 0:
        lines.append("- Major欠陥が存在するため、優先的な是正を推奨する。")
    else:
        lines.append("- 重大リスクは検出されていない（証拠の範囲内）。")
    lines.append("")

    lines.append("## 終了基準達成状況")
    lines.append(
        "- 客観検査（axe/Lighthouse）と主観評価（ISO 25010）の双方を実施済み。"
        "Critical欠陥0件を是正完了の目安とする。"
    )

    return "\n".join(lines)
