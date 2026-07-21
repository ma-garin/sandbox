"""中間データモデル。

すべて frozen（不変）。各処理段は入力を受け取り新しいオブジェクトを返す。
仕様: docs/SPECIFICATION.md 2章
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Literal

# ---------------------------------------------------------------- 列挙

Status = Literal["ok", "skipped", "failed"]
BlockKind = Literal["heading", "paragraph", "list", "table", "footnote"]
StyleKind = Literal["strikethrough", "emphasis", "color", "textbox"]
NoiseType = Literal["semantic", "formatting"]
Severity = Literal["Critical", "High", "Medium", "Low"]
Grade = Literal["A", "B", "C", "D"]


class Dimension(str, Enum):
    """ICIS 2025 のデータ品質次元（RFD ADR-11）。"""

    INTRINSIC = "Intrinsic"
    CONTEXTUAL = "Contextual"
    REPRESENTATIONAL = "Representational"
    ACCESSIBILITY = "Accessibility"
    ACCOUNTABILITY = "Accountability"


# ---------------------------------------------------------------- 取り込み


@dataclass(frozen=True)
class SourceFile:
    path: str
    ext: str
    size: int
    mtime: float
    sha256: str
    status: Status = "ok"
    reason: str = ""

    def failed(self, reason: str) -> SourceFile:
        return replace(self, status="failed", reason=reason)

    def skipped(self, reason: str) -> SourceFile:
        return replace(self, status="skipped", reason=reason)


# ---------------------------------------------------------------- 抽出


@dataclass(frozen=True)
class Block:
    """文書の構造単位。table_rows は table のときのみ使う。"""

    kind: BlockKind
    text: str = ""
    level: int = 0
    table_rows: tuple[tuple[str, ...], ...] = ()
    position: str = ""

    @property
    def is_table(self) -> bool:
        return self.kind == "table"


@dataclass(frozen=True)
class StyleMark:
    """意味を担う書式（FR-08）。

    preserved=False は本文に反映されずに失われたことを示す。
    OCR精度82.9%に対しRAG精度52.8%という実例（RESEARCH.md §2-2）への対策。
    """

    kind: StyleKind
    text: str
    position: str = ""
    preserved: bool = False


@dataclass(frozen=True)
class ImageRef:
    position: str
    count: int = 1
    kind: Literal["image", "chart"] = "image"


@dataclass(frozen=True)
class RawDocument:
    source: SourceFile
    blocks: tuple[Block, ...] = ()
    images: tuple[ImageRef, ...] = ()
    style_marks: tuple[StyleMark, ...] = ()
    warnings: tuple[str, ...] = ()

    @property
    def text_length(self) -> int:
        return sum(len(b.text) for b in self.blocks) + sum(
            len(cell) for b in self.blocks for row in b.table_rows for cell in row
        )

    @property
    def has_complex_table(self) -> bool:
        """結合セル・階層ヘッダを含む表があるか（HTML併記の判定 / ADR-04）。"""
        return any(b.is_table and _looks_hierarchical(b) for b in self.blocks)


def _looks_hierarchical(block: Block) -> bool:
    """同一行に値の重複があれば結合セルを展開した痕跡とみなす。"""
    if len(block.table_rows) < 2:
        return False
    header = block.table_rows[0]
    return len(header) != len(set(header))


# ---------------------------------------------------------------- 正規化・構造化


@dataclass(frozen=True)
class TermVariant:
    canonical: str
    found: str
    position: str = ""


@dataclass(frozen=True)
class NormalizedDoc:
    source: SourceFile
    blocks: tuple[Block, ...] = ()
    images: tuple[ImageRef, ...] = ()
    style_marks: tuple[StyleMark, ...] = ()
    removed_noise: tuple[str, ...] = ()
    encoding: str = "utf-8"
    variants: tuple[TermVariant, ...] = ()
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class StructuredDoc:
    source: SourceFile
    front_matter: dict[str, object] = field(default_factory=dict)
    markdown: str = ""
    tables_html: dict[str, str] = field(default_factory=dict)
    headings: tuple[str, ...] = ()


# ---------------------------------------------------------------- 再構成・検証


@dataclass(frozen=True)
class Operation:
    op_id: str
    kind: str
    before: str
    after: str
    location: str = ""
    method: Literal["rule", "llm"] = "rule"
    confidence: float = 1.0
    applied: bool = True
    reason: str = ""


@dataclass(frozen=True)
class VerifyResult:
    violations: tuple[str, ...] = ()
    rolled_back: tuple[str, ...] = ()

    @property
    def ok(self) -> bool:
        return not self.violations


# ---------------------------------------------------------------- 分割


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    parent_doc_id: str
    heading_path: tuple[str, ...]
    context_prefix: str
    text: str
    token_count: int
    source_path: str


# ---------------------------------------------------------------- 診断


@dataclass(frozen=True)
class Finding:
    """指摘。根拠（evidence）のないものは生成しない（FR-48）。"""

    dimension: Dimension
    noise_type: NoiseType
    severity: Severity
    message: str
    evidence_quote: str
    evidence_location: str
    action: str

    def __post_init__(self) -> None:
        if not self.evidence_quote:
            raise ValueError(f"根拠のない指摘は生成できません: {self.message}")


@dataclass(frozen=True)
class DocScore:
    dimension_scores: dict[str, int] = field(default_factory=dict)
    semantic_score: int = 100
    formatting_score: int = 100
    findings: tuple[Finding, ...] = ()

    @property
    def total(self) -> int:
        """Semantic:Formatting = 0.75:0.25（FR-45）。

        Formatting Noise はモデル進化とともに影響が減るが、
        Semantic Noise は減らない（OHRBench）。
        """
        return round(self.semantic_score * 0.75 + self.formatting_score * 0.25)

    @property
    def has_critical(self) -> bool:
        return any(f.severity == "Critical" for f in self.findings)

    @property
    def grade(self) -> Grade:
        """Critical が1件でもあれば無条件でD（安全側）。"""
        if self.has_critical:
            return "D"
        total = self.total
        if total >= 85:
            return "A"
        if total >= 70:
            return "B"
        if total >= 50:
            return "C"
        return "D"
