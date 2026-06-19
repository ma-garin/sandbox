"""UI/UX検証 Streamlitアプリ。

PMOメニュー「AIサービス › AIツール › UI/UX検証」の実働モジュール。
確立OSS（Playwright/axe-core/Lighthouse/OpenAI GPT-4o）をオーケストレーションし、
ISO 25010 / ISTQB severity / ISO 29119準拠で検証する。

実行: streamlit run app.py
事前に OPENAI_API_KEY を環境変数または .env に設定すること。
"""
from __future__ import annotations

import streamlit as st

from core import capture, lighthouse_runner, report, ux_evaluator
from core.schema import Severity, UXEvalResult

# .env があれば読み込む（無くても動作する）
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


# ── design-system 紺系（#1a3a6b）トークンの最小適用 ──
_CSS = """
<style>
:root { --md-primary:#1a3a6b; --md-primary-light:#2e5aa8; }
.stApp { background:#f0f2f7; }
section[data-testid="stSidebar"] { background:#ffffff; }
h1, h2, h3 { color:#0d2240; }
.sev-badge { display:inline-block; padding:2px 10px; border-radius:12px;
  font-size:12px; font-weight:700; color:#fff; }
.sev-Critical { background:#c62828; }
.sev-Major    { background:#f57c00; }
.sev-Minor    { background:#fbc02d; color:#3a2e00; }
.sev-Cosmetic { background:#689f38; }
</style>
"""

_SEVERITY_ORDER = {
    Severity.CRITICAL: 0,
    Severity.MAJOR: 1,
    Severity.MINOR: 2,
    Severity.COSMETIC: 3,
}


def run_pipeline(target: str, html: str | None) -> UXEvalResult:
    """capture → lighthouse → LLM評価のパイプラインを実行する。"""
    if html is not None:
        cap = capture.capture_html(html)
        lh = lighthouse_runner.LighthouseScores()  # HTMLアップロード時はLighthouse対象外
        target_label = target or "（アップロードHTML）"
    else:
        cap = capture.capture_url(target)
        lh = lighthouse_runner.run_lighthouse(target)
        target_label = target

    return ux_evaluator.evaluate(
        target=target_label,
        screenshot_b64=cap.screenshot_b64,
        axe_violations=cap.axe_violations,
        lighthouse=lh,
    )


def render_result(result: UXEvalResult) -> None:
    """検証結果を画面に描画する。"""
    counts = result.count_by_severity()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Critical", counts["Critical"])
    c2.metric("Major", counts["Major"])
    c3.metric("Minor", counts["Minor"])
    c4.metric("Cosmetic", counts["Cosmetic"])

    st.subheader("総合所見")
    st.info(result.summary or "（所見なし）")

    lh = result.lighthouse
    if any(v is not None for v in (lh.performance, lh.accessibility, lh.best_practices)):
        st.subheader("Lighthouse スコア（客観評価）")
        g1, g2, g3 = st.columns(3)
        g1.metric("Performance", _pct(lh.performance))
        g2.metric("Accessibility", _pct(lh.accessibility))
        g3.metric("Best Practices", _pct(lh.best_practices))

    st.subheader("axe-core 違反（客観評価）")
    if result.axe_violations:
        st.dataframe(
            [
                {
                    "impact": v.impact,
                    "rule": v.rule_id,
                    "概要": v.description,
                    "件数": v.node_count,
                }
                for v in result.axe_violations
            ],
            use_container_width=True,
        )
    else:
        st.success("axe-core違反は検出されませんでした（または検査未実施）。")

    st.subheader("UX指摘（ISO 25010 / ISTQB severity）")
    if result.findings:
        for f in sorted(result.findings, key=lambda x: _SEVERITY_ORDER[x.severity]):
            badge = f'<span class="sev-badge sev-{f.severity.value}">{f.severity.value}</span>'
            st.markdown(f"{badge} **{f.title}** — `{f.iso25010}`", unsafe_allow_html=True)
            st.markdown(f"- 証拠: {f.evidence}")
            st.markdown(f"- 改善案: {f.recommendation}")
    else:
        st.write("指摘事項はありません（または証拠不足により評価未実施）。")

    st.subheader("レポート（ISO 29119-3）")
    md = report.build_markdown_report(result)
    st.download_button(
        "📄 Markdownレポートをダウンロード",
        data=md,
        file_name="uiux_report.md",
        mime="text/markdown",
    )
    with st.expander("レポートをプレビュー"):
        st.markdown(md)


def _pct(v: float | None) -> str:
    """0.0〜1.0スコアを百分率文字列にする。"""
    return f"{round(v * 100)}" if v is not None else "—"


def main() -> None:
    """Streamlitエントリポイント。"""
    st.set_page_config(page_title="UI/UX検証", page_icon="🖥️", layout="wide")
    st.markdown(_CSS, unsafe_allow_html=True)

    with st.sidebar:
        st.title("🖥️ UI/UX検証")
        st.caption("AIサービス › AIツール")
        st.markdown("---")
        st.markdown(
            "**検証エンジン**\n\n"
            "- Playwright（描画）\n"
            "- axe-core（WCAG）\n"
            "- Lighthouse（性能/品質）\n"
            "- GPT-4o Vision（ISO 25010評価）"
        )
        st.markdown("---")
        st.caption("Evidence-only / JSON強制 / ISTQB severity")

    st.title("UI/UX検証")
    st.write("URLまたはHTMLを入力し、客観検査＋AIヒューリスティック評価を実行します。")

    tab_url, tab_html = st.tabs(["URLで検証", "HTMLで検証"])

    with tab_url:
        url = st.text_input("検証対象URL", placeholder="https://example.com")
        if st.button("検証を実行", type="primary", key="run_url"):
            if not url.strip():
                st.warning("URLを入力してください。")
            else:
                with st.spinner("検証中（描画 → axe → Lighthouse → AI評価）…"):
                    result = run_pipeline(url.strip(), html=None)
                render_result(result)

    with tab_html:
        uploaded = st.file_uploader("HTMLファイル", type=["html", "htm"])
        if st.button("検証を実行", type="primary", key="run_html"):
            if uploaded is None:
                st.warning("HTMLファイルをアップロードしてください。")
            else:
                html_text = uploaded.read().decode("utf-8", errors="replace")
                with st.spinner("検証中（描画 → axe → AI評価）…"):
                    result = run_pipeline(uploaded.name, html=html_text)
                render_result(result)


if __name__ == "__main__":
    main()
