from __future__ import annotations

from dataclasses import replace

import streamlit as st

from src.analyzer import analyze_html
from src.crawler import crawl_from_seed
from src.document_builder import build_documents_for_pages, build_system_analysis, bundle_markdown
from src.exporter import build_csv, build_csv_exports, build_reviewed_markdown, build_zip
from src.fetcher import FetchError, fetch_url
from src.kano import build_completion_gate, evaluate_kano_ux_review


st.set_page_config(
    page_title="QA Knowledge Reverse Docs",
    page_icon="QD",
    layout="wide",
    initial_sidebar_state="expanded",
)


CSS = """
<style>
:root {
  --color-primary: #1976D2;
  --color-primary-light: #E3F2FD;
  --color-primary-dark: #0D47A1;
  --color-bg: #F8F9FA;
  --color-surface: #FFFFFF;
  --color-surface-2: #F1F3F4;
  --color-border: #E0E0E0;
  --color-divider: #F0F0F0;
  --color-text: #212121;
  --color-text-secondary: #616161;
  --color-text-disabled: #9E9E9E;
  --color-critical: #D32F2F;
  --color-high: #F57C00;
  --color-medium: #FBC02D;
  --color-low: #388E3C;
  --color-info: #0288D1;
  --color-critical-bg: #FFEBEE;
  --color-high-bg: #FFF3E0;
  --color-medium-bg: #FFFDE7;
  --color-low-bg: #E8F5E9;
  --color-info-bg: #E1F5FE;
  --font-main: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
  --font-mono: 'JetBrains Mono', 'Consolas', monospace;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.08);
}
.stApp {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-main);
}
#MainMenu,
footer {
  visibility: hidden;
}
[data-testid="stHeader"] {
  background: var(--color-bg);
  height: 0;
}
.block-container {
  padding-top: 28px;
}
[data-testid="stSidebar"] {
  background: var(--color-surface-2);
  border-right: 1px solid var(--color-border);
  padding-top: 12px;
}
[data-testid="stSidebar"],
[data-testid="stSidebar"] *:not(button):not(svg):not(path) {
  color: var(--color-text) !important;
}
[data-testid="stSidebar"] p,
[data-testid="stSidebar"] label,
[data-testid="stSidebar"] span {
  color: var(--color-text) !important;
}
[data-testid="stSidebar"] small,
[data-testid="stSidebar"] [data-testid="stCaptionContainer"] {
  color: var(--color-text-secondary) !important;
}
[data-testid="stSidebar"] input {
  background: var(--color-surface) !important;
  color: var(--color-text) !important;
  border: 1px solid var(--color-border) !important;
}
[data-testid="stSidebar"] input::placeholder {
  color: var(--color-text-secondary) !important;
  opacity: 1 !important;
}
h1, h2, h3 {
  color: var(--color-text);
  letter-spacing: 0;
}
.side-brand {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  margin: 4px 0 16px;
}
.side-brand-title {
  color: var(--color-primary-dark);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 6px;
}
.side-brand-subtitle {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.side-section {
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 18px 0 8px;
}
.phase-stack {
  display: grid;
  gap: 8px;
}
.phase-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-height: 44px;
  padding: 10px 12px;
  box-shadow: var(--shadow-sm);
}
.phase-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
}
.phase-title {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}
.phase-caption {
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.4;
}
.side-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  min-height: 44px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.side-nav-item strong {
  color: var(--color-text);
  font-size: 14px;
}
.side-nav-item span {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
}
.badge-new {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}
.badge-low {
  background: var(--color-low-bg);
  color: var(--color-low);
}
.badge-high {
  background: var(--color-high-bg);
  color: var(--color-high);
}
.workbench-head {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr);
  align-items: stretch;
  gap: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 20px 24px;
  margin-bottom: 18px;
}
.head-kicker {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 8px;
}
.workbench-head h1 {
  font-size: 22px;
  margin: 0 0 4px;
  line-height: 1.15;
}
.workbench-head p {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin: 0;
}
.status-pill {
  border: 1px solid var(--color-border);
  background: var(--color-primary-light);
  border-radius: var(--radius-full);
  padding: 8px 12px;
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
  .head-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(108px, 1fr));
  gap: 8px;
}
.score-card {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px;
}
.score-value {
  color: var(--color-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.15;
}
.score-label {
  color: var(--color-text-secondary);
  font-size: 11px;
}
.score-bar {
  background: var(--color-divider);
  border-radius: var(--radius-full);
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
}
.score-fill {
  background: var(--color-primary);
  height: 100%;
}
.input-band {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 16px;
  margin-bottom: 18px;
}
.input-title {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 2px;
}
.input-help {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.metric-band {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 10px;
  margin: 14px 0 18px;
}
.metric {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 12px;
}
.metric b {
  display: block;
  font-size: 28px;
  color: var(--color-primary);
  line-height: 1.1;
}
.metric span {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.metric.is-ready b {
  color: var(--color-low);
}
.metric.is-blocked b {
  color: var(--color-high);
}
.work-section-title {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
  margin: 18px 0 10px;
}
.gate-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 10px;
  margin: 10px 0 16px;
}
.gate-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 12px;
  min-height: 86px;
}
.gate-item.ok {
  border-color: #A5D6A7;
  background: #FBFFFB;
}
.gate-item.ng {
  border-color: #FFCC80;
  background: #FFFDF8;
}
.gate-label {
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 8px;
}
.gate-value {
  color: var(--color-text);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
}
.remaining-list {
  display: grid;
  gap: 8px;
  margin: 8px 0 16px;
}
.remaining-item {
  background: var(--color-high-bg);
  border: 1px solid #FFE0B2;
  border-radius: var(--radius-md);
  color: #5f3600;
  font-size: 13px;
  line-height: 1.55;
  padding: 10px 12px;
}
.remaining-item.done {
  background: var(--color-low-bg);
  border-color: #C8E6C9;
  color: var(--color-low);
}
.quality-gate {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 14px 16px;
  margin: 12px 0;
}
.quality-gate strong {
  color: var(--color-primary-dark);
}
.doc-review-layout {
  display: grid;
  grid-template-columns: minmax(240px, .8fr) minmax(0, 2.2fr);
  gap: 16px;
  align-items: start;
}
.kano-counts {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.kano-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 12px;
}
.kano-card b {
  display: block;
  color: var(--color-primary);
  font-size: 24px;
  line-height: 1.1;
}
.kano-card span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.notice {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 14px 16px;
  color: var(--color-text);
}
.empty-grid {
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 16px;
  align-items: stretch;
}
.empty-card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 20px;
}
.empty-card h2 {
  font-size: 18px;
  margin: 0 0 8px;
}
.empty-card p {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
  margin: 0;
}
.doc-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 8px;
  margin: 8px 0 12px;
}
.doc-chip {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text);
  min-height: 38px;
}
.doc-chip b {
  color: var(--color-primary-dark);
}
.risk-note {
  border-left: 4px solid var(--color-high);
  background: var(--color-high-bg);
  padding: 10px 12px;
  color: #5f3600;
  margin: 12px 0;
}
.summary-card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 16px;
}
.summary-card-title {
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 8px;
}
.constraint-list {
  display: grid;
  gap: 8px;
}
.constraint-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}
div.stButton > button {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: white;
  min-height: 44px;
}
div.stButton > button:hover {
  border-color: var(--color-primary-dark);
  background: var(--color-primary-dark);
  color: white;
}
div.stDownloadButton > button {
  border-radius: var(--radius-md);
  min-height: 44px;
}
[data-testid="stDataFrame"] {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
@media (max-width: 760px) {
  .metric-band { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
  .gate-grid { grid-template-columns: 1fr; }
  .kano-counts { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
  .doc-review-layout { grid-template-columns: 1fr; }
  .doc-strip { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
  .workbench-head { grid-template-columns: 1fr; }
  .empty-grid { grid-template-columns: 1fr; }
  .workbench-head h1 { font-size: 1.45rem; }
}
</style>
"""


