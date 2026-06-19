"""UI/UX検証モジュールの型定義。

qa-review-standards（ISTQB severity / ISO 25010）に準拠したデータ構造を定義する。
CLAUDE.md規約に従い、全フィールドに型を付与する。
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Severity(str, Enum):
    """ISTQB Severity分類。"""

    CRITICAL = "Critical"  # システム停止・データ損失・セキュリティ侵害相当
    MAJOR = "Major"        # 主要機能が使えない・回避策なし
    MINOR = "Minor"        # 不便だが回避策あり
    COSMETIC = "Cosmetic"  # 見た目のみ


# ISO/IEC 25010 ユーザビリティ サブ特性（評価分類に使用）
ISO25010_USABILITY = (
    "適切度認識性",
    "習得性",
    "運用操作性",
    "ユーザーエラー防止性",
    "UI快美性/アクセシビリティ",
)


class AxeViolation(BaseModel):
    """axe-coreが検出したアクセシビリティ違反（客観的証拠）。"""

    rule_id: str
    impact: str | None = None  # critical/serious/moderate/minor（axeの分類）
    description: str
    help_url: str | None = None
    node_count: int = 0


class LighthouseScores(BaseModel):
    """Lighthouseのカテゴリスコア（0.0〜1.0、客観的証拠）。"""

    performance: float | None = None
    accessibility: float | None = None
    best_practices: float | None = None
    seo: float | None = None


class Finding(BaseModel):
    """LLMによるUX評価の指摘（主観評価。必ず証拠を伴う）。"""

    severity: Severity
    iso25010: str = Field(description="ISO 25010ユーザビリティ5サブ特性のいずれか")
    title: str
    evidence: str = Field(
        description="証拠（axe rule id / Lighthouse監査名 / 可視要素の具体的記述）。"
        "Evidence-only原則により推測禁止。"
    )
    recommendation: str


class CaptureResult(BaseModel):
    """capture段階の成果物。"""

    url: str | None = None
    screenshot_b64: str | None = None
    axe_violations: list[AxeViolation] = Field(default_factory=list)
    note: str = ""  # フォールバック発生時などの補足


class UXEvalResult(BaseModel):
    """UI/UX検証の最終結果。"""

    target: str
    findings: list[Finding] = Field(default_factory=list)
    summary: str = ""
    axe_violations: list[AxeViolation] = Field(default_factory=list)
    lighthouse: LighthouseScores = Field(default_factory=LighthouseScores)

    def count_by_severity(self) -> dict[str, int]:
        """severity別の件数を集計する。"""
        counts = {s.value: 0 for s in Severity}
        for f in self.findings:
            counts[f.severity.value] += 1
        return counts
