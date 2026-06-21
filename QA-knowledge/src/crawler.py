from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from urllib.parse import urldefrag, urljoin, urlparse
from xml.etree import ElementTree

from .analyzer import analyze_html
from .fetcher import FetchError, FetchResult, fetch_url, normalize_url
from .models import CrawlCandidate, PageAnalysis


FetchFn = Callable[[str], FetchResult]
TextFetchFn = Callable[[str], str]

EXCLUDED_EXTENSIONS = {
    ".7z",
    ".avi",
    ".css",
    ".csv",
    ".doc",
    ".docx",
    ".gif",
    ".gz",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".mov",
    ".mp3",
    ".mp4",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".rar",
    ".svg",
    ".tar",
    ".webp",
    ".xls",
    ".xlsx",
    ".xml",
    ".zip",
}

SCREEN_RULES = [
    ("ログイン", 95, ("login", "signin", "sign-in", "ログイン", "サインイン")),
    ("料金", 90, ("price", "pricing", "plan", "plans", "料金", "価格", "プラン")),
    ("登録", 88, ("register", "signup", "sign-up", "entry", "apply", "登録", "申込", "申し込み")),
    ("問い合わせ", 86, ("contact", "support", "inquiry", "help", "問い合わせ", "お問い合わせ", "サポート")),
    ("管理", 84, ("admin", "dashboard", "console", "settings", "管理", "設定")),
    ("機能", 82, ("feature", "service", "solution", "機能", "サービス", "ソリューション")),
    ("一覧", 78, ("list", "search", "index", "catalog", "一覧", "検索")),
    ("詳細", 72, ("detail", "show", "view", "詳細")),
]


def crawl_from_seed(
    seed_url: str,
    max_pages: int = 5,
    fetcher: FetchFn = fetch_url,
    text_fetcher: TextFetchFn | None = None,
) -> tuple[list[PageAnalysis], list[FetchResult], list[dict[str, str]]]:
    if max_pages < 1:
        raise FetchError("最大ページ数は1以上にしてください。")

    max_pages = min(max_pages, 30)
    seed = normalize_url(seed_url)
    seed_candidate = _candidate_for_url(seed, "起点URL")
    queue = [seed_candidate]
    for candidate in discover_seed_candidates(seed, text_fetcher=text_fetcher):
        _append_candidate(queue, candidate, max_pages * 4)
    visited: set[str] = set()
    analyses: list[PageAnalysis] = []
    results: list[FetchResult] = []
    errors: list[dict[str, str]] = []

    while queue and len(analyses) < max_pages:
        current = queue.pop(0)
        if current.url in visited:
            continue
        visited.add(current.url)

        try:
            result = fetcher(current.url)
            analysis = analyze_html(result.final_url, result.html)
            analysis = replace(
                analysis,
                screen_type=current.screen_type,
                priority=current.priority,
                discovery_reason=current.reason,
            )
            results.append(result)
            analyses.append(analysis)
        except FetchError as exc:
            errors.append({"url": current.url, "error": str(exc), "reason": current.reason})
            continue

        for discovered in discover_candidates_from_analysis(analysis, seed):
            if discovered.url not in visited:
                _append_candidate(queue, discovered, max_pages * 4)

    if not analyses:
        detail = "\n".join(f"- {item['url']}: {item['error']}" for item in errors)
        raise FetchError(f"解析できたURLがありません。\n{detail}")

    return analyses, results, errors


def discover_internal_urls(analysis: PageAnalysis, seed_url: str) -> list[str]:
    return [candidate.url for candidate in discover_candidates_from_analysis(analysis, seed_url)]


def discover_candidates_from_analysis(analysis: PageAnalysis, seed_url: str) -> list[CrawlCandidate]:
    seed_host = urlparse(seed_url).netloc
    candidates: list[CrawlCandidate] = []
    for link in analysis.links:
        parsed = urlparse(link.href)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc != seed_host:
            continue
        if _is_excluded_path(parsed.path):
            continue
        canonical = _canonical_url(link.href)
        reason = "主要ナビゲーション" if link.evidence.source.startswith(("nav", "header", "footer")) else "ページ内リンク"
        candidate = _candidate_for_url(canonical, reason, label=link.text, source=link.evidence.source)
        _append_candidate(candidates, candidate, limit=200)
    return candidates


