"""略語の初出定義付与（層1・ルールベース）。

文書内に定義がある略語だけを対象に、定義より前にある初出へ定義を括弧で添える。
外部知識は使わない（＝原文にない定義を作らない）。
仕様: docs/SPECIFICATION.md 3-5
"""

from __future__ import annotations

import re

from ..models import Operation

_ABBR_FIRST = re.compile(r"\b([A-Z][A-Za-z0-9]{1,9})\s*[（(]\s*([^）)\n]{2,60}?)\s*[）)]")
_ABBR_LAST = re.compile(r"([^\s、。（(]{2,40}?)\s*[（(]\s*([A-Z][A-Za-z0-9]{1,9})\s*[）)]")
_ABBR_IIKA = re.compile(
    r"([^\s、。（(]{2,40}?)\s*[（(]\s*以下[「『]([^」』\n]{1,20})[」』]と(?:いう|呼ぶ)\s*[）)]"
)
_WORD = r"(?<![A-Za-z0-9])%s(?![A-Za-z0-9])"


def definitions(text: str) -> dict[str, tuple[str, int]]:
    """略語 → (定義, 定義の出現位置) を文書から集める。"""
    table: dict[str, tuple[str, int]] = {}
    for match in _ABBR_FIRST.finditer(text):
        table.setdefault(match.group(1), (match.group(2), match.start()))
    for pattern, abbr_group, def_group in (
        (_ABBR_LAST, 2, 1),
        (_ABBR_IIKA, 2, 1),
    ):
        for match in pattern.finditer(text):
            table.setdefault(
                match.group(abbr_group), (match.group(def_group), match.start())
            )
    return table


def _first_use(text: str, abbr: str) -> int:
    match = re.search(_WORD % re.escape(abbr), text)
    return match.start() if match else -1


def _line_col(text: str, index: int) -> str:
    head = text[:index]
    row = head.count("\n")
    return f"L{row}:{index - (head.rfind(chr(10)) + 1)}"


def apply(text: str, prefix: str = "A") -> tuple[str, list[Operation]]:
    """初出の略語に定義を添えた本文と操作一覧を返す。行数は変えない。"""
    table = definitions(text)
    targets: list[tuple[int, str, str]] = []
    for abbr, (definition, def_at) in table.items():
        use_at = _first_use(text, abbr)
        if use_at < 0 or use_at >= def_at or abbr in definition:
            continue
        targets.append((use_at, abbr, definition))
    if not targets:
        return text, []
    ops: list[Operation] = []
    pieces: list[str] = []
    cursor = 0
    for use_at, abbr, definition in sorted(targets):
        end = use_at + len(abbr)
        after = f"{abbr}（{definition}）"
        pieces.append(text[cursor:use_at])
        pieces.append(after)
        cursor = end
        ops.append(
            Operation(
                op_id=f"{prefix}-{len(ops):03d}",
                kind="abbrev",
                before=abbr,
                after=after,
                location=_line_col(text, use_at),
                method="rule",
                confidence=1.0,
                applied=True,
                reason="文書内の定義を初出に前倒し",
            )
        )
    pieces.append(text[cursor:])
    return "".join(pieces), ops
