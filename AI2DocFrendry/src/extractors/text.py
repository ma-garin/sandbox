"""プレーンテキスト系（Markdown / テキスト）の抽出実装。"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING

from ..models import Block, SourceFile, StyleMark
from .base import ExtractionError, build, expand_merged

if TYPE_CHECKING:  # 実行時 import は不要（型注釈は文字列評価されるため）
    from ..models import RawDocument


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
MD_LIST_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)$")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
TABLE_SEPARATOR_RE = re.compile(r"^\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$|^\|(?:\s*:?-{2,}:?\s*\|)+$")

TEXT_LIST_RE = re.compile(r"^\s*(?:\(\d+\)|\d+[.)]|[・\-*])\s*\S")

INLINE_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"~~(.+?)~~"), "strikethrough"),
    (re.compile(r"\*\*(.+?)\*\*"), "emphasis"),
    (re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)"), "emphasis"),
)

HEADING_MAX_LENGTH = 40
SENTENCE_ENDINGS = ("。", "．", ".", "！", "!", "？", "?")
HEADING_GUESS_WARNING = "見出しは推定です"


def _position(line_index: int) -> str:
    """0 始まりの行番号を人間が読める位置表現へ変換する。"""
    return f"line:{line_index + 1}"


def _detect_text(raw: bytes, path: str) -> str:
    """charset-normalizer で文字コードを判定して文字列化する。"""
    try:
        from charset_normalizer import from_bytes
    except ImportError as exc:  # 依存未導入は抽出不能として扱う
        raise ExtractionError(f"charset-normalizer が利用できません: {path}") from exc

    best = from_bytes(raw).best()
    if best is None:
        raise ExtractionError(f"文字コードを判定できません: {path}")
    return str(best)


def read_source_text(source: SourceFile) -> str:
    """SourceFile を文字コード判定付きで読み込む。"""
    try:
        raw = Path(source.path).read_bytes()
    except OSError as exc:
        raise ExtractionError(f"ファイルを読み込めません: {source.path}") from exc
    if not raw:
        return ""
    return _detect_text(raw, str(source.path))


def _split_inline_styles(text: str, line_index: int) -> tuple[str, tuple[StyleMark, ...]]:
    """装飾記法を取り除き、失われる装飾を StyleMark として返す。"""
    plain = text
    marks: list[StyleMark] = []
    for pattern, kind in INLINE_PATTERNS:
        found = [m.group(1) for m in pattern.finditer(plain)]
        if not found:
            continue
        marks.extend(
            StyleMark(kind=kind, text=inner, position=_position(line_index), preserved=False)
            for inner in found
        )
        plain = pattern.sub(lambda m: m.group(1), plain)
    return plain, tuple(marks)


def _is_table_separator(line: str) -> bool:
    """Markdown 表の区切り行かどうかを判定する。"""
    stripped = line.strip()
    if "|" not in stripped or "-" not in stripped:
        return False
    return bool(TABLE_SEPARATOR_RE.match(stripped))


def _is_table_start(lines: tuple[str, ...], index: int) -> bool:
    """行が Markdown 表の先頭かどうかを判定する。"""
    if not lines[index].strip().startswith("|"):
        return False
    return index + 1 < len(lines) and _is_table_separator(lines[index + 1])


def _split_table_row(line: str) -> list[str]:
    """表の 1 行をセル列へ分解する。"""
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def _consume_fence(lines: tuple[str, ...], start: int) -> tuple[Block, int]:
    """コードフェンスを解釈せずそのまま paragraph 化する。"""
    match = FENCE_RE.match(lines[start])
    marker = match.group(1) if match else "```"
    collected = [lines[start]]
    index = start + 1
    while index < len(lines):
        collected.append(lines[index])
        closed = lines[index].strip().startswith(marker)
        index += 1
        if closed:
            break
    block = Block(kind="paragraph", text="\n".join(collected), position=_position(start))
    return block, index


def _consume_table(lines: tuple[str, ...], start: int) -> tuple[Block, int]:
    """連続する表行を 1 つの table ブロックへまとめる。"""
    rows: list[list[str]] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        if not _is_table_separator(lines[index]):
            rows.append(_split_table_row(lines[index]))
        index += 1
    block = Block(kind="table", table_rows=expand_merged(rows), position=_position(start))
    return block, index


def _make_text_block(kind: str, text: str, line_index: int, level: int = 0) -> tuple[Block, tuple[StyleMark, ...]]:
    """装飾を除去したテキストからブロックと StyleMark を作る。"""
    plain, marks = _split_inline_styles(text.strip(), line_index)
    block = Block(kind=kind, text=plain, level=level, position=_position(line_index))
    return block, marks


def _flush_paragraph(buffer: tuple[tuple[int, str], ...]) -> tuple[tuple[Block, ...], tuple[StyleMark, ...]]:
    """溜めた行を 1 つの paragraph ブロックへ確定する。"""
    if not buffer:
        return (), ()
    start = buffer[0][0]
    joined = "\n".join(line for _, line in buffer)
    block, marks = _make_text_block("paragraph", joined, start)
    return (block,), marks


class MarkdownExtractor:
    """Markdown を見出し・箇条書き・表・段落へ構造化する抽出器。"""

    extensions: tuple[str, ...] = (".md", ".markdown")

    def extract(self, source: SourceFile) -> RawDocument:
        """Markdown ファイルから RawDocument を組み立てる。"""
        lines = tuple(read_source_text(source).splitlines())
        blocks, marks = self._parse(lines)
        return build(source, blocks, style_marks=marks)

    def _parse(self, lines: tuple[str, ...]) -> tuple[tuple[Block, ...], tuple[StyleMark, ...]]:
        """行列を走査してブロック列と装飾情報を返す。"""
        blocks: tuple[Block, ...] = ()
        marks: tuple[StyleMark, ...] = ()
        buffer: tuple[tuple[int, str], ...] = ()
        index = 0
        while index < len(lines):
            line = lines[index]
            special, index = self._parse_special(lines, index)
            if special is not None:
                flushed, flushed_marks = _flush_paragraph(buffer)
                buffer = ()
                blocks = blocks + flushed + (special,)
                marks = marks + flushed_marks
                continue
            simple = self._parse_simple(line, index)
            index += 1
            if simple is None:
                flushed, flushed_marks = _flush_paragraph(buffer)
                buffer = ()
                blocks, marks = blocks + flushed, marks + flushed_marks
                continue
            if simple == ():
                buffer = buffer + ((index - 1, line),)
                continue
            flushed, flushed_marks = _flush_paragraph(buffer)
            buffer = ()
            blocks = blocks + flushed + (simple[0],)
            marks = marks + flushed_marks + simple[1]
        flushed, flushed_marks = _flush_paragraph(buffer)
        return blocks + flushed, marks + flushed_marks

    def _parse_special(self, lines: tuple[str, ...], index: int) -> tuple[Block | None, int]:
        """コードフェンスと表という複数行構造を処理する。"""
        if FENCE_RE.match(lines[index]):
            return _consume_fence(lines, index)
        if _is_table_start(lines, index):
            return _consume_table(lines, index)
        return None, index

    def _parse_simple(
        self, line: str, index: int
    ) -> tuple[Block, tuple[StyleMark, ...]] | tuple[()] | None:
        """単一行の見出し・箇条書きを判定する。

        None は空行、空タプルは段落への継続を意味する。
        """
        if not line.strip():
            return None
        heading = HEADING_RE.match(line)
        if heading:
            return _make_text_block("heading", heading.group(2), index, level=len(heading.group(1)))
        listed = MD_LIST_RE.match(line)
        if listed:
            return _make_text_block("list", listed.group(1), index)
        return ()


class TextExtractor:
    """プレーンテキストを段落・箇条書き・推定見出しへ構造化する抽出器。"""

    extensions: tuple[str, ...] = (".txt", ".text")

    def extract(self, source: SourceFile) -> RawDocument:
        """テキストファイルから RawDocument を組み立てる。"""
        lines = tuple(read_source_text(source).splitlines())
        blocks, guessed = self._parse(lines)
        warnings = (HEADING_GUESS_WARNING,) if guessed else ()
        return build(source, blocks, warnings=warnings)

    def _parse(self, lines: tuple[str, ...]) -> tuple[tuple[Block, ...], bool]:
        """行列をブロック列へ変換し、見出し推定の有無を返す。"""
        blocks: tuple[Block, ...] = ()
        buffer: tuple[tuple[int, str], ...] = ()
        guessed = False
        for index, line in enumerate(lines):
            if not line.strip():
                blocks = blocks + _plain_paragraph(buffer)
                buffer = ()
                continue
            if TEXT_LIST_RE.match(line):
                blocks = blocks + _plain_paragraph(buffer) + (
                    Block(kind="list", text=line.strip(), position=_position(index)),
                )
                buffer = ()
                continue
            if not buffer and _looks_like_heading(lines, index):
                guessed = True
                blocks = blocks + (
                    Block(kind="heading", text=line.strip(), level=1, position=_position(index)),
                )
                continue
            buffer = buffer + ((index, line),)
        return blocks + _plain_paragraph(buffer), guessed


def _plain_paragraph(buffer: tuple[tuple[int, str], ...]) -> tuple[Block, ...]:
    """溜めた行を装飾解釈なしの paragraph ブロックにする。"""
    if not buffer:
        return ()
    text = "\n".join(line.strip() for _, line in buffer)
    return (Block(kind="paragraph", text=text, position=_position(buffer[0][0])),)


def _looks_like_heading(lines: tuple[str, ...], index: int) -> bool:
    """短く・直後が空行・句点で終わらない行を見出し候補とみなす。"""
    stripped = lines[index].strip()
    if not stripped or len(stripped) >= HEADING_MAX_LENGTH:
        return False
    if stripped.endswith(SENTENCE_ENDINGS):
        return False
    next_index = index + 1
    return next_index >= len(lines) or not lines[next_index].strip()
