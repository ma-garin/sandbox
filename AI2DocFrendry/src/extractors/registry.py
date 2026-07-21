"""拡張子から Extractor を解決するレジストリ。"""

from __future__ import annotations

import importlib
import logging

from .base import Extractor

logger = logging.getLogger(__name__)

# 拡張子 -> (同一パッケージ内のモジュール名, クラス名)
EXTRACTOR_MAP: dict[str, tuple[str, str]] = {
    ".docx": ("docx", "DocxExtractor"),
    ".xlsx": ("xlsx", "XlsxExtractor"),
    ".xlsm": ("xlsx", "XlsxExtractor"),
    ".pptx": ("pptx", "PptxExtractor"),
    ".pdf": ("pdf", "PdfExtractor"),
    ".html": ("html", "HtmlExtractor"),
    ".htm": ("html", "HtmlExtractor"),
    ".csv": ("csv", "CsvExtractor"),
    ".tsv": ("csv", "CsvExtractor"),
    ".md": ("text", "MarkdownExtractor"),
    ".markdown": ("text", "MarkdownExtractor"),
    ".txt": ("text", "TextExtractor"),
    ".text": ("text", "TextExtractor"),
}

_plugins: dict[str, Extractor] = {}
_instances: dict[str, Extractor] = {}


def _normalize(ext: str) -> str:
    """拡張子を小文字・先頭ドット付きへ正規化する。"""
    lowered = ext.strip().lower()
    if not lowered:
        return ""
    return lowered if lowered.startswith(".") else f".{lowered}"


def _load(module_name: str, class_name: str) -> Extractor | None:
    """必要になった時点だけモジュールを読み込み、失敗時は None を返す。

    未インストールの依存ライブラリで全体が停止しないよう、
    例外は送出せず戻り値 None と警告ログで表現する。
    """
    try:
        module = importlib.import_module(f".{module_name}", __package__)
        extractor_class = getattr(module, class_name)
        return extractor_class()
    except Exception:
        logger.warning(
            "Extractor を読み込めません: %s.%s", module_name, class_name, exc_info=True
        )
        return None


def get_extractor(ext: str) -> Extractor | None:
    """拡張子に対応する Extractor を返す。未対応・読み込み失敗時は None。"""
    key = _normalize(ext)
    if not key:
        return None
    plugin = _plugins.get(key)
    if plugin is not None:
        return plugin
    cached = _instances.get(key)
    if cached is not None:
        return cached
    target = EXTRACTOR_MAP.get(key)
    if target is None:
        return None
    extractor = _load(*target)
    if extractor is None:
        return None
    _replace_instances({**_instances, key: extractor})
    return extractor


def supported_extensions() -> tuple[str, ...]:
    """対応可能な拡張子を昇順で返す。"""
    return tuple(sorted({*EXTRACTOR_MAP, *_plugins}))


def register(extractor: Extractor) -> None:
    """プラグイン Extractor を登録する。標準実装より優先される。"""
    added = {_normalize(ext): extractor for ext in extractor.extensions if _normalize(ext)}
    if not added:
        raise ValueError("extensions が空の Extractor は登録できません")
    _replace_plugins({**_plugins, **added})


def _replace_plugins(mapping: dict[str, Extractor]) -> None:
    """プラグイン表を新しい辞書へ差し替える（既存辞書は変更しない）。"""
    global _plugins
    _plugins = mapping


def _replace_instances(mapping: dict[str, Extractor]) -> None:
    """遅延生成キャッシュを新しい辞書へ差し替える。"""
    global _instances
    _instances = mapping
