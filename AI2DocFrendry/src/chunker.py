"""チャンク分割。

仕様: docs/SPECIFICATION.md 3-7節 / ADR-05, ADR-06, ADR-07。

分割規則はすべて実証データに基づく。通説で置き換えないこと。
- 見出し境界で分割し、semantic chunking（埋め込み類似度による分割）は行わない。
  精度差1.65pt に対し計算時間が最大54,000倍（ADR-05）。
- オーバーラップは文書種別で切り替える。表あり25%（0%比 +9.8pt / ICSE-SEIP '26）、
  表なしは極小2%（20%超で precision -40%）。
- 表は行単位でチャンクし、各行にヘッダを反復する（ADR-07 / 3GPP 392文書・21,824表）。
- 全チャンクに context_prefix を前置する（Contextual Retrieval: 検索失敗率 -35%）。

純粋関数のみ。副作用・外部ライブラリ・ネットワークアクセスを持たない。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .models import Chunk, StructuredDoc

# ---------------------------------------------------------------- 既定値

_DEFAULT_BOUNDARY_LEVELS = 3
_DEFAULT_MAX_TOKENS = 800
_DEFAULT_OVERLAP_WITH_TABLE = 0.25
_DEFAULT_OVERLAP_PLAIN = 0.02

# context_prefix が長い文書でも本文が消えないよう下限を設ける
_MIN_BODY_BUDGET = 64

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
_TABLE_SEPARATOR_RE = re.compile(r"^\s*\|[\s:\-|]+\|\s*$")
_HTML_TABLE_RE = re.compile(r"<table\b", re.IGNORECASE)
_SENTENCE_END_RE = re.compile(r"(?<=[。．！？!?])")
_ASCII_RUN_RE = re.compile(r"[0-9A-Za-z_@#$%&+=/\\'\"~^`\-\.,:;()\[\]{}<>|*!?\s]+")


@dataclass(frozen=True)
class _Section:
    """見出し境界で切り出した領域。"""

    heading_path: tuple[str, ...]
    body: str


@dataclass(frozen=True)
class _Segment:
    """セクション内の連続領域。表とそれ以外を分けて扱う。"""

    is_table: bool
    text: str


# ---------------------------------------------------------------- トークン計数


def estimate_tokens(text: str) -> int:
    """トークン数の**概算**。

    外部ライブラリ（tiktoken 等）に依存しないための近似実装であり、
    実トークナイザの結果とは一致しない。SPEC-OPEN-01 として未確定。

    近似規則:
    - ASCII（英数字・記号・空白）の連続は 4文字 ≒ 1トークン
    - それ以外（日本語など）は 1文字 ≒ 1トークン
    """
    ascii_chars = sum(len(m.group(0)) for m in _ASCII_RUN_RE.finditer(text))
    other_chars = len(text) - ascii_chars
    return max(0, -(-ascii_chars // 4) + other_chars)


# ---------------------------------------------------------------- 表の判定


def contains_table(text: str) -> bool:
    """テキストが「表を含む」かを判定する（オーバーラップ切替の条件）。

    SPEC-OPEN-02 として判定基準は未確定のため、切り出して変更しやすくしてある。

    現行の判定ロジック（いずれかを満たせば True）:
    1. Markdown表の区切り行（例 `|---|---|`）が1行以上ある
    2. `|` で始まり `|` で終わる行が連続して2行以上ある
       （区切り行を省いた表・ヘッダなし表を拾うため）
    3. `<table` タグを含む（結合セル・階層ヘッダのHTML併記 / ADR-04）

    誤検出時の影響: 表なし文書を表ありと誤れば overlap が 2%→25% となり
    precision が下がる。逆は再現率が下がる。安全側の既定は「表あり」寄り。
    """
    if _HTML_TABLE_RE.search(text):
        return True
    run = 0
    for line in text.splitlines():
        if _TABLE_SEPARATOR_RE.match(line):
            return True
        if _TABLE_ROW_RE.match(line):
            run += 1
            if run >= 2:
                return True
        else:
            run = 0
    return False


# ---------------------------------------------------------------- 見出し分割


def _split_sections(markdown: str, boundary_levels: int) -> tuple[_Section, ...]:
    """見出し境界（既定 h1〜h3）でセクションに切る。境界より深い見出しは本文に残す。"""
    sections: list[_Section] = []
    path: tuple[str, ...] = ()
    buffer: list[str] = []

    def flush(current: tuple[str, ...]) -> None:
        body = "\n".join(buffer).strip()
        if body:
            sections.append(_Section(heading_path=current, body=body))

    for line in markdown.splitlines():
        matched = _HEADING_RE.match(line)
        if matched is None or len(matched.group(1)) > boundary_levels:
            buffer.append(line)
            continue
        flush(path)
        buffer = []
        level = len(matched.group(1))
        path = path[: level - 1] + (matched.group(2).strip(),)
    flush(path)
    return tuple(sections)


def _split_segments(body: str) -> tuple[_Segment, ...]:
    """本文を表ブロックとそれ以外に分ける。"""
    segments: list[_Segment] = []
    current: list[str] = []
    current_is_table = False

    def flush() -> None:
        text = "\n".join(current).strip()
        if text:
            segments.append(_Segment(is_table=current_is_table, text=text))

    for line in body.splitlines():
        is_table_line = bool(_TABLE_ROW_RE.match(line))
        if is_table_line != current_is_table:
            flush()
            current = []
            current_is_table = is_table_line
        current.append(line)
    flush()
    return tuple(segments)


# ---------------------------------------------------------------- 本文パック


def _split_paragraphs(text: str) -> tuple[str, ...]:
    """空行を段落境界とみなす（二次分割の単位）。"""
    parts = (part.strip() for part in re.split(r"\n\s*\n", text))
    return tuple(part for part in parts if part)


def _tail_overlap(text: str, overlap_tokens: int) -> str:
    """直前チャンクの末尾から overlap_tokens 相当を取り出す。

    文単位を優先するが、1文でも予算を超える場合は文字単位で切り詰める。
    予算超過を許すと表なし文書の極小オーバーラップ（2%）が実質20%超となり、
    precision -40% の条件に踏み込むため（ADR-06）。
    """
    if overlap_tokens <= 0:
        return ""
    sentences = [s for s in _SENTENCE_END_RE.split(text) if s.strip()]
    picked: list[str] = []
    total = 0
    for sentence in reversed(sentences):
        cost = estimate_tokens(sentence)
        if total + cost > overlap_tokens:
            break
        picked.insert(0, sentence)
        total += cost
    if picked:
        return "".join(picked).strip()
    return _tail_by_chars(text, overlap_tokens)


def _tail_by_chars(text: str, overlap_tokens: int) -> str:
    """予算に収まる末尾文字列。文境界で取れないときのみ使う。"""
    tail = ""
    for char in reversed(text):
        candidate = char + tail
        if estimate_tokens(candidate) > overlap_tokens:
            break
        tail = candidate
    return tail.strip()


def _pack_paragraphs(
    paragraphs: tuple[str, ...], budget: int, overlap_tokens: int
) -> tuple[str, ...]:
    """段落を上限トークン以下に詰める。超過時のみ分割し、末尾をオーバーラップさせる。"""
    packed: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if current and estimate_tokens(candidate) > budget:
            packed.append(current)
            carry = _tail_overlap(current, overlap_tokens)
            current = f"{carry}\n\n{paragraph}" if carry else paragraph
        else:
            current = candidate
    if current:
        packed.append(current)
    return tuple(packed)


# ---------------------------------------------------------------- 表の行チャンク


def _table_lines(text: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """表テキストを (ヘッダ行群, データ行群) に分ける。"""
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return (), ()
    header: list[str] = [lines[0]]
    rest = lines[1:]
    if rest and _TABLE_SEPARATOR_RE.match(rest[0]):
        header.append(rest[0])
        rest = rest[1:]
    return tuple(header), tuple(rest)


def _table_chunks(text: str, repeat_header: bool) -> tuple[str, ...]:
    """表を行単位に分け、各行の先頭にヘッダを反復する（ADR-07）。"""
    header, rows = _table_lines(text)
    if not rows:
        return (text,) if text.strip() else ()
    if not repeat_header:
        return tuple(rows)
    prefix = "\n".join(header)
    return tuple(f"{prefix}\n{row}" for row in rows)


# ---------------------------------------------------------------- 組み立て


def _context_prefix(title: str, updated_at: str, heading_path: tuple[str, ...]) -> str:
    """"文書名 / 更新日 / 見出しパス" 形式。欠けた要素は詰めて出力する。"""
    parts = [
        value
        for value in (title, updated_at, " > ".join(heading_path))
        if value
    ]
    return " / ".join(parts)


def _as_str(value: object, default: str = "") -> str:
    return value if isinstance(value, str) and value else default


def _chunk_config(config: dict) -> dict:
    section = config.get("chunk")
    return section if isinstance(section, dict) else {}


def _overlap_tokens(has_table: bool, budget: int, conf: dict) -> int:
    """オーバーラップ率は文書種別で切り替える（ADR-06）。固定値にしないこと。"""
    ratio = (
        conf.get("overlap_ratio_with_table", _DEFAULT_OVERLAP_WITH_TABLE)
        if has_table
        else conf.get("overlap_ratio_plain", _DEFAULT_OVERLAP_PLAIN)
    )
    return int(budget * float(ratio))


def _section_bodies(section: _Section, budget: int, conf: dict) -> tuple[str, ...]:
    """1セクションを確定済みチャンク本文の列にする。"""
    has_table = contains_table(section.body)
    overlap = _overlap_tokens(has_table, budget, conf)
    row_chunking = bool(conf.get("table_row_chunking", True))
    repeat_header = bool(conf.get("repeat_table_header", True))

    bodies: list[str] = []
    for segment in _split_segments(section.body):
        if segment.is_table and row_chunking:
            bodies.extend(_table_chunks(segment.text, repeat_header))
        elif estimate_tokens(segment.text) <= budget:
            bodies.append(segment.text)
        else:
            bodies.extend(_pack_paragraphs(_split_paragraphs(segment.text), budget, overlap))
    return tuple(bodies)


def chunk(doc: StructuredDoc, markdown: str, config: dict) -> list[Chunk]:
    """StructuredDoc と Markdown 本文からチャンク列を生成する。

    doc は front_matter（doc_id / title / updated_at）とソース情報の供給元、
    markdown は分割対象の本文。両者とも変更せず、新しい Chunk を返す純粋関数。
    """
    conf = _chunk_config(config)
    boundary_levels = int(conf.get("boundary_heading_levels", _DEFAULT_BOUNDARY_LEVELS))
    max_tokens = int(conf.get("max_tokens", _DEFAULT_MAX_TOKENS))
    use_prefix = bool(conf.get("context_prefix", True))

    front = doc.front_matter
    parent_doc_id = _as_str(front.get("doc_id"), _as_str(doc.source.sha256)[:12])
    title = _as_str(front.get("title"), doc.source.path)
    updated_at = _as_str(front.get("updated_at"))
    source_path = _as_str(front.get("source_path"), doc.source.path)

    chunks: list[Chunk] = []
    for section in _split_sections(markdown, boundary_levels):
        prefix = (
            _context_prefix(title, updated_at, section.heading_path) if use_prefix else ""
        )
        budget = max(max_tokens - estimate_tokens(prefix), _MIN_BODY_BUDGET)
        for body in _section_bodies(section, budget, conf):
            text = f"{prefix}\n\n{body}" if prefix else body
            chunks.append(
                Chunk(
                    chunk_id=f"{parent_doc_id}-{len(chunks) + 1:03d}",
                    parent_doc_id=parent_doc_id,
                    heading_path=section.heading_path,
                    context_prefix=prefix,
                    text=text,
                    token_count=estimate_tokens(text),
                    source_path=source_path,
                )
            )
    return chunks
