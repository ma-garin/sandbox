"""HTML からブロック構造・装飾マーク・画像参照を抽出する Extractor。

打ち消し線や強調は本文テキストに現れないため、そのまま本文化すると
「取り消された内容」を有効な記述として下流へ渡してしまう。誤情報を防ぐ
目的で StyleMark(preserved=False) として別途記録する。
"""

from __future__ import annotations

import codecs
import re
from typing import TYPE_CHECKING, Any, Iterable, Sequence

from ..models import Block, ImageRef, StyleMark
from .base import ExtractionError, build, expand_merged

if TYPE_CHECKING:  # 実行時 import を避け、models 側の定義変更に巻き込まれないようにする
    from ..models import RawDocument, SourceFile

HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")
STRIKETHROUGH_TAGS = ("del", "s", "strike")
EMPHASIS_TAGS = ("strong", "em", "b", "i")
DROP_TAGS = ("script", "style", "nav", "footer", "noscript", "iframe")
BLOCK_TAGS = HEADING_TAGS + ("p", "li", "table")
TARGET_TAGS = BLOCK_TAGS + STRIKETHROUGH_TAGS + EMPHASIS_TAGS + ("img",)
# li / table の内側の p などを二重に拾わないための「消費済み」コンテナ
CONTAINER_TAGS = ("li", "table")

DEFAULT_ENCODING = "utf-8"
HEAD_BYTES = 4096
# 不正・悪意ある colspan/rowspan によるメモリ膨張を防ぐ上限
MAX_SPAN = 100
_CHARSET_RE = re.compile(rb"""<meta[^>]+charset=["']?\s*([A-Za-z0-9_\-]+)""", re.IGNORECASE)


def _import_soup() -> Any:
    """BeautifulSoup を遅延 import する（未インストールでもモジュール import は成功させる）。"""
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise ExtractionError("beautifulsoup4 がインストールされていません") from exc
    return BeautifulSoup


def _meta_charset(data: bytes) -> str | None:
    """先頭バイト列から meta charset を読み取る。"""
    match = _CHARSET_RE.search(data[:HEAD_BYTES])
    if not match:
        return None
    name = match.group(1).decode("ascii", errors="ignore")
    try:
        codecs.lookup(name)
    except LookupError:
        return None
    return name


def _detected_charset(data: bytes) -> str | None:
    """charset-normalizer による文字コード推定（未インストール時は None）。"""
    try:
        from charset_normalizer import from_bytes
    except ImportError:
        return None
    best = from_bytes(data).best()
    return best.encoding if best is not None else None


def _decode(data: bytes) -> str:
    """meta charset → charset-normalizer の順で文字コードを判定して復号する。"""
    for encoding in (_meta_charset(data), _detected_charset(data)):
        if not encoding:
            continue
        try:
            return data.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return data.decode(DEFAULT_ENCODING, errors="replace")


def _parse(markup: str) -> Any:
    """lxml で解析し、利用できない場合は標準パーサへフォールバックする。"""
    soup_class = _import_soup()
    try:
        return soup_class(markup, "lxml")
    except Exception:
        return soup_class(markup, "html.parser")


def _strip_noise(soup: Any) -> Any:
    """本文でないタグを除去する。"""
    for element in soup.find_all(list(DROP_TAGS)):
        element.decompose()
    return soup


def _text_of(element: Any) -> str:
    return element.get_text(" ", strip=True)


def _span(cell: Any, name: str) -> int:
    """colspan / rowspan を安全な整数へ正規化する。"""
    try:
        value = int(str(cell.get(name, "1")).strip())
    except (TypeError, ValueError):
        return 1
    return max(1, min(value, MAX_SPAN))


def _own_rows(table: Any) -> list[Any]:
    """入れ子テーブルの行を除いた、この table 自身の tr を返す。"""
    return [row for row in table.find_all("tr") if row.find_parent("table") is table]


def _fill_grid(table: Any) -> dict[tuple[int, int], str]:
    """colspan / rowspan を展開した (行, 列) → セル文字列の写像を作る。"""
    grid: dict[tuple[int, int], str] = {}
    for row_index, row in enumerate(_own_rows(table)):
        column = 0
        for cell in row.find_all(["td", "th"], recursive=False):
            while (row_index, column) in grid:
                column += 1
            text = _text_of(cell)
            colspan, rowspan = _span(cell, "colspan"), _span(cell, "rowspan")
            for offset_row in range(rowspan):
                for offset_col in range(colspan):
                    grid[(row_index + offset_row, column + offset_col)] = text
            column += colspan
    return grid


