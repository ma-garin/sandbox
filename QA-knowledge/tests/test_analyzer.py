from io import BytesIO
from zipfile import ZipFile

from src.analyzer import analyze_html
from src.crawler import classify_screen, crawl_from_seed, discover_internal_urls
from src.document_builder import build_documents, build_documents_for_pages, build_system_analysis
from src.exporter import build_csv_exports, build_zip
from src.fetcher import FetchError, FetchResult
from src.kano import evaluate_kano_ux_review


SAMPLE_HTML = """
<!doctype html>
<html lang="ja">
  <head>
    <title>顧客管理システム</title>
    <meta name="description" content="営業チーム向けの顧客管理と商談管理を行うWebシステム">
    <script src="https://cdn.example.com/app.js"></script>
  </head>
  <body>
    <nav>
      <a href="/customers">顧客一覧</a>
      <a href="/deals">商談管理</a>
      <a href="https://support.example.com">サポート</a>
    </nav>
    <main>
      <h1>顧客管理</h1>
      <h2>新規顧客登録</h2>
      <form action="/customers" method="post">
        <input type="text" name="company_name" placeholder="会社名">
        <input type="email" name="email" placeholder="メールアドレス">
        <select name="status"><option>見込み</option></select>
        <button type="submit">保存</button>
      </form>
    </main>
  </body>
</html>
"""


def test_analyze_html_extracts_core_screen_elements():
    analysis = analyze_html("https://example.com", SAMPLE_HTML)

    assert analysis.title == "顧客管理システム"
    assert "顧客管理" in analysis.headings
    assert len(analysis.links) == 3
    assert len(analysis.inputs) == 3
    assert len(analysis.actions) == 1
    assert len(analysis.forms) == 1
    assert len(analysis.external_assets) == 1


def test_build_documents_returns_practical_upstream_set():
    analysis = analyze_html("https://example.com", SAMPLE_HTML)
    documents = build_documents(analysis)
    titles = {document.title for document in documents}

    assert len(documents) == 16
    assert "アーキテクチャ設計書" in titles
    assert "狩野モデルUXレビュー" in titles
    assert "トレーサビリティマトリクス" in titles
    assert all(document.markdown.strip() for document in documents)


def test_discover_internal_urls_excludes_external_links():
    analysis = analyze_html("https://example.com", SAMPLE_HTML)

    urls = discover_internal_urls(analysis, "https://example.com")

    assert "https://example.com/customers" in urls
    assert "https://example.com/deals" in urls
    assert "https://support.example.com" not in urls


def test_discover_internal_urls_excludes_file_links_and_duplicates():
    analysis = analyze_html(
        "https://example.com",
        """
        <html><body>
          <nav>
            <a href="/customers">顧客一覧</a>
            <a href="/customers#top">顧客一覧</a>
            <a href="/docs/spec.pdf">PDF</a>
            <a href="https://other.example.com/help">外部ヘルプ</a>
          </nav>
        </body></html>
        """,
    )

    urls = discover_internal_urls(analysis, "https://example.com")

    assert urls == ["https://example.com/customers"]


def test_classify_screen_assigns_expected_type_and_priority():
    assert classify_screen("https://example.com/login")[0] == "ログイン"
    assert classify_screen("https://example.com/pricing")[0] == "料金"
    assert classify_screen("https://example.com/customers", "顧客一覧")[0] == "一覧"


def test_build_documents_for_pages_aggregates_multiple_pages():
    first = analyze_html("https://example.com", SAMPLE_HTML)
    second = analyze_html(
        "https://example.com/deals",
        """
        <html>
          <head><title>商談管理</title></head>
          <body>
            <h1>商談管理</h1>
            <button>商談を登録</button>
          </body>
        </html>
        """,
    )

    documents = build_documents_for_pages([first, second])
    feature_doc = next(document for document in documents if document.title == "機能一覧")

    assert "商談を登録" in feature_doc.markdown
    assert "トレーサビリティマトリクス" in {document.title for document in documents}


