"""描画・スクリーンショット・アクセシビリティ検査。

確立技術のみを使用し、検査ロジックは自作しない:
- Playwright          : ブラウザ描画・スクリーンショット
- axe-playwright-python: axe-core（WCAG）のPythonバインディング

axe-coreはDequeのデファクトWCAG検査エンジン。ルールは一切自作しない。
"""
from __future__ import annotations

import base64

from .schema import AxeViolation, CaptureResult


def _to_violations(axe_raw: dict) -> list[AxeViolation]:
    """axe-coreの生結果をAxeViolationへ変換する。"""
    violations: list[AxeViolation] = []
    for v in axe_raw.get("violations", []):
        violations.append(
            AxeViolation(
                rule_id=v.get("id", "unknown"),
                impact=v.get("impact"),
                description=v.get("description", ""),
                help_url=v.get("helpUrl"),
                node_count=len(v.get("nodes", [])),
            )
        )
    return violations


def capture_url(url: str, timeout_ms: int = 30000) -> CaptureResult:
    """URLを描画し、スクリーンショットとaxe-core検査結果を取得する。

    Playwright/ブラウザが利用できない環境では、その旨をnoteに記録して
    空の結果を返す（グレースフルデグラデーション）。
    """
    try:
        from axe_playwright_python.sync_playwright import Axe
        from playwright.sync_api import sync_playwright
    except ImportError:
        return CaptureResult(
            url=url,
            note="Playwright/axe-playwright-pythonが未インストールのため検査をスキップしました。",
        )

    axe = Axe()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            screenshot = page.screenshot(full_page=True)
            results = axe.run(page)  # axe-coreをページに注入して実行
            browser.close()
    except Exception as exc:  # 描画失敗時もパイプラインは止めない
        return CaptureResult(url=url, note=f"描画に失敗しました: {exc}")

    return CaptureResult(
        url=url,
        screenshot_b64=base64.b64encode(screenshot).decode("ascii"),
        axe_violations=_to_violations(results.response),
    )


def capture_html(html: str, timeout_ms: int = 30000) -> CaptureResult:
    """アップロードされたHTML文字列を描画してaxe検査する。

    URLを持たない静的HTMLの検証や、ネットワーク不可環境のフォールバックに使う。
    """
    try:
        from axe_playwright_python.sync_playwright import Axe
        from playwright.sync_api import sync_playwright
    except ImportError:
        return CaptureResult(note="Playwrightが未インストールのため検査をスキップしました。")

    axe = Axe()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle", timeout=timeout_ms)
            screenshot = page.screenshot(full_page=True)
            results = axe.run(page)
            browser.close()
    except Exception as exc:
        return CaptureResult(note=f"HTML描画に失敗しました: {exc}")

    return CaptureResult(
        screenshot_b64=base64.b64encode(screenshot).decode("ascii"),
        axe_violations=_to_violations(results.response),
    )