DOC_GROUPS = {
    "構想": ["企画書", "システム概要書", "RFD / ADR"],
    "要求": ["要件定義書", "業務フロー / ユースケース一覧", "非機能要件定義書"],
    "設計": ["アーキテクチャ設計書", "画面一覧", "画面仕様書", "機能一覧", "機能仕様書"],
    "データ/IF": ["データ項目定義書", "外部インターフェース仕様書"],
    "検証": ["テスト観点表", "狩野モデルUXレビュー", "トレーサビリティマトリクス"],
}

DEFAULT_MAX_PAGES = 10
REVIEW_STATUSES = ["未レビュー", "要確認", "確認済み", "差戻し"]


def render_header() -> None:
    st.markdown(CSS, unsafe_allow_html=True)
    st.markdown(
        """
        <div class="workbench-head">
          <div>
            <div class="head-kicker">上流工程ドキュメント生成ワークベンチ</div>
            <h1>QA Knowledge Reverse Docs</h1>
            <p>公開URLの画面要素から、開発引継ぎに使う上流ドキュメントを根拠付きで生成します。</p>
            <div style="margin-top:12px;">
              <span class="badge badge-new">ルールベース</span>
              <span class="badge badge-low">APIキー不要</span>
              <span class="badge badge-high">人間レビュー前提</span>
            </div>
          </div>
            <div class="head-status">
            <div class="score-card">
              <div class="score-value">16</div>
              <div class="score-label">生成文書</div>
              <div class="score-bar"><div class="score-fill" style="width:100%"></div></div>
            </div>
            <div class="score-card">
              <div class="score-value">0</div>
              <div class="score-label">API必須数</div>
              <div class="score-bar"><div class="score-fill" style="width:0%"></div></div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_metrics(analysis) -> None:
    st.markdown(
        f"""
        <div class="metric-band">
          <div class="metric"><b>{len(analysis.headings)}</b><span>見出し</span></div>
          <div class="metric"><b>{len(analysis.links)}</b><span>リンク</span></div>
          <div class="metric"><b>{len(analysis.inputs)}</b><span>入力項目</span></div>
          <div class="metric"><b>{len(analysis.actions)}</b><span>操作要素</span></div>
          <div class="metric"><b>{len(analysis.external_assets)}</b><span>外部候補</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_metrics_for_pages(analyses) -> None:
    st.markdown(
        f"""
        <div class="metric-band">
          <div class="metric"><b>{sum(len(item.headings) for item in analyses)}</b><span>見出し</span></div>
          <div class="metric"><b>{sum(len(item.links) for item in analyses)}</b><span>リンク</span></div>
          <div class="metric"><b>{sum(len(item.inputs) for item in analyses)}</b><span>入力項目</span></div>
          <div class="metric"><b>{sum(len(item.actions) for item in analyses)}</b><span>操作要素</span></div>
          <div class="metric"><b>{sum(len(item.external_assets) for item in analyses)}</b><span>外部候補</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_document_coverage() -> None:
    chips = []
    for group, names in DOC_GROUPS.items():
        chips.append(f"<div class='doc-chip'><b>{group}</b><br>{len(names)}文書</div>")
    st.markdown(f"<div class='doc-strip'>{''.join(chips)}</div>", unsafe_allow_html=True)


def render_sidebar() -> None:
    with st.sidebar:
        st.markdown(
            """
            <div class="side-brand">
              <div class="side-brand-title">Reverse Docs</div>
              <div class="side-brand-subtitle">URL観測結果を、人間がレビューできる上流成果物へ変換します。</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.markdown('<div class="side-section">作業フェーズ</div>', unsafe_allow_html=True)
        st.markdown(
            """
            <div class="phase-stack">
              <div class="phase-item">
                <div class="phase-number">1</div>
                <div><div class="phase-title">URL解析</div><div class="phase-caption">公開HTMLから要素抽出</div></div>
              </div>
              <div class="phase-item">
                <div class="phase-number">2</div>
                <div><div class="phase-title">根拠整理</div><div class="phase-caption">画面要素と推定を紐付け</div></div>
              </div>
              <div class="phase-item">
                <div class="phase-number">3</div>
                <div><div class="phase-title">文書生成</div><div class="phase-caption">上流成果物へ変換</div></div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown('<div class="side-section">文書体系</div>', unsafe_allow_html=True)
        for group, names in DOC_GROUPS.items():
            st.markdown(
                f"""
                <div class="side-nav-item">
                  <strong>{group}</strong>
                  <span>{len(names)}文書</span>
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.divider()
        st.markdown('<div class="side-section">MVP制約</div>', unsafe_allow_html=True)
        st.markdown(
            """
            <div class="constraint-list">
              <div class="constraint-item">起点URLから同一ドメイン内リンクを自動探索</div>
              <div class="constraint-item">ログイン後画面とJS必須画面は後続対応</div>
              <div class="constraint-item">LLM/APIを使わずDOM解析とテンプレート生成で出力</div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def _document_with_review_state(document, status: str):
    lines = []
    for line in document.markdown.splitlines():
        if line.startswith("- レビュー状態: "):
            lines.append(f"- レビュー状態: {status}")
        elif line.startswith("- 人間レビュー要否: "):
            lines.append(f"- 人間レビュー要否: {'いいえ' if status == '確認済み' else 'はい'}")
        else:
            lines.append(line)
    return replace(
        document,
        markdown="\n".join(lines) + "\n",
        review_status=status,
        needs_review=status != "確認済み",
    )


def _documents_with_current_review_state(documents):
    review_statuses = st.session_state.get("reverse_review_statuses", {})
    return [
        _document_with_review_state(document, review_statuses.get(document.slug, document.review_status))
        for document in documents
    ]


def _store_analysis_results(analyses, results, errors) -> None:
    system = build_system_analysis(analyses, errors=errors)
    documents = build_documents_for_pages(analyses, errors=errors)
    previous_statuses = st.session_state.get("reverse_review_statuses", {})
    st.session_state["reverse_analyses"] = analyses
    st.session_state["reverse_documents"] = documents
    st.session_state["reverse_system_analysis"] = system
    st.session_state["reverse_fetch_results"] = results
    st.session_state["reverse_errors"] = errors
    st.session_state["reverse_review_statuses"] = {
        document.slug: previous_statuses.get(document.slug, document.review_status)
        for document in documents
    }
    st.session_state.setdefault("reverse_question_answers", {})


def _review_summary(documents) -> dict[str, int]:
    statuses = st.session_state.get("reverse_review_statuses", {})
    summary = {status: 0 for status in REVIEW_STATUSES}
    for document in documents:
        status = statuses.get(document.slug, document.review_status)
        summary[status] = summary.get(status, 0) + 1
    return summary


def _question_rows_with_answers(system, answers: dict[str, str] | None = None) -> list[dict[str, str]]:
    answers = answers if answers is not None else st.session_state.get("reverse_question_answers", {})
    rows = []
    for row in system.unanswered_questions:
        rows.append({**row, "answer": answers.get(row["question_id"], "")})
    return rows


def _csv_exports_with_answers(
    system,
    answers: dict[str, str] | None = None,
    documents=None,
    review_statuses: dict[str, str] | None = None,
    high_risk_confirmed: bool = False,
) -> dict[str, str]:
    csv_exports = build_csv_exports(system)
    csv_exports["csv/unanswered-questions.csv"] = build_csv(_question_rows_with_answers(system, answers=answers))
    csv_exports["csv/kano-ux-review.csv"] = build_csv(
        evaluate_kano_ux_review(
            system,
            documents=documents,
            review_statuses=review_statuses,
            question_answers=answers,
            high_risk_confirmed=high_risk_confirmed,
        )
    )
    return csv_exports


def _fetch_url_for_app(url: str):
    fetcher = st.session_state.get("reverse_fetch_url_fn", fetch_url)
    return fetcher(url)


def _crawl_from_seed_for_app(seed_url: str, max_pages: int):
    crawler = st.session_state.get("reverse_crawl_from_seed_fn", crawl_from_seed)
    return crawler(seed_url, max_pages=max_pages)


def run_analysis(url: str) -> None:
    with st.spinner("公開URLを取得し、HTMLから画面要素を解析しています。"):
        result = _fetch_url_for_app(url)
        analysis = analyze_html(result.final_url, result.html)
        _store_analysis_results([analysis], [result], [])


def parse_urls(raw_urls: str) -> list[str]:
    urls: list[str] = []
    for line in raw_urls.splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        if value not in urls:
            urls.append(value)
    return urls


def run_multi_analysis(raw_urls: str) -> None:
    urls = parse_urls(raw_urls)
    if not urls:
        raise FetchError("解析対象URLを1件以上入力してください。")

    analyses = []
    results = []
    errors = []
    progress = st.progress(0, text="URL解析を開始しています。")

    for index, url in enumerate(urls, start=1):
        try:
            result = _fetch_url_for_app(url)
            analysis = analyze_html(result.final_url, result.html)
            results.append(result)
            analyses.append(analysis)
        except FetchError as exc:
            errors.append({"url": url, "error": str(exc)})
        progress.progress(index / len(urls), text=f"{index}/{len(urls)} 件を処理しました。")

    progress.empty()
    if not analyses:
        detail = "\n".join(f"- {item['url']}: {item['error']}" for item in errors)
        raise FetchError(f"解析できたURLがありません。\n{detail}")

    _store_analysis_results(analyses, results, errors)


def run_seed_analysis(seed_url: str, max_pages: int) -> None:
    with st.spinner("起点URLから同一ドメイン内リンクを探索し、画面要素を解析しています。"):
        analyses, results, errors = _crawl_from_seed_for_app(seed_url, max_pages=max_pages)
        _store_analysis_results(analyses, results, errors)


def main() -> None:
    render_header()
    render_sidebar()

    st.markdown(
        """
        <div class="input-band">
          <div class="input-title">解析対象を指定</div>
          <div class="input-help">起点URLを1つ入れるだけで、同一ドメイン内の主要リンクを自動探索します。</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    with st.form("analysis_form", clear_on_submit=False):
        seed_url = st.text_input("起点URL", placeholder="https://example.com")
        with st.expander("詳細設定", expanded=False):
            manual_urls = st.text_area(
                "追加URL（任意）",
                placeholder="必要な画面が自動探索で拾えない場合だけ、1行に1URLで追加します。",
                height=88,
            )
            max_pages = st.slider(
                "安全上限ページ数",
                min_value=1,
                max_value=30,
                value=DEFAULT_MAX_PAGES,
                step=1,
                help="通常は変更不要です。大規模サイトで解析時間や負荷を抑えるための上限です。",
            )
        left, middle, right = st.columns([1.2, 1, 1])
        with left:
            execute = st.form_submit_button("解析して文書生成", width="stretch")
        with middle:
            st.caption("標準: 起点URLから自動探索")
        with right:
            st.caption("方式: API利用なし / ルールベース")
    render_document_coverage()

    if execute:
        try:
            if manual_urls.strip():
                combined_urls = "\n".join([seed_url.strip(), manual_urls.strip()])
                run_multi_analysis(combined_urls)
            else:
                run_seed_analysis(seed_url, max_pages=max_pages)
            st.success("解析と文書生成が完了しました。")
        except FetchError as exc:
            st.error(str(exc))

    analyses = st.session_state.get("reverse_analyses", [])
    analysis = analyses[0] if analyses else None
    stored_documents = st.session_state.get("reverse_documents", [])
    documents = _documents_with_current_review_state(stored_documents)
    errors = st.session_state.get("reverse_errors", [])
    system = st.session_state.get("reverse_system_analysis")
    if analyses and system is None:
        system = build_system_analysis(analyses, errors=errors)
        st.session_state["reverse_system_analysis"] = system

    if not analysis:
        st.markdown(
            """
            <div class="empty-grid">
              <div class="empty-card">
                <h2>最初にURLを解析してください</h2>
                <p>起点URLを1つ入れるだけで、同一ドメイン内リンクを自動探索します。生成結果は、推定内容、根拠、確信度、人間レビュー要否を分けて確認できます。</p>
              </div>
              <div class="empty-card">
                <h2>出力方針</h2>
                <p>企画、要求、設計、データ/IF、検証の5領域に分け、開発引継ぎに必要なドキュメントをMarkdownで出力します。</p>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.stop()

    review_statuses = st.session_state.setdefault("reverse_review_statuses", {})
    for raw_document in stored_documents:
        widget_key = f"reverse_doc_status_{raw_document.slug}"
        if widget_key in st.session_state:
            review_statuses[raw_document.slug] = st.session_state[widget_key]
    documents = _documents_with_current_review_state(stored_documents)
    question_answers = st.session_state.setdefault("reverse_question_answers", {})
    for question in system.unanswered_questions:
        answer_key = f"reverse_question_answer_{question['question_id']}"
        if answer_key in st.session_state:
            question_answers[question["question_id"]] = st.session_state[answer_key]
    high_risk_confirmed = bool(st.session_state.get("reverse_high_risk_confirmed", False))
    completion_gate = build_completion_gate(
        system,
        documents=documents,
        review_statuses=review_statuses,
        question_answers=question_answers,
        high_risk_confirmed=high_risk_confirmed,
    )
    kano_rows = evaluate_kano_ux_review(
        system,
        documents=documents,
        review_statuses=review_statuses,
        question_answers=question_answers,
        high_risk_confirmed=high_risk_confirmed,
    )
    system = replace(system, kano_ux_review=kano_rows)
    st.session_state["reverse_system_analysis"] = system

    st.markdown('<div class="work-section-title">レビュー完了までの残作業</div>', unsafe_allow_html=True)
    remaining_items = completion_gate["remaining"]
    if remaining_items:
        st.markdown(
            "<div class='remaining-list'>"
            + "".join(f"<div class='remaining-item'>{item}</div>" for item in remaining_items)
            + "</div>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            "<div class='remaining-list'><div class='remaining-item done'>レビュー完了条件を満たしています。レビュー済み版を出力できます。</div></div>",
            unsafe_allow_html=True,
        )

    high_risks = [risk for risk in system.handoff_risks if risk.get("severity") in {"Critical", "High"}]
    st.markdown(
        f"""
        <div class="metric-band">
          <div class="metric"><b>{len(analyses)}</b><span>解析済みページ</span></div>
          <div class="metric {'is-ready' if completion_gate['unreviewed_documents'] == 0 else 'is-blocked'}"><b>{completion_gate['unreviewed_documents']}</b><span>未レビュー文書</span></div>
          <div class="metric {'is-ready' if completion_gate['unanswered_questions'] == 0 else 'is-blocked'}"><b>{completion_gate['unanswered_questions']}</b><span>未確認事項</span></div>
          <div class="metric {'is-ready' if completion_gate['high_risks_reviewed'] else 'is-blocked'}"><b>{len(high_risks)}</b><span>High以上リスク</span></div>
          <div class="metric {'is-ready' if completion_gate['export_ready'] else 'is-blocked'}"><b>{'可' if completion_gate['export_ready'] else '保留'}</b><span>出力可能性</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if errors:
        st.warning(f"{len(errors)}件のURLは取得できませんでした。文書は取得成功分だけで生成しています。")
        st.dataframe(errors, width="stretch", hide_index=True)

    review_counts = _review_summary(documents)
    next_review = next(
        (document for document in documents if review_counts.get("確認済み", 0) < len(documents) and document.review_status != "確認済み"),
        None,
    )
    dashboard_tab, pages_tab, docs_tab, evidence_tab, improvement_tab, export_tab = st.tabs(
        ["ダッシュボード", "画面", "文書レビュー", "根拠・確認事項", "改善", "出力"]
    )

    with dashboard_tab:
        total_headings = sum(len(item.headings) for item in analyses)
        total_links = sum(len(item.links) for item in analyses)
        total_inputs = sum(len(item.inputs) for item in analyses)
        st.markdown("#### 解析サマリー")
        top_left, top_right = st.columns([1.6, 1])
        with top_left:
            st.markdown(
                f"""
                <div class="summary-card">
                  <div class="summary-card-title">対象システム候補 / {len(analyses)}ページ解析</div>
                  <div><b>{analysis.title}</b></div>
                  <div style="margin-top:8px;color:var(--color-text-secondary);font-size:13px;">{analysis.url}</div>
                  <div style="margin-top:12px;">{analysis.description or analysis.body_excerpt[:180] or '未取得'}</div>
                  <div style="margin-top:12px;color:var(--color-text-secondary);font-size:13px;">合計: 見出し {total_headings} / リンク {total_links} / 入力項目 {total_inputs}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with top_right:
            st.markdown(
                f"""
                <div class="summary-card">
                  <div class="summary-card-title">次にレビューすべき文書</div>
                  <div><b>{next_review.title if next_review else '全ドキュメント確認済み'}</b></div>
                  <div style="margin-top:8px;color:var(--color-text-secondary);font-size:13px;">確認済み {review_counts.get('確認済み', 0)} / {len(documents)} 文書</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        st.markdown("#### レビュー完了条件")
        st.markdown(
            f"""
            <div class="gate-grid">
              <div class="gate-item {'ok' if completion_gate['documents_reviewed'] else 'ng'}"><div class="gate-label">条件1</div><div class="gate-value">全文書が確認済み</div></div>
              <div class="gate-item {'ok' if completion_gate['high_risks_reviewed'] else 'ng'}"><div class="gate-label">条件2</div><div class="gate-value">High以上リスク確認済み</div></div>
              <div class="gate-item {'ok' if completion_gate['questions_answered'] else 'ng'}"><div class="gate-label">条件3</div><div class="gate-value">未確認事項回答済み</div></div>
              <div class="gate-item {'ok' if completion_gate['export_ready'] else 'ng'}"><div class="gate-label">条件4</div><div class="gate-value">レビュー済み版を出力可能</div></div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.checkbox(
            "High以上リスクを確認済み",
            key="reverse_high_risk_confirmed",
            help="High以上リスクの内容を確認し、引継ぎ時の注意点として扱える状態ならチェックします。",
        )
        st.markdown(
            """
            <div class="risk-note">
              断定できない項目は推定として扱い、トレーサビリティに根拠を残します。
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.markdown("#### 要素抽出サマリー")
        left, right = st.columns([1, 1])
        with left:
            st.markdown("##### 主要見出し")
            st.write(analysis.headings[:20] or ["未検出"])
            st.markdown("##### 主要導線候補")
            st.dataframe(
                [{"text": link.text, "href": link.href, "external": link.is_external} for link in analysis.links[:30]],
                width="stretch",
                hide_index=True,
            )
        with right:
            st.markdown("##### 入力項目候補")
            st.dataframe(
                [{"label": item.label, "name": item.name, "type": item.input_type} for item in analysis.inputs[:40]],
                width="stretch",
                hide_index=True,
            )
            st.markdown("##### 操作要素候補")
            st.dataframe(
                [{"label": item.label, "kind": item.kind, "type": item.input_type} for item in analysis.actions[:40]],
                width="stretch",
                hide_index=True,
            )

    with pages_tab:
        st.markdown("#### 重要画面候補")
        st.dataframe(system.screens, width="stretch", hide_index=True)
        st.markdown("#### 画面遷移候補")
        st.dataframe(system.transitions, width="stretch", hide_index=True)

    with docs_tab:
        doc_titles = [document.title for document in documents]
        left, right = st.columns([1, 1])
        with left:
            st.markdown("#### 文書選択")
            selected = st.radio("表示する文書", doc_titles)
            raw_document = next(doc for doc in stored_documents if doc.title == selected)
            current_status = review_statuses.get(raw_document.slug, raw_document.review_status)
            selected_status = st.selectbox(
                "レビュー状態",
                REVIEW_STATUSES,
                index=REVIEW_STATUSES.index(current_status) if current_status in REVIEW_STATUSES else 0,
                key=f"reverse_doc_status_{raw_document.slug}",
            )
            review_statuses[raw_document.slug] = selected_status
            document = _document_with_review_state(raw_document, selected_status)
            st.download_button(
                "この文書をMarkdownで保存",
                data=document.markdown.encode("utf-8"),
                file_name=f"{document.slug}.md",
                mime="text/markdown",
                width="stretch",
            )
        with right:
            st.markdown("#### Markdownプレビュー")
            st.markdown(document.markdown)

    with evidence_tab:
        st.markdown("#### トレーサビリティ")
        st.dataframe(system.traceability, width="stretch", hide_index=True)
        st.markdown("#### 外部サービス/外部IF候補")
        st.dataframe(system.external_interfaces, width="stretch", hide_index=True)
        st.markdown("#### 未確認事項")
        for question in system.unanswered_questions:
            answer_key = f"reverse_question_answer_{question['question_id']}"
            if answer_key not in st.session_state:
                st.session_state[answer_key] = question_answers.get(question["question_id"], "")
            st.text_area(
                f"{question['question_id']} {question['topic']}",
                placeholder=question["question"],
                key=answer_key,
                height=82,
            )
            question_answers[question["question_id"]] = st.session_state.get(answer_key, "")

    with improvement_tab:
        st.markdown("#### 狩野モデルUXレビュー")
        category_counts = {category: 0 for category in ["当たり前品質", "一元的品質", "魅力的品質", "無関心品質", "逆品質"]}
        for row in kano_rows:
            category_counts[row["classification"]] = category_counts.get(row["classification"], 0) + 1
        st.markdown(
            "<div class='kano-counts'>"
            + "".join(
                f"<div class='kano-card'><b>{count}</b><span>{category}</span></div>"
                for category, count in category_counts.items()
            )
            + "</div>",
            unsafe_allow_html=True,
        )
        high_kano = [row for row in kano_rows if row.get("severity") in {"Critical", "High"}]
        st.markdown(
            f"""
            <div class="quality-gate">
              <strong>High以上の改善項目: {len(high_kano)}件</strong><br>
              当たり前品質を先に潰し、その後に一元的品質と魅力的品質を伸ばします。
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.dataframe(kano_rows, width="stretch", hide_index=True)

    with export_tab:
        export_documents = _documents_with_current_review_state(stored_documents)
        csv_exports = _csv_exports_with_answers(
            system,
            answers=dict(question_answers),
            documents=export_documents,
            review_statuses=dict(review_statuses),
            high_risk_confirmed=bool(st.session_state.get("reverse_high_risk_confirmed", False)),
        )
        all_markdown = bundle_markdown(export_documents)
        reviewed_markdown = build_reviewed_markdown(export_documents)
        st.markdown("#### 品質ゲート")
        st.markdown(
            f"""
            <div class="quality-gate">
              <strong>出力可能性: {'可' if completion_gate['export_ready'] else '保留'}</strong><br>
              ZIPにはMarkdown文書、既存CSV、未確認事項回答、狩野モデルUXレビューCSVを含めます。
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.download_button(
            "全ドキュメントをMarkdownでダウンロード",
            data=all_markdown.encode("utf-8"),
            file_name="reverse-documents.md",
            mime="text/markdown",
            width="stretch",
        )
        st.download_button(
            "レビュー済み版Markdownをダウンロード",
            data=reviewed_markdown.encode("utf-8"),
            file_name="reverse-documents-reviewed.md",
            mime="text/markdown",
            width="stretch",
        )
        st.download_button(
            "文書別Markdown + CSV ZIPをダウンロード",
            data=build_zip(export_documents, csv_exports=csv_exports),
            file_name="reverse-documents-package.zip",
            mime="application/zip",
            width="stretch",
        )
        st.download_button(
            "未確認事項一覧CSVをダウンロード",
            data=csv_exports["csv/unanswered-questions.csv"].encode("utf-8"),
            file_name="unanswered-questions.csv",
            mime="text/csv",
            width="stretch",
        )
        st.code(all_markdown[:5000] + ("\n\n..." if len(all_markdown) > 5000 else ""), language="markdown")


if __name__ == "__main__":
    main()
