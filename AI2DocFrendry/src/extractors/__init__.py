"""抽出器パッケージの公開インターフェース。"""

from __future__ import annotations

from .base import ExtractionError, Extractor
from .registry import get_extractor, register, supported_extensions

__all__ = (
    "ExtractionError",
    "Extractor",
    "get_extractor",
    "register",
    "supported_extensions",
)
