"""取り込み。探索・フィルタ・隔離判定を行う（FR-01〜04）。

1ファイルの失敗が全体を止めない（NFR-08）。対応外も破損も status に記録して継続する。
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Iterator

from . import io_adapter
from .extractors import supported_extensions
from .models import SourceFile

DEFAULT_EXCLUDE: tuple[str, ...] = (
    "~$*",
    ".DS_Store",
    ".git/",
    "node_modules/",
    "__pycache__/",
    ".venv/",
)


def collect(
    root: Path,
    exclude: tuple[str, ...] = DEFAULT_EXCLUDE,
    extensions: tuple[str, ...] | None = None,
    known_hashes: frozenset[str] = frozenset(),
) -> Iterator[SourceFile]:
    """フォルダ／ZIP／単一ファイルのいずれからも同じ結果を返す（FR-01）。"""
    targets = extensions if extensions is not None else supported_extensions()
    for path in _expand(root, exclude):
        yield _classify(path, targets, known_hashes)


def _expand(root: Path, exclude: tuple[str, ...]) -> Iterator[Path]:
    if root.is_dir():
        yield from io_adapter.walk(root, exclude)
    elif root.suffix.lower() == ".zip":
        yield from _extract_zip(root, exclude)
    else:
        yield root


def _extract_zip(archive: Path, exclude: tuple[str, ...]) -> Iterator[Path]:
    """ZIP は同階層の作業ディレクトリへ展開してから通常探索に合流させる。"""
    workdir = archive.with_suffix("")
    try:
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(workdir)
    except (zipfile.BadZipFile, OSError):
        return
    yield from io_adapter.walk(workdir, exclude)


def _classify(
    path: Path, targets: tuple[str, ...], known_hashes: frozenset[str]
) -> SourceFile:
    ext = path.suffix.lower()
    try:
        stat = path.stat()
    except OSError as exc:
        return _broken(path, ext, f"stat失敗: {type(exc).__name__}")

    if stat.st_size == 0:
        return _broken(path, ext, "サイズ0")

    if ext not in targets:
        return SourceFile(
            path=str(path),
            ext=ext,
            size=stat.st_size,
            mtime=stat.st_mtime,
            sha256="",
        ).skipped("未対応形式")

    try:
        digest = io_adapter.sha256_of(path)
    except OSError as exc:
        return _broken(path, ext, f"読み取り失敗: {type(exc).__name__}")

    source = SourceFile(
        path=str(path),
        ext=ext,
        size=stat.st_size,
        mtime=stat.st_mtime,
        sha256=digest,
    )
    if digest in known_hashes:
        return source.skipped("処理済み（内容ハッシュ一致）")
    return source


def _broken(path: Path, ext: str, reason: str) -> SourceFile:
    return SourceFile(
        path=str(path), ext=ext, size=0, mtime=0.0, sha256=""
    ).failed(reason)
