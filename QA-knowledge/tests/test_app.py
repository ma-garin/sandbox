from __future__ import annotations

from streamlit.testing.v1 import AppTest

from app import _csv_exports_with_answers
from src.analyzer import analyze_html
from src.fetcher import FetchResult


HOME_HTML = """
<!doctype html>
<html lang="ja">
  <head>
    <title>顧客管理システム</title>
    <meta name="description" content="営業チーム向けの顧客管理と商談管理を行うWebシステム">
  </head>
  <body>
    <nav>
      <a href="/customers">顧客一覧</a>
      <a href="/contact">お問い合わせ</a>
      <a href="https://support.example.com">サポート</a>
    </nav>
    <main>
      <h1>顧客管理</h1>
      <form action="/customers" method="post">
        <input type="text" name="company_name" placeholder="会社名">
        <button type="submit">保存</button>
      </form>
    </main>
  </body>
</html>
"""


CONTACT_HTML = """
<!doctype html>
<html lang="ja">
  <head><title>問い合わせ</title></head>
  <body>
    <h1>お問い合わせ</h1>
    <input type="email" name="email" placeholder="メールアドレス">
    <button>送信</button>
  </body>
</html>
"""


def fake_crawl_from_seed(seed_url: str, max_pages: int):
    del max_pages
    home = FetchResult(
        url=seed_url,
        final_url="https://example.com/",
        html=HOME_HTML,
        status_code=200,
        content_type="text/html",
    )
    contact = FetchResult(
        url="https://example.com/contact",
        final_url="https://example.com/contact",
        html=CONTACT_HTML,
        status_code=200,
        content_type="text/html",
    )
    return (
        [analyze_html(home.final_url, home.html), analyze_html(contact.final_url, contact.html)],
        [home, contact],
        [{"url": "https://example.com/pricing", "reason": "sitemap.xml", "error": "403 forbidden"}],
    )


def _app_with_fake_crawler() -> AppTest:
    app_test = AppTest.from_file("app.py", default_timeout=5)
    app_test.session_state["reverse_crawl_from_seed_fn"] = fake_crawl_from_seed
    return app_test


def test_initial_streamlit_view_renders_primary_controls():
    app_test = AppTest.from_file("app.py", default_timeout=5)
    app_test.run()

    assert not app_test.exception
    assert app_test.text_input[0].label == "起点URL"
    assert app_test.text_area[0].label == "追加URL（任意）"
    assert app_test.slider[0].label == "安全上限ページ数"
    assert app_test.button[0].label == "解析して文書生成"
    assert any("QA Knowledge Reverse Docs" in item.value for item in app_test.markdown)


def test_seed_analysis_renders_review_dashboard_and_tabs():
    app_test = _app_with_fake_crawler()
    app_test.run()

    app_test.text_input[0].input("https://example.com")
    app_test.button[0].click().run()

    assert not app_test.exception
    assert [tab.label for tab in app_test.tabs] == ["ダッシュボード", "画面", "文書レビュー", "根拠・確認事項", "改善", "出力"]
    assert app_test.success[0].value == "解析と文書生成が完了しました。"
    assert app_test.warning[0].value.startswith("1件のURLは取得できませんでした")
    assert app_test.radio[0].label == "表示する文書"
    assert app_test.selectbox[0].label == "レビュー状態"
    assert app_test.session_state["reverse_system_analysis"].screens
    assert app_test.session_state["reverse_system_analysis"].features
    assert app_test.session_state["reverse_system_analysis"].kano_ux_review
    assert any("レビュー完了までの残作業" in item.value for item in app_test.markdown)
    assert any("レビュー完了条件" in item.value for item in app_test.markdown)


def test_document_review_status_and_question_answer_are_stored():
    app_test = _app_with_fake_crawler()
    app_test.run()
    app_test.text_input[0].input("https://example.com")
    app_test.button[0].click().run()

    app_test.selectbox[0].select("確認済み").run()
    app_test.text_area[1].input("対象ユーザーは営業担当者").run()

    assert app_test.session_state["reverse_review_statuses"]["proposal"] == "確認済み"
    assert app_test.session_state["reverse_question_answers"]["Q-001"] == "対象ユーザーは営業担当者"

    csv_exports = _csv_exports_with_answers(
        app_test.session_state["reverse_system_analysis"],
        answers=dict(app_test.session_state["reverse_question_answers"]),
    )
    assert "対象ユーザーは営業担当者" in csv_exports["csv/unanswered-questions.csv"]
