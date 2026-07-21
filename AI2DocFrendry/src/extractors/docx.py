"""Word (.docx) 抽出器。

打ち消し線・色・強調は本文テキストに一切現れない。
そのまま下流へ流すと「削除済みの記述」が有効な仕様として読まれるため、
StyleMark(preserved=False) として必ず記録する（FR-08 / RESEARCH.md §2-2）。
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from ..models import Block, ImageRef, RawDocument, SourceFile, StyleMark
from .base import Extractor, ExtractionError, build, expand_merged

_IMPORT_ERROR = ""
try:
    from docx import Document as _open_document
    from docx.table import Table as _Table
    from docx.text.paragraph import Paragraph as _Paragraph
    from lxml import etree as _etree
except Exception as _exc:  # ライブラリ未導入でも import 時に落とさない（NFR-13）
    _open_document = None  # type: ignore[assignment]
    _Table = None  # type: ignore[assignment]
    _Paragraph = None  # type: ignore[assignment]
    _etree = None  # type: ignore[assignment]
    _IMPORT_ERROR = str(_exc)

_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_P_TAG = f"{{{_W}}}p"
_TBL_TAG = f"{{{_W}}}tbl"
_T_TAG = f"{{{_W}}}t"
_FOOTNOTE_TAG = f"{{{_W}}}footnote"
_TYPE_ATTR = f"{{{_W}}}type"
_ID_ATTR = f"{{{_W}}}id"

_HEADING_RE = re.compile(r"(?:heading|見出し)\s*([1-9])", re.IGNORECASE)
_LIST_HINTS = ("list", "リスト", "箇条書き", "段落番号")
_SKIP_FOOTNOTES = ("separator", "continuationSeparator", "continuationNotice")


class DocxExtractor:
    """python-docx を用いた .docx 抽出器。"""

    extensions: tuple[str, ...] = (".docx",)

    def extract(self, source: SourceFile) -> RawDocument:
        """.docx を RawDocument に変換する。失敗は ExtractionError で送出する。"""
        if _open_document is None:
            raise ExtractionError(f"python-docx が利用できません: {_IMPORT_ERROR}")
        try:
            document = _open_document(source.path)
            blocks, images, marks = _walk_body(document)
            blocks.extend(_footnote_blocks(document))
        except ExtractionError:
            raise
        except Exception as exc:
            raise ExtractionError(f"docx の抽出に失敗しました: {source.path}: {exc}") from exc
        return build(source, blocks, images, marks, _warnings(marks))


def _walk_body(document: Any) -> tuple[list[Block], list[ImageRef], list[StyleMark]]:
    """本文を出現順に走査する。段落と表の前後関係は文意そのものなので崩さない。"""
    blocks: list[Block] = []
    images: list[ImageRef] = []
    marks: list[StyleMark] = []
    body = document.element.body
    index = 0
    for child in body.iterchildren():
        if child.tag == _P_TAG:
            index += 1
            position = f"p{index}"
            paragraph = _Paragraph(child, document)
            block = _paragraph_block(paragraph, position)
            if block is not None:
                blocks.append(block)
            marks.extend(_paragraph_marks(paragraph, position))
            images.extend(_paragraph_images(paragraph, position))
        elif child.tag == _TBL_TAG:
            index += 1
            blocks.append(_table_block(_Table(child, document), f"p{index}"))
    return blocks, images, marks


def _paragraph_block(paragraph: Any, position: str) -> Block | None:
    """段落を Block にする。空段落は情報を持たないため捨てる。"""
    text = (paragraph.text or "").strip()
    if not text:
        return None
    style_name = _style_name(paragraph)
    level = _heading_level(style_name)
    if level:
        return Block(kind="heading", text=text, level=level, position=position)
    if _is_list(paragraph, style_name):
        return Block(kind="list", text=text, level=_list_level(paragraph), position=position)
    return Block(kind="paragraph", text=text, position=position)


def _paragraph_marks(paragraph: Any, position: str) -> list[StyleMark]:
    """run 単位で意味を担う書式を拾う。本文に残らないため取りこぼすと復元不能。"""
    marks: list[StyleMark] = []
    for run in paragraph.runs:
        text = (run.text or "").strip()
        if not text:
            continue
        font = run.font
        if font.strike or getattr(font, "double_strike", False):
            marks.append(StyleMark(kind="strikethrough", text=text, position=position))
        if run.bold or run.italic:
            marks.append(StyleMark(kind="emphasis", text=text, position=position))
        if _color_of(font):
            marks.append(StyleMark(kind="color", text=text, position=position))
    return marks


def _color_of(font: Any) -> str:
    """文字色を取得する。テーマ色指定の場合 rgb 参照は例外になる。"""
    try:
        color = font.color
        if color is None or color.rgb is None:
            return ""
        return str(color.rgb)
    except Exception:
        return ""


def _paragraph_images(paragraph: Any, position: str) -> list[ImageRef]:
    """インライン画像・グラフを数える。本文テキストには含めない。"""
    refs: list[ImageRef] = []
    charts = 0
    pictures = 0
    for drawing in paragraph._p.iter():
        tag = str(drawing.tag)
        if tag.endswith("}chart"):
            charts += 1
        elif tag.endswith("}blip"):
            pictures += 1
    if pictures:
        refs.append(ImageRef(position=position, count=pictures, kind="image"))
    if charts:
        refs.append(ImageRef(position=position, count=charts, kind="chart"))
    return refs


def _table_block(table: Any, position: str) -> Block:
    """表を Block にする。結合セルは矩形展開し行列対応を保つ（FR-07）。"""
    rows: list[list[str]] = []
    for row in table.rows:
        rows.append([_cell_text(cell) for cell in _cells_of(row)])
    return Block(kind="table", table_rows=expand_merged(rows), position=position)


def _cells_of(row: Any) -> Iterable[Any]:
    """行のセル列を取得する。不正な grid を持つ表では cells が例外になる。"""
    try:
        return list(row.cells)
    except Exception:
        return []


def _cell_text(cell: Any) -> str:
    return " ".join((p.text or "").strip() for p in cell.paragraphs).strip()


def _footnote_blocks(document: Any) -> list[Block]:
    """脚注を抽出する。python-docx は API を公開しないため XML を直接読む。"""
    part = _footnotes_part(document)
    if part is None or _etree is None:
        return []
    try:
        root = _etree.fromstring(part.blob)
    except Exception:
        return []
    blocks: list[Block] = []
    for footnote in root.findall(_FOOTNOTE_TAG):
        if footnote.get(_TYPE_ATTR, "") in _SKIP_FOOTNOTES:
            continue
        text = "".join(node.text or "" for node in footnote.iter(_T_TAG)).strip()
        if not text:
            continue
        note_id = footnote.get(_ID_ATTR, str(len(blocks) + 1))
        blocks.append(Block(kind="footnote", text=text, position=f"footnote{note_id}"))
    return blocks


def _footnotes_part(document: Any) -> Any:
    try:
        for rel in document.part.rels.values():
            if rel.reltype.endswith("/footnotes") and not rel.is_external:
                return rel.target_part
    except Exception:
        return None
    return None


def _style_name(paragraph: Any) -> str:
    try:
        return (paragraph.style.name or "").strip()
    except Exception:
        return ""


def _heading_level(style_name: str) -> int:
    """見出しレベルを返す。0 は見出しでないことを示す。"""
    matched = _HEADING_RE.search(style_name)
    return int(matched.group(1)) if matched else 0


def _is_list(paragraph: Any, style_name: str) -> bool:
    lowered = style_name.lower()
    if any(hint in lowered for hint in _LIST_HINTS):
        return True
    return _num_pr(paragraph) is not None


def _list_level(paragraph: Any) -> int:
    """箇条書きの階層を返す。ilvl は 0 起点なので 1 起点に直す。"""
    num_pr = _num_pr(paragraph)
    if num_pr is None:
        return 1
    ilvl = num_pr.find(f"{{{_W}}}ilvl")
    if ilvl is None:
        return 1
    try:
        return int(ilvl.get(f"{{{_W}}}val", "0")) + 1
    except (TypeError, ValueError):
        return 1


def _num_pr(paragraph: Any) -> Any:
    try:
        return paragraph._p.find(f".//{{{_W}}}numPr")
    except Exception:
        return None


def _warnings(marks: list[StyleMark]) -> list[str]:
    """失われた書式を件数で警告する。特に打ち消し線は誤情報に直結する。"""
    warnings: list[str] = []
    struck = sum(1 for m in marks if m.kind == "strikethrough")
    if struck:
        warnings.append(f"打ち消し線 {struck} 箇所は本文に反映されていません")
    colored = sum(1 for m in marks if m.kind == "color")
    if colored:
        warnings.append(f"文字色による意味付け {colored} 箇所は本文に反映されていません")
    return warnings


#: 契約充足を型検査で担保する（実行時の副作用はない）
_CONTRACT: Extractor = DocxExtractor()
