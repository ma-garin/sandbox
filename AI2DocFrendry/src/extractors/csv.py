"""CSV/TSV から構造化ブロックを抽出する。

文字コードを推定してから読み、全体を 1 つの表ブロックとして扱う。
"""

from __future__ import annotations

import csv as _csv
import io
from pathlib import Path
from typing import TYPE_CHECKING

from ..models import Block, SourceFile
from .base import ExtractionError, build, expand_merged

if TYPE_CHECKING:  # 実行時 import を避け、循環・未定義シンボルで落ちないようにする
    from ..models import RawDocument

# LLM は表を縦方向に読むのが苦手で、50行×5列で正答率0.81、
# 5行×50列では0.43まで落ちる。横長の表は事前に警告する。
MAX_COLUMNS = 20

_WIDE_TABLE_REASON = (
    "LLMは横長の表の読解精度が大きく落ちる（5行×50列で正答率0.43）。"
    "列を分割するか転置を検討してください。"
)

_SNIFF_DELIMITERS = ",\t;|"
_SNIFF_SAMPLE_BYTES = 8192


class CsvExtractor:
    """標準 csv モジュールを用いた CSV/TSV 抽出器。"""

    extensions: tuple[str, ...] = (".csv", ".tsv")

    def extract(self, source: SourceFile) -> RawDocument:
        """ファイルを読み取り RawDocument を返す。失敗は ExtractionError に包む。"""
        try:
            return self._extract(source)
        except ExtractionError:
            raise
        except Exception as exc:  # noqa: BLE001 - 契約上すべて ExtractionError に統一
            raise ExtractionError(f"csv の抽出に失敗しました: {source.path}: {exc}") from exc

    def _extract(self, source: SourceFile) -> RawDocument:
        """本文を復号し、区切り文字を推定して 1 つの表ブロックに変換する。"""
        text, encoding = _decode(_read_bytes(source.path), source.path)
        delimiter = _detect_delimiter(text, _extension_of(source))
        rows = _trim_trailing(_parse_rows(text, delimiter))
        if not rows:
            return build(source, (), warnings=("行が 1 つも含まれていません",))
        table = expand_merged(rows)
        block = Block(kind="table", table_rows=table, position="row1")
        return build(source, (block,), warnings=_warnings(table, text, delimiter, encoding))


def _read_bytes(path: object) -> bytes:
    """ファイルをバイト列として読む。"""
    try:
        return Path(str(path)).read_bytes()
    except OSError as exc:
        raise ExtractionError(f"ファイルを読めませんでした: {path}: {exc}") from exc


def _decode(data: bytes, path: object) -> tuple[str, str]:
    """文字コードを判定して復号し、(本文, 判定した文字コード) を返す。

    短い日本語ファイルは統計判定が外れやすいため、まず UTF-8 を厳密に
    試し、失敗した場合のみ charset-normalizer に委ねる。
    """
    if not data:
        return "", "utf-8"
    try:
        return data.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        pass
    try:
        from charset_normalizer import from_bytes
    except ImportError as exc:
        raise ExtractionError("charset-normalizer がインストールされていません") from exc
    try:
        best = from_bytes(data).best()
    except Exception as exc:  # noqa: BLE001
        raise ExtractionError(f"文字コード判定に失敗しました: {path}: {exc}") from exc
    if best is None:
        raise ExtractionError(f"文字コードを判定できませんでした: {path}")
    return str(best).lstrip("﻿"), str(best.encoding or "unknown")


def _extension_of(source: SourceFile) -> str:
    """SourceFile から小文字のドット付き拡張子を取り出す。"""
    ext = str(getattr(source, "ext", "") or "").lower()
    if not ext:
        ext = Path(str(source.path)).suffix.lower()
    return ext if ext.startswith(".") else f".{ext}"


def _detect_delimiter(text: str, ext: str) -> str:
    """csv.Sniffer で区切り文字を推定し、失敗したら拡張子から決める。"""
    sample = text[:_SNIFF_SAMPLE_BYTES]
    if sample.strip():
        try:
            return _csv.Sniffer().sniff(sample, delimiters=_SNIFF_DELIMITERS).delimiter
        except (_csv.Error, TypeError):
            pass
    return "\t" if ext == ".tsv" else ","


def _parse_rows(text: str, delimiter: str) -> list[list[str]]:
    """本文を行のリストに解析する。"""
    try:
        reader = _csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
        return [[cell.strip() for cell in row] for row in reader]
    except _csv.Error as exc:
        raise ExtractionError(f"CSV の解析に失敗しました: {exc}") from exc


def _trim_trailing(rows: list[list[str]]) -> list[list[str]]:
    """末尾の空行のみを削る。中間の空行は構造として残す。"""
    trimmed = [list(row) for row in rows]
    while trimmed and not any(cell for cell in trimmed[-1]):
        trimmed.pop()
    return trimmed


def _warnings(
    table: tuple[tuple[str, ...], ...], text: str, delimiter: str, encoding: str
) -> tuple[str, ...]:
    """列数超過・ヘッダ推定・文字コード推定に関する警告を組み立てる。"""
    warnings: tuple[str, ...] = ()
    width = max((len(row) for row in table), default=0)
    if width > MAX_COLUMNS:
        warnings += (f"表が{width}列（{MAX_COLUMNS}列超）です。{_WIDE_TABLE_REASON}",)
    if not _looks_like_header(text, delimiter):
        warnings += ("1行目をヘッダとして扱いましたが、ヘッダらしくない可能性があります",)
    if encoding != "utf-8":
        warnings += (f"文字コードを'{encoding}'と推定しました。文字化けがある場合は要確認",)
    return warnings


def _looks_like_header(text: str, delimiter: str) -> bool:
    """1 行目がヘッダらしいかを推定する。判定不能なときはヘッダ扱いとする。"""
    sample = text[:_SNIFF_SAMPLE_BYTES]
    if not sample.strip():
        return True
    try:
        return bool(_csv.Sniffer().has_header(sample))
    except (_csv.Error, TypeError):
        return True