def discover_seed_candidates(seed_url: str, text_fetcher: TextFetchFn | None = None) -> list[CrawlCandidate]:
    fetch_text = text_fetcher or _fetch_text
    parsed_seed = urlparse(seed_url)
    origin = parsed_seed._replace(path="", params="", query="", fragment="").geturl()
    candidates: list[CrawlCandidate] = []

    for path, reason in [("/sitemap.xml", "sitemap.xml"), ("/robots.txt", "robots.txt")]:
        url = urljoin(origin, path)
        try:
            text = fetch_text(url)
        except FetchError:
            continue
        if reason == "sitemap.xml":
            for candidate in _sitemap_candidates(text, seed_url, reason):
                _append_candidate(candidates, candidate, limit=200)
        else:
            for sitemap_url in _robots_sitemaps(text, seed_url):
                try:
                    sitemap_text = fetch_text(sitemap_url)
                except FetchError:
                    continue
                for candidate in _sitemap_candidates(sitemap_text, seed_url, "robots.txt Sitemap"):
                    _append_candidate(candidates, candidate, limit=200)

    return candidates


def _canonical_url(url: str) -> str:
    without_fragment, _ = urldefrag(url)
    parsed = urlparse(without_fragment)
    path = parsed.path.rstrip("/") or "/"
    return parsed._replace(path=path).geturl()


def _append_candidate(candidates: list[CrawlCandidate], candidate: CrawlCandidate, limit: int) -> None:
    if len(candidates) >= limit:
        return
    existing_urls = {item.url for item in candidates}
    if candidate.url not in existing_urls:
        candidates.append(candidate)


def _candidate_for_url(url: str, reason: str, label: str = "", source: str = "") -> CrawlCandidate:
    canonical = _canonical_url(url)
    screen_type, priority = classify_screen(canonical, label)
    if reason == "起点URL":
        screen_type = "ホーム"
        priority = 100
    elif reason in {"主要ナビゲーション", "sitemap.xml", "robots.txt Sitemap"}:
        priority = min(priority + 6, 99)
    if source:
        reason = f"{reason} ({source})"
    return CrawlCandidate(url=canonical, screen_type=screen_type, priority=priority, reason=reason)


def classify_screen(url: str, label: str = "") -> tuple[str, int]:
    parsed = urlparse(url)
    target = f"{parsed.path} {parsed.query} {label}".lower()
    for screen_type, priority, keywords in SCREEN_RULES:
        if any(keyword.lower() in target for keyword in keywords):
            return screen_type, priority
    return "一般", 60


def _fetch_text(url: str) -> str:
    import requests

    try:
        response = requests.get(url, timeout=8)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise FetchError(f"探索補助ファイルを取得できません: {url}: {exc}") from exc
    return response.text


def _sitemap_candidates(text: str, seed_url: str, reason: str) -> list[CrawlCandidate]:
    seed_host = urlparse(seed_url).netloc
    candidates: list[CrawlCandidate] = []
    try:
        root = ElementTree.fromstring(text.encode("utf-8"))
    except ElementTree.ParseError:
        return candidates

    for loc in root.findall(".//{*}loc"):
        value = (loc.text or "").strip()
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or parsed.netloc != seed_host:
            continue
        if _is_excluded_path(parsed.path):
            continue
        _append_candidate(candidates, _candidate_for_url(value, reason), limit=200)
    return candidates


def _robots_sitemaps(text: str, seed_url: str) -> list[str]:
    seed_host = urlparse(seed_url).netloc
    urls: list[str] = []
    for line in text.splitlines():
        key, separator, value = line.partition(":")
        if separator and key.strip().lower() == "sitemap":
            sitemap_url = value.strip()
            parsed = urlparse(sitemap_url)
            if parsed.scheme in {"http", "https"} and parsed.netloc == seed_host:
                if sitemap_url not in urls:
                    urls.append(sitemap_url)
    return urls


def _is_excluded_path(path: str) -> bool:
    lower = path.lower()
    return any(lower.endswith(extension) for extension in EXCLUDED_EXTENSIONS)
