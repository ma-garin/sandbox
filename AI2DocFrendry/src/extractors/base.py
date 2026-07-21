"""Extractor プラグインの共通契約。

パーサ選択だけで下流精度が22pt動く（RESEARCH.md §1-1）ため、
形式ごとに差し替え可能な構造にする（ADR-03 / NFR-13）。
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..models import Block, ImageRef, RawDocument, SourceFile, StyleMark


@runtime_checkable
class Extractor(Protocol):
    """各形式の抽出器が満たす契約。

    実装は純粋関数として書き、例外を外に漏らさない。
    失敗時は RawDocument を返さず ExtractionError を送出する。
    """

    #: 対応する拡張子（小文字・ドット付き）
    extensions: tuple[str, ...]

    def extract(self, source: SourceFile) -> RawDocument: ...


class ExtractionError(Exception):
    """抽出に失敗した。呼び出し側は当該ファイルを隔離し処理を継続する。"""


def build(
    source: SourceFile,
    blocks: list[Block],
    images: list[ImageRef] | None = None,
    style_marks: list[StyleMark] | None = None,
    warnings: list[str] | None = None,
) -> RawDocument:
    """RawDocument を組み立てる。各 Extractor はこれを使って返す。"""
    return RawDocument(
        source=source,
        blocks=tuple(blocks),
        images=tuple(images or ()),
        style_marks=tuple(style_marks or ()),
        warnings=tuple(warnings or ()),
    )


def expand_merged(rows: list[list[str]]) -> tuple[tuple[str, ...], ...]:
    """結合セルを矩形に展開する（FR-07）。

    空セルは直前の値で埋め、行列の対応を崩さない。
    表の行列対応が壊れると、渡した時点で内容が別物になる。
    """
    if not rows:
        return ()
    width = max(len(r) for r in rows)
    out: list[tuple[str, ...]] = []
    for row in rows:
        filled: list[str] = []
        for i in range(width):
            value = row[i].strip() if i < len(row) and row[i] else ""
            if not value and filled:
                value = filled[-1]
            filled.append(value)
        out.append(tuple(filled))
    return tuple(out)