def _expand_table(table: Any) -> list[list[str]]:
    """結合セルを展開した矩形の行リストを返す。"""
    grid = _fill_grid(table)
    if not grid:
        return []
    height = max(row for row, _ in grid) + 1
    width = max(column for _, column in grid) + 1
    return [[grid.get((row, column), "") for column in range(width)] for row in range(height)]


def _is_nested(element: Any) -> bool:
    """li / table の内側にあるブロック要素かを判定する。"""
    return element.find_parent(list(CONTAINER_TAGS)) is not None


def _heading_block(element: Any, position: str) -> Block | None:
    text = _text_of(element)
    if not text:
        return None
    return Block(kind="heading", text=text, level=int(element.name[1]), position=position)


def _text_block(element: Any, kind: str, position: str) -> Block | None:
    text = _text_of(element)
    if not text:
        return None
    return Block(kind=kind, text=text, position=position)


def _table_block(element: Any, position: str) -> Block | None:
    rows = expand_merged(_expand_table(element))
    if not rows:
        return None
    return Block(kind="table", table_rows=rows, position=position)


def _to_block(element: Any, position: str) -> Block | None:
    """対象要素を Block へ変換する（本文として扱わない場合は None）。"""
    name = element.name
    if name in HEADING_TAGS:
        return _heading_block(element, position)
    if name == "p":
        return _text_block(element, "paragraph", position)
    if name == "li":
        return _text_block(element, "list", position)
    if name == "table":
        return _table_block(element, position)
    return None


def _to_style_mark(element: Any, position: str) -> StyleMark | None:
    """装飾タグを StyleMark へ変換する。本文へは反映されないため preserved=False。"""
    text = _text_of(element)
    if not text:
        return None
    if element.name in STRIKETHROUGH_TAGS:
        return StyleMark(kind="strikethrough", text=text, position=position, preserved=False)
    return StyleMark(kind="emphasis", text=text, position=position, preserved=False)


def _collect(soup: Any) -> tuple[tuple[Block, ...], tuple[StyleMark, ...], tuple[ImageRef, ...]]:
    """文書順に走査し、ブロック・装飾マーク・画像を収集する。"""
    blocks: list[Block] = []
    marks: list[StyleMark] = []
    images: list[ImageRef] = []
    for index, element in enumerate(soup.find_all(list(TARGET_TAGS)), start=1):
        position = f"e{index}"
        name = element.name
        if name == "img":
            images.append(ImageRef(position=position, count=1, kind="image"))
        elif name in STRIKETHROUGH_TAGS or name in EMPHASIS_TAGS:
            mark = _to_style_mark(element, position)
            if mark is not None:
                marks.append(mark)
        elif not _is_nested(element) or name in CONTAINER_TAGS:
            block = _to_block(element, position)
            if block is not None:
                blocks.append(block)
    return tuple(blocks), tuple(marks), tuple(images)


def _warnings(blocks: Sequence[Block], marks: Iterable[StyleMark]) -> tuple[str, ...]:
    """欠落や誤読の恐れを診断できるよう警告を組み立てる。"""
    warnings: list[str] = []
    if not blocks:
        warnings.append("本文ブロックを抽出できませんでした（抽出率0）")
    struck = sum(1 for mark in marks if mark.kind == "strikethrough")
    if struck:
        warnings.append(f"打ち消し線を{struck}件検出（本文には反映されていません）")
    return tuple(warnings)


class HtmlExtractor:
    """BeautifulSoup4 を用いた HTML 抽出器。"""

    extensions: tuple[str, ...] = (".html", ".htm")

    def extract(self, source: SourceFile) -> RawDocument:
        """HTML を読み取り RawDocument を返す。失敗時は ExtractionError を送出する。"""
        try:
            with open(source.path, "rb") as handle:
                data = handle.read()
            soup = _strip_noise(_parse(_decode(data)))
            blocks, marks, images = _collect(soup)
        except ExtractionError:
            raise
        except Exception as exc:
            raise ExtractionError(f"HTMLの抽出に失敗しました: {source.path}: {exc}") from exc
        return build(
            source,
            blocks,
            images=images,
            style_marks=marks,
            warnings=_warnings(blocks, marks),
        )
