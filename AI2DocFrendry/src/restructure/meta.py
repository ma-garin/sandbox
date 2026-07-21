"""メタ情報補完（層1・ルールベース）。

タイトル・日付・版を front matter とファイル名からのみ補う。
推測はしない（front matter にもファイル名にも無い項目は補完しない）。
仕様: docs/SPECIFICATION.md 3-5
"""

from __future__ import annotations

import os
import re

from ..models import Operation

_TITLE_KEYS = ("title", "タイトル", "件名")
_DATE_KEYS = ("date", "日付", "作成日")
_VERSION_KEYS = ("version", "版", "改訂版")
_H1 = re.compile(r"^\s{0,3}#\s+\S", re.MULTILINE)
_FRONT_MATTER = re.compile(r"\A---\s*\n")
_FILENAME_DATE = re.compile(r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})")
_FILENAME_VERSION = re.compile(r"[vV]er?[-_.]?(\d+(?:\.\d+)?)")


def _lookup(front_matter: dict[str, object], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = front_matter.get(key)
        if isinstance(value, (str, int, float)) and str(value).strip():
            return str(value).strip()
    return ""


def _from_filename(source_path: str) -> tuple[str, str, str]:
    """ファイル名から (タイトル, 日付, 版) を取り出す。無ければ空文字。"""
    stem = os.path.splitext(os.path.basename(source_path))[0]
    date_match = _FILENAME_DATE.search(stem)
    version_match = _FILENAME_VERSION.search(stem)
    date = "-".join(date_match.groups()) if date_match else ""
    version = version_match.group(1) if version_match else ""
    title = stem
    for cut in (date_match, version_match):
        if cut:
            title = title.replace(cut.group(0), "")
    return title.strip(" -_"), date, version


def collect(front_matter: dict[str, object], source_path: str) -> dict[str, str]:
    """補完に使えるメタ情報を集める。front matter を優先する。"""
    file_title, file_date, file_version = _from_filename(source_path)
    values = {
        "source": os.path.basename(source_path),
        "title": _lookup(front_matter, _TITLE_KEYS) or file_title,
        "date": _lookup(front_matter, _DATE_KEYS) or file_date,
        "version": _lookup(front_matter, _VERSION_KEYS) or file_version,
    }
    return {key: value for key, value in values.items() if value}


def _block(values: dict[str, str]) -> str:
    lines = "\n".join(f"{key}: {value}" for key, value in values.items())
    return f"---\n{lines}\n---\n\n"


def apply(
    text: str,
    front_matter: dict[str, object] | None = None,
    source_path: str = "",
    prefix: str = "M",
) -> tuple[str, list[Operation]]:
    """メタ情報ブロックと H1 見出しを補った本文と操作一覧を返す。

    先頭への挿入なので、他の層1操作より**先**に適用して行番号を確定させる。
    """
    values = collect(dict(front_matter or {}), source_path)
    if not values:
        return text, []
    ops: list[Operation] = []
    inserted = ""
    if not _FRONT_MATTER.match(text):
        inserted += _block(values)
        ops.append(
            Operation(
                op_id=f"{prefix}-000",
                kind="meta",
                before="",
                after=_block(values),
                location="L0:0",
                method="rule",
                confidence=1.0,
                applied=True,
                reason="front matter・ファイル名から補完",
            )
        )
    title = values.get("title", "")
    if title and not _H1.search(text):
        inserted += f"# {title}\n\n"
        ops.append(
            Operation(
                op_id=f"{prefix}-001",
                kind="meta_title",
                before="",
                after=f"# {title}\n\n",
                location="L0:0",
                method="rule",
                confidence=1.0,
                applied=True,
                reason="タイトル見出しが無いため補完",
            )
        )
    return inserted + text, ops
