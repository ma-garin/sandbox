from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import requests


@dataclass(frozen=True)
class FetchResult:
    url: str
    final_url: str
    html: str
    status_code: int
    content_type: str


class FetchError(RuntimeError):
    pass


def normalize_url(url: str) -> str:
    value = url.strip()
    if not value:
        raise FetchError("URLを入力してください。")
    parsed = urlparse(value)
    if not parsed.scheme:
        value = f"https://{value}"
        parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise FetchError("http または https の公開URLを入力してください。")
    return value


def fetch_url(url: str, timeout: int = 12) -> FetchResult:
    normalized = normalize_url(url)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; QA-Knowledge-MVP/0.1; "
            "+https://localhost)"
        )
    }
    try:
        response = requests.get(normalized, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise FetchError(f"URL取得に失敗しました: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    if "html" not in content_type.lower() and response.text.lstrip()[:15].lower() != "<!doctype html":
        raise FetchError(f"HTMLページとして解析できません: content-type={content_type or 'unknown'}")

    return FetchResult(
        url=normalized,
        final_url=response.url,
        html=response.text,
        status_code=response.status_code,
        content_type=content_type,
    )
