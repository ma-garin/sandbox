"""構造化段（SPECIFICATION.md 3-4 / FR-19）。

NormalizedDoc を Markdown（層0の正本）へ再構成する。
無関係なマークアップは持ち込まない。フォーマットノイズは表で−18.4pt、
数式で−19.4pt の精度低下を招く（RESEARCH.md）。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import PurePosixPath

from .models import Block, ImageRef, NormalizedDoc, StructuredDoc, StyleMark, _looks_hierarchical

# 画像1点あたりの推定情報量。抽出率（FR-11）を画像だけの文書で 0 に寄せるための係数
_CHARS_PER_IMAGE = 200

_MAX_HEADING = 6

_STYLE_LABEL: dict[str, str] = {
    "strikethrough": "打ち消し線",
    "emphasis": "強調",
    "color": "文字色",
    "textbox": "テキストボックス",
}


def structure(doc: NormalizedDoc) -> StructuredDoc:
    """NormalizedDoc を Markdown 化した StructuredDoc を返す（純粋関数）。"""
    markdown, tables_html = _render(doc)
    headings = tuple(b.text for b in doc.blocks if b.kind == "heading" and b.text)
    return StructuredDoc(
        source=doc.source,
        front_matter=_front_matter(doc, headings),
        markdown=markdown,
        tables_html=tables_html,
        headings=headings,
    )


# ---------------------------------------------------------------- front matter


def _extraction_rate(doc: NormalizedDoc) -> float:
    """抽出文字数 ÷ 推定情報量（FR-11）。画像だけの文書ほど 0 に近づく。"""
    text_chars = sum(len(b.text) for b in doc.blocks)
    text_chars += sum(len(c) for b in doc.blocks for row in b.table_rows for c in row)
    estimated = text_chars + sum(img.count for img in doc.images) * _CHARS_PER_IMAGE
    if estimated == 0:
        return 0.0
    return round(text_chars / estimated, 4)


def _front_matter(doc: NormalizedDoc, headings: tuple[str, ...]) -> dict[str, object]:
    """front matter を組み立てる。値は文書とファイル属性のみに由来する。"""
    source = doc.source
    stem = PurePosixPath(source.path.replace("\\", "/")).stem
    updated = datetime.fromtimestamp(source.mtime, tz=timezone.utc).isoformat()
    return {
        "doc_id": source.sha256[:12],
        "title": headings[0] if headings else stem,
        "source_path": source.path,
        "source_ext": source.ext,
        "updated_at": updated,
        "sha256": source.sha256,
        "extraction_rate": _extraction_rate(doc),
    }


# ---------------------------------------------------------------- 注記


def _image_comment(image: ImageRef) -> str:
    suffix = f" x{image.count}" if image.count > 1 else ""
    return f"<!-- {image.kind}: {image.position}{suffix}, 本文抽出なし -->"


def _style_comment(mark: StyleMark) -> str:
    """失われた書式を警告として残す（FR-08）。

    打ち消し線が消えると、取り消された内容が有効な事実として下流に届く。
    """
    label = _STYLE_LABEL.get(mark.kind, mark.kind)
    return f'<!-- 警告: {label} "{mark.text}" が本文に反映されていない -->'


def _annotations(doc: NormalizedDoc) -> dict[str, list[str]]:
    """position ごとの注記コメントを集める。"""
    out: dict[str, list[str]] = defaultdict(list)
    for image in doc.images:
        out[image.position].append(_image_comment(image))
    for mark in doc.style_marks:
        if not mark.preserved:
            out[mark.position].append(_style_comment(mark))
    return dict(out)


# ---------------------------------------------------------------- 表


def _cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ").strip()


def _markdown_table(rows: tuple[tuple[str, ...], ...]) -> str:
    """1行目をヘッダとする Markdown 表を返す。"""
    header, *body = rows
    lines = ["| " + " | ".join(_cell(c) for c in header) + " |"]
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    lines.extend("| " + " | ".join(_cell(c) for c in row) + " |" for row in body)
    return "\n".join(lines)


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _runs(row: tuple[str, ...]) -> tuple[tuple[int, int], ...]:
    """行内で横に連続する同値セルを (開始列, 幅) にまとめる。"""
    out: list[tuple[int, int]] = []
    for index, value in enumerate(row):
        if out and value and value == row[index - 1]:
            start, width = out[-1]
            out[-1] = (start, width + 1)
        else:
            out.append((index, 1))
    return tuple(out)


def _row_html(
    rows: tuple[tuple[str, ...], ...], index: int, spans: dict[tuple[int, int], int], tag: str
) -> str:
    """1行分の <tr> を返す。直上と同値の区画は縦結合済みとみなし省く。"""
    row = rows[index]
    above = rows[index - 1] if index else None
    cells: list[str] = []
    for start, width in _runs(row):
        segment = slice(start, start + width)
        if row[start] and above is not None and above[segment] == row[segment]:
            continue
        height = min(spans.get((index, col), 1) for col in range(start, start + width))
        attrs = f' colspan="{width}"' if width > 1 else ""
        attrs += f' rowspan="{height}"' if height > 1 else ""
        cells.append(f"<{tag}{attrs}>{_escape(row[start])}</{tag}>")
    return "  <tr>" + "".join(cells) + "</tr>"


def _rowspans(rows: tuple[tuple[str, ...], ...]) -> dict[tuple[int, int], int]:
    """(行, 列) ごとの縦結合数を求める。"""
    spans: dict[tuple[int, int], int] = {}
    for col in range(len(rows[0])):
        row = 0
        while row < len(rows):
            end = row + 1
            while end < len(rows) and rows[end][col] and rows[end][col] == rows[row][col]:
                end += 1
            spans[(row, col)] = end - row
            row = end
    return spans


def _html_table(rows: tuple[tuple[str, ...], ...]) -> str:
    """結合セルを rowspan / colspan として復元した HTML 表を返す（ADR-04）。"""
    spans = _rowspans(rows)
    lines = ["<table>"]
    lines.extend(
        _row_html(rows, index, spans, "th" if index == 0 else "td") for index in range(len(rows))
    )
    lines.append("</table>")
    return "\n".join(lines)


def _table_key(position: str, used: dict[str, str]) -> str:
    base = position or f"table{len(used) + 1}"
    key = base
    suffix = 2
    while key in used:
        key = f"{base}-{suffix}"
        suffix += 1
    return key


# ---------------------------------------------------------------- 本文


def _heading(block: Block) -> str:
    level = min(max(block.level, 1), _MAX_HEADING)
    return "#" * level + " " + block.text


def _list_item(block: Block) -> str:
    indent = "  " * max(block.level - 1, 0)
    return "\n".join(
        f"{indent}- {line.strip()}" for line in block.text.splitlines() if line.strip()
    )


def _render_block(block: Block) -> str:
    """1ブロックを Markdown 断片にする。表は呼び出し側が扱う。"""
    if block.kind == "heading":
        return _heading(block)
    if block.kind == "list":
        return _list_item(block)
    return block.text


def _render(doc: NormalizedDoc) -> tuple[str, dict[str, str]]:
    """Markdown 本文と tables_html を組み立てる。"""
    annotations = _annotations(doc)
    used: dict[str, str] = {}
    parts: list[str] = []
    footnotes: list[str] = []
    for block in doc.blocks:
        if block.kind == "footnote":
            footnotes.append("> 注: " + block.text.replace("\n", " "))
        elif block.is_table and block.table_rows:
            parts.append(_markdown_table(block.table_rows))
            if _looks_hierarchical(block):
                key = _table_key(block.position, used)
                used[key] = _html_table(block.table_rows)
                parts.append(used[key])
        else:
            rendered = _render_block(block)
            if rendered:
                parts.append(rendered)
        parts.extend(annotations.pop(block.position, ()))
    # ブロックに対応づかない注記も落とさずに残す
    for position in sorted(annotations):
        parts.extend(annotations[position])
    parts.extend(footnotes)
    return "\n\n".join(parts), used
