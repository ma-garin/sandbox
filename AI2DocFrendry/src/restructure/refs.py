"""章番号参照の実体化（層1・ルールベース）。

「上記2項」→「2. 移行手順」のように、文書内の見出しで解決できる参照だけを実体化する。
別紙・添付など文書外への参照は**変更せず** applied=False の Operation として記録する。
仕様: docs/SPECIFICATION.md 3-5
"""

from __future__ import annotations

import re

from ..models import Operation

_HEADING = re.compile(r"^\s{0,3}#{1,6}\s*(\d+(?:[.\-]\d+)*)[.．、]?\s*(.+?)\s*$")
_INTERNAL = re.compile(r"(?:上記|下記|前記|後記|本)?第?(\d+(?:\.\d+)*)\s*(?:章|節|項|条)")
_EXTERNAL = re.compile(r"(別紙|別添|別表|別冊|添付資料|添付|参考資料)\s*(\d+)?")

_UNRESOLVED_EXTERNAL = "外部参照を解決できません"
_UNRESOLVED_INTERNAL = "参照先の見出しが見つかりません"


def heading_map(text: str) -> dict[str, str]:
    """「章番号 → 実体化後の文字列」を本文の見出しから作る。"""
    table: dict[str, str] = {}
    for line in text.split("\n"):
        match = _HEADING.match(line)
        if not match:
            continue
        number = match.group(1).replace("-", ".").rstrip(".")
        table.setdefault(number, f"{number}. {match.group(2)}")
    return table


def _internal_ops(line: str, row: int, table: dict[str, str], start: int) -> list[tuple]:
    """行内の内部参照を (開始, 終了, 置換後, Operation) の列に変換する。"""
    edits: list[tuple] = []
    for match in _INTERNAL.finditer(line):
        number = match.group(1)
        resolved = table.get(number)
        location = f"L{row}:{match.start()}"
        index = start + len(edits)
        if resolved is None:
            edits.append(
                (
                    match.start(),
                    match.end(),
                    match.group(0),
                    Operation(
                        op_id=f"R-{index:03d}",
                        kind="ref",
                        before=match.group(0),
                        after=match.group(0),
                        location=location,
                        method="rule",
                        confidence=1.0,
                        applied=False,
                        reason=_UNRESOLVED_INTERNAL,
                    ),
                )
            )
            continue
        edits.append(
            (
                match.start(),
                match.end(),
                resolved,
                Operation(
                    op_id=f"R-{index:03d}",
                    kind="ref",
                    before=match.group(0),
                    after=resolved,
                    location=location,
                    method="rule",
                    confidence=1.0,
                    applied=True,
                    reason="文書内の見出しで解決",
                ),
            )
        )
    return edits


def _external_ops(line: str, row: int, start: int) -> list[tuple]:
    """文書外参照は本文を変えずに警告のみを残す。"""
    edits: list[tuple] = []
    for match in _EXTERNAL.finditer(line):
        edits.append(
            (
                match.start(),
                match.end(),
                match.group(0),
                Operation(
                    op_id=f"R-{start + len(edits):03d}",
                    kind="ref_external",
                    before=match.group(0),
                    after=match.group(0),
                    location=f"L{row}:{match.start()}",
                    method="rule",
                    confidence=1.0,
                    applied=False,
                    reason=_UNRESOLVED_EXTERNAL,
                ),
            )
        )
    return edits


def apply(text: str, prefix: str = "R") -> tuple[str, list[Operation]]:
    """章番号参照を実体化した本文と操作一覧を返す。行数は変えない。"""
    table = heading_map(text)
    ops: list[Operation] = []
    out_lines: list[str] = []
    for row, line in enumerate(text.split("\n")):
        if _HEADING.match(line):
            out_lines.append(line)
            continue
        edits = _internal_ops(line, row, table, len(ops))
        edits += _external_ops(line, row, len(ops) + len(edits))
        edits.sort(key=lambda e: e[0])
        pieces: list[str] = []
        cursor = 0
        for begin, end, replacement, op in edits:
            if begin < cursor:
                continue
            pieces.append(line[cursor:begin])
            pieces.append(replacement)
            cursor = end
            ops.append(op if prefix == "R" else _renamed(op, prefix, len(ops)))
        pieces.append(line[cursor:])
        out_lines.append("".join(pieces))
    return "\n".join(out_lines), ops


def _renamed(op: Operation, prefix: str, index: int) -> Operation:
    from dataclasses import replace

    return replace(op, op_id=f"{prefix}-{index:03d}")
