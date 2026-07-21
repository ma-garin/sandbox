"""副作用（ファイルI/O・ログ）の集約。

他モジュールは純粋関数として書き、I/O はすべてここを経由する。
ログには本文・抽出テキスト・機密情報の値を出力しない（NFR-11）。
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Iterable, Iterator

logger = logging.getLogger("ai2doc")

_HASH_CHUNK = 1 << 20


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(_HASH_CHUNK):
            digest.update(block)
    return digest.hexdigest()


def walk(root: Path, exclude: Iterable[str]) -> Iterator[Path]:
    """再帰探索。シンボリックリンクは辿らない（循環と権限越えを避けるため）。"""
    patterns = tuple(exclude)
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or not path.is_file():
            continue
        if _excluded(path, root, patterns):
            continue
        yield path


def _excluded(path: Path, root: Path, patterns: tuple[str, ...]) -> bool:
    rel = path.relative_to(root)
    parts = rel.parts
    for pattern in patterns:
        if pattern.endswith("/"):
            if pattern.rstrip("/") in parts:
                return True
        elif path.match(pattern):
            return True
    return False


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def log_result(path: str, ext: str, status: str, reason: str, elapsed_ms: int) -> None:
    """処理結果のみを記録する。本文は決して出力しない（NFR-11）。"""
    logger.info(
        "file=%s ext=%s status=%s reason=%s elapsed_ms=%d",
        path,
        ext,
        status,
        reason or "-",
        elapsed_ms,
    )
