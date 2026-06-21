from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


ReviewStatus = str


@dataclass(frozen=True)
class Evidence:
    source: str
    text: str
    confidence: float
    needs_review: bool = False


@dataclass(frozen=True)
class PageLink:
    text: str
    href: str
    is_external: bool
    evidence: Evidence


@dataclass(frozen=True)
class UIElement:
    kind: str
    label: str
    name: str
    input_type: str
    evidence: Evidence


@dataclass(frozen=True)
class ExternalAsset:
    kind: str
    url: str
    evidence: Evidence


@dataclass(frozen=True)
class PageAnalysis:
    url: str
    title: str
    description: str
    headings: list[str]
    links: list[PageLink]
    forms: list[UIElement]
    actions: list[UIElement]
    inputs: list[UIElement]
    external_assets: list[ExternalAsset]
    body_excerpt: str
    screen_type: str = "未分類"
    priority: int = 50
    discovery_reason: str = "直接指定URL"
    fetched_at: datetime = field(default_factory=datetime.now)


@dataclass(frozen=True)
class GeneratedDocument:
    title: str
    slug: str
    markdown: str
    review_status: ReviewStatus = "未レビュー"
    confidence: str = "中"
    needs_review: bool = True
    evidence: list[str] = field(default_factory=list)
    unresolved_questions: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CrawlCandidate:
    url: str
    screen_type: str
    priority: int
    reason: str


@dataclass(frozen=True)
class SystemAnalysis:
    pages: list[PageAnalysis]
    screens: list[dict[str, str]]
    features: list[dict[str, str]]
    transitions: list[dict[str, str]]
    data_items: list[dict[str, str]]
    external_interfaces: list[dict[str, str]]
    unanswered_questions: list[dict[str, str]]
    handoff_risks: list[dict[str, str]]
    traceability: list[dict[str, str]]
    kano_ux_review: list[dict[str, str]] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)
