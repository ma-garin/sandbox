"""表記ゆれ統一（層1・ルールベース）。

全半角・長音・送り仮名の3種類のゆれを、文書内に実在する表記だけを使って統一する。
辞書を持ち込まない（＝原文にない語を生まない）ため、統一先は常に文書内の最頻表記。
仕様: docs/SPECIFICATION.md 3-5
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter

from ..models import Operation, TermVariant

_KATAKANA = re.compile(r"[ｦ-ﾟァ-ヴー]{2,}")
_ASCII = re.compile(r"[A-Za-zＡ-Ｚａ-ｚ][A-Za-zＡ-Ｚａ-ｚ0-9０-９]+")
_OKURI = re.compile(r"[一-龥]+[ぁ-ん]+")
_TOKEN = re.compile(
    r"[ｦ-ﾟァ-ヴー]{2,}|[A-Za-zＡ-Ｚａ-ｚ][A-Za-zＡ-Ｚａ-ｚ0-9０-９]+|[一-龥]+[ぁ-ん]+"
)


def normalize_key(surface: str) -> str:
    """比較用の正規化キー。全半角と長音・中黒の差を吸収する。"""
    return unicodedata.normalize("NFKC", surface).lower().replace("ー", "").replace("・", "")


def _okuri_key(surface: str) -> tuple[str, str]:
    """送り仮名グループのキー（漢字部分, 末尾かな）。

    末尾かなを含めるのは活用形（行く／行った）を同一視しないための制約。
    """
    kanji = "".join(c for c in surface if "一" <= c <= "龥")
    return (kanji, surface[-1])


def _kana_tail(surface: str) -> str:
    return "".join(c for c in surface if "ぁ" <= c <= "ん")


def _is_subsequence(short: str, long: str) -> bool:
    it = iter(long)
    return all(c in it for c in short)


def _pick(surfaces: Counter[str]) -> str:
    """最頻・最長・辞書順で決定的に統一先を選ぶ。"""
    return max(surfaces.items(), key=lambda kv: (kv[1], len(kv[0]), kv[0]))[0]


def _width_map(text: str) -> dict[str, str]:
    """全半角・長音のゆれの統一表。統一先は NFKC 正規形。"""
    groups: dict[str, Counter[str]] = {}
    for match in list(_KATAKANA.finditer(text)) + list(_ASCII.finditer(text)):
        surface = match.group(0)
        groups.setdefault(normalize_key(surface), Counter())[
            unicodedata.normalize("NFKC", surface)
        ] += 1
    mapping: dict[str, str] = {}
    for key, counter in groups.items():
        canonical = _pick(counter)
        for match in list(_KATAKANA.finditer(text)) + list(_ASCII.finditer(text)):
            surface = match.group(0)
            if normalize_key(surface) == key and surface != canonical:
                mapping[surface] = canonical
    return mapping


def _okuri_map(text: str) -> dict[str, str]:
    """送り仮名のゆれの統一表。かな列が包含関係にある組だけを統一する。"""
    groups: dict[tuple[str, str], Counter[str]] = {}
    for match in _OKURI.finditer(text):
        surface = match.group(0)
        groups.setdefault(_okuri_key(surface), Counter())[surface] += 1
    mapping: dict[str, str] = {}
    for counter in groups.values():
        if len(counter) < 2:
            continue
        canonical = _pick(counter)
        c_tail = _kana_tail(canonical)
        for surface in counter:
            tail = _kana_tail(surface)
            related = _is_subsequence(tail, c_tail) or _is_subsequence(c_tail, tail)
            if surface != canonical and related:
                mapping[surface] = canonical
    return mapping


def build_map(text: str) -> dict[str, str]:
    """文書全体から統一表を作る（表記 → 統一先）。"""
    return {**_width_map(text), **_okuri_map(text)}


def detect(text: str) -> tuple[TermVariant, ...]:
    """統一対象の表記ゆれを TermVariant として列挙する。"""
    mapping = build_map(text)
    found: list[TermVariant] = []
    for row, line in enumerate(text.split("\n")):
        for match in _TOKEN.finditer(line):
            canonical = mapping.get(match.group(0))
            if canonical:
                found.append(
                    TermVariant(
                        canonical=canonical,
                        found=match.group(0),
                        position=f"L{row}:{match.start()}",
                    )
                )
    return tuple(found)


def apply(text: str, prefix: str = "V") -> tuple[str, list[Operation]]:
    """表記ゆれを統一した本文と操作一覧を返す。行数は変えない。"""
    mapping = build_map(text)
    if not mapping:
        return text, []
    ops: list[Operation] = []
    out_lines: list[str] = []
    for row, line in enumerate(text.split("\n")):
        pieces: list[str] = []
        cursor = 0
        for match in _TOKEN.finditer(line):
            canonical = mapping.get(match.group(0))
            if not canonical:
                continue
            pieces.append(line[cursor : match.start()])
            pieces.append(canonical)
            cursor = match.end()
            ops.append(
                Operation(
                    op_id=f"{prefix}-{len(ops):03d}",
                    kind="variant",
                    before=match.group(0),
                    after=canonical,
                    location=f"L{row}:{match.start()}",
                    method="rule",
                    confidence=1.0,
                    applied=True,
                    reason="文書内の最頻表記に統一",
                )
            )
        pieces.append(line[cursor:])
        out_lines.append("".join(pieces))
    return "\n".join(out_lines), ops