def test_crawl_from_seed_uses_sitemap_and_continues_after_fetch_failure():
    pages = {
        "https://example.com/": """
        <html><head><title>ホーム</title></head><body>
          <nav>
            <a href="/login">ログイン</a>
            <a href="/customers">顧客一覧</a>
            <a href="/files/catalog.pdf">カタログPDF</a>
            <a href="https://other.example.com/contact">外部</a>
          </nav>
          <h1>顧客管理</h1>
        </body></html>
        """,
        "https://example.com/login": """
        <html><head><title>ログイン</title></head><body>
          <h1>ログイン</h1>
          <form action="/login" method="post">
            <input type="email" name="email" placeholder="メールアドレス">
            <button type="submit">ログイン</button>
          </form>
        </body></html>
        """,
        "https://example.com/customers": SAMPLE_HTML,
    }

    def fake_fetcher(url: str) -> FetchResult:
        if url == "https://example.com/pricing":
            raise FetchError("403 forbidden")
        if url not in pages:
            raise FetchError(f"unexpected url: {url}")
        return FetchResult(url=url, final_url=url, html=pages[url], status_code=200, content_type="text/html")

    def fake_text_fetcher(url: str) -> str:
        if url == "https://example.com/sitemap.xml":
            return """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/login</loc></url>
              <url><loc>https://example.com/pricing</loc></url>
              <url><loc>https://example.com/files/catalog.pdf</loc></url>
              <url><loc>https://other.example.com/ignored</loc></url>
            </urlset>
            """
        if url == "https://example.com/robots.txt":
            return "Sitemap: https://example.com/sitemap.xml"
        raise FetchError(f"unexpected text url: {url}")

    analyses, _results, errors = crawl_from_seed(
        "https://example.com",
        max_pages=3,
        fetcher=fake_fetcher,
        text_fetcher=fake_text_fetcher,
    )

    assert {analysis.url for analysis in analyses} == {
        "https://example.com/",
        "https://example.com/login",
        "https://example.com/customers",
    }
    assert any(error["url"] == "https://example.com/pricing" for error in errors)
    assert next(analysis for analysis in analyses if analysis.url.endswith("/login")).screen_type == "ログイン"


def test_crawl_from_seed_uses_robots_sitemap_when_default_sitemap_is_missing():
    pages = {
        "https://example.com/": "<html><head><title>ホーム</title></head><body><h1>ホーム</h1></body></html>",
        "https://example.com/contact": "<html><head><title>問い合わせ</title></head><body><h1>お問い合わせ</h1></body></html>",
    }

    def fake_fetcher(url: str) -> FetchResult:
        if url not in pages:
            raise FetchError(f"unexpected url: {url}")
        return FetchResult(url=url, final_url=url, html=pages[url], status_code=200, content_type="text/html")

    def fake_text_fetcher(url: str) -> str:
        if url == "https://example.com/sitemap.xml":
            raise FetchError("not found")
        if url == "https://example.com/robots.txt":
            return "Sitemap: https://example.com/custom-sitemap.xml"
        if url == "https://example.com/custom-sitemap.xml":
            return """
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
              <url><loc>https://example.com/contact</loc></url>
            </urlset>
            """
        raise FetchError(f"unexpected text url: {url}")

    analyses, _results, _errors = crawl_from_seed(
        "https://example.com",
        max_pages=2,
        fetcher=fake_fetcher,
        text_fetcher=fake_text_fetcher,
    )

    assert "https://example.com/contact" in {analysis.url for analysis in analyses}
    assert next(analysis for analysis in analyses if analysis.url.endswith("/contact")).screen_type == "問い合わせ"


def test_system_analysis_and_csv_exports_are_not_empty():
    first = analyze_html("https://example.com", SAMPLE_HTML)
    second = analyze_html(
        "https://example.com/deals",
        """
        <html>
          <head><title>商談管理</title></head>
          <body>
            <h1>商談管理</h1>
            <button>商談を登録</button>
          </body>
        </html>
        """,
    )

    system = build_system_analysis([first, second], errors=[{"url": "https://example.com/ng", "error": "timeout"}])
    csv_exports = build_csv_exports(system)
    package = build_zip(build_documents_for_pages([first, second]), csv_exports=csv_exports)

    assert system.screens
    assert system.features
    assert system.data_items
    assert system.traceability
    assert system.kano_ux_review
    assert "screen_id" in csv_exports["csv/screen-list.csv"]
    assert "classification" in csv_exports["csv/kano-ux-review.csv"]
    assert package
    with ZipFile(BytesIO(package)) as archive:
        assert "csv/kano-ux-review.csv" in archive.namelist()


def test_kano_review_includes_core_quality_categories_and_must_be_items():
    analysis = analyze_html("https://example.com", SAMPLE_HTML)
    system = build_system_analysis([analysis], errors=[{"url": "https://example.com/ng", "error": "timeout"}])
    documents = build_documents_for_pages([analysis])

    rows = evaluate_kano_ux_review(system, documents=documents)
    categories = {row["classification"] for row in rows}
    must_be_high = [
        row
        for row in rows
        if row["classification"] == "当たり前品質" and row["severity"] in {"Critical", "High"}
    ]

    assert {"当たり前品質", "一元的品質", "魅力的品質"}.issubset(categories)
    assert any("未レビュー文書" in row["finding"] for row in must_be_high)
    assert any("未確認事項" in row["finding"] for row in must_be_high)
    assert any("High以上" in row["finding"] for row in must_be_high)
