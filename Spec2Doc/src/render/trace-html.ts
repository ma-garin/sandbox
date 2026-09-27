// traceability.html（自己完結 1 ファイル）。関係図・マトリクス・管理・抜け・比較の 5 タブ。
// デザインは yuki-aidd-kit を踏襲: tokens.css → components.css → layout.css を無改変で <style> に埋め込み、骨格は管理画面の型
// （.app-globalbar → .app-body（左に絞り込み .sidenav ＋ .maincol（.app-topbar ＋ .app-content））。KPI 行は本文の最上段に常時。
// Web アプリに埋め込むとき（URL に embed=1、または options.embed）は globalbar と topbar を出さず、主操作を KPI 行の右に移す。トーストは kit の feedback.js と同じクラス。独自 CSS（TRACE_CSS）は var(--*) だけ。
// graph と review は <script type="application/json"> に入れ、< > & U+2028/2029 を \uXXXX にしてソース由来の文字列で script を閉じさせない。
// 実行するスクリプトは 1 つの inline <script> だけ（中身はデータに依らず一定。CSP の sha256 を固定できる）。

import { DOC_TITLES, EVIDENCE_LABELS } from '../doc/model.ts';
import { LINK_KIND_LABEL, REVIEW_STATUS_LABEL, SUSPECT_REASON_LABEL, TRACE_VERSION, type TraceGraph, type TraceReview } from '../trace/schema.ts';
import { escapeHtml, kitIcon } from './html.ts';
import { COMPONENTS_CSS, LAYOUT_CSS, TOKENS_CSS } from './kit-css.ts';
import { TRACE_APP_JS } from './trace-html/app.ts';
import { TRACE_GRAPH_JS } from './trace-html/graph.ts';
import { TRACE_MANAGE_JS } from './trace-html/manage.ts';
import { TRACE_LIB_JS } from './trace-html/lib.ts';
import { TRACE_REVIEW_LIB_JS } from './trace-html/lib-review.ts';
import { TRACE_DETAIL_JS } from './trace-html/detail.ts';
import { TRACE_GAPS_JS } from './trace-html/gaps.ts';
import { TRACE_MATRIX_JS } from './trace-html/matrix.ts';
import { TRACE_COMPARE_JS } from './trace-html/compare.ts';
import { TRACE_VIEWS_JS } from './trace-html/views.ts';
import { TRACE_CSS_EXTRA } from './trace-html/style.ts';
import { mainCol, sidebar } from './trace-html/markup.ts';

export interface TraceHtmlOptions {
  /** 確認状態の保存先（PUT）。window.SPEC2DOC_TRACE_API が優先。どちらも無ければ localStorage */
  apiUrl?: string;
  /** Web アプリの本文に埋め込む表示（globalbar・topbar を出さない）。URL の embed=1 でも同じになる */
  embed?: boolean;
}

/** JSON を <script type="application/json"> に安全に入れられる文字列にする */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** 画面のスクリプト（1 つにまとめた inline script の中身）。データに依らず一定 */
export function traceScript(): string {
  const icons = { close: kitIcon('close', 18), closeSmall: kitIcon('close', 14), ok: kitIcon('check-circle', 20), error: kitIcon('error', 20), info: kitIcon('info', 20) };
  return `(function () {\n'use strict';\nvar ICON = ${embedJson(icons)};\n${TRACE_LIB_JS}\n${TRACE_REVIEW_LIB_JS}\n${TRACE_GRAPH_JS}\n${TRACE_MANAGE_JS}\n${TRACE_DETAIL_JS}\n${TRACE_GAPS_JS}\n${TRACE_MATRIX_JS}\n${TRACE_COMPARE_JS}\n${TRACE_VIEWS_JS}\n${TRACE_APP_JS}\n})();`;
}

/** kit の feedback.js が自己注入するトーストの CSS の写し（kit-css.ts に無いため） */
const TOAST_CSS = `
.toast-host { position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast);
  display: flex; flex-direction: column; align-items: stretch; gap: var(--space-2, 8px);
  width: min(360px, calc(100vw - var(--space-8, 32px))); pointer-events: none; }
.toast { display: flex; align-items: flex-start; gap: var(--space-3, 12px); padding: var(--space-3, 12px) var(--space-4, 16px);
  border: 1px solid var(--color-border, #E0E0E0); border-radius: var(--radius-md, 8px); background: var(--color-surface, #fff);
  color: var(--color-text, #212121); box-shadow: var(--shadow-pop, 0 12px 32px rgba(20,32,50,.14)); pointer-events: auto;
  font-size: var(--text-base, 14px); line-height: var(--leading-normal, 1.7);
  opacity: 0; transform: translateY(6px); transition: opacity var(--motion-normal, .2s), transform var(--motion-normal, .2s); }
.toast.is-shown { opacity: 1; transform: none; }
.toast.is-leaving { opacity: 0; transform: translateY(4px); }
.toast-icon { display: flex; margin-top: 3px; flex: none; }
.toast-ok    { border-color: var(--color-low-border, #A5D6A7); }    .toast-ok .toast-icon    { color: var(--color-low, #317C34); }
.toast-error { border-color: var(--color-critical-border, #F4B4B4); } .toast-error .toast-icon { color: var(--color-critical, #CD2B2B); }
.toast-body { flex: 1; min-width: 0; }
.toast-message { margin: 0; font-weight: 600; }
.toast-detail { margin: var(--space-1, 4px) 0 0; color: var(--color-text-secondary, #616161); font-size: var(--text-sm, 13px); }
.toast-action { display: inline-block; margin-top: var(--space-2, 8px); padding: 0; border: 0; background: none;
  color: var(--color-primary, #176DC2); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; min-height: 0; min-width: 0; }
.toast-close { flex: none; border: 0; background: none; color: var(--color-text-secondary, #616161); cursor: pointer;
  padding: 2px; min-height: 0; min-width: 0; display: flex; border-radius: var(--radius-sm, 4px); }
.toast-close:hover { background: var(--color-surface-2, #F1F3F4); }
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
`;

export const TRACE_CSS = `
/* ── Spec2Doc トレーサビリティ（kit に無い最小限。値は var(--*) だけ） ── */
html[data-theme="light"] { color-scheme: light; }
[hidden] { display: none !important; }
.trace-app { display: flex; flex-direction: column; height: 100dvh; }
.trace-body { flex: 1 1 auto; }
.trace-body > .sidenav { position: static; flex: 0 0 280px; width: 280px; height: auto; display: flex; flex-direction: column; gap: var(--space-4); }
.brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: none; border-radius: var(--radius-sm);
  background: var(--color-primary); color: var(--color-on-primary); font-weight: 700; font-size: var(--text-sm); }
.brand-home { display: inline-flex; align-items: center; gap: var(--space-2); }
.back-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-primary); font-weight: 600; }
.topbar-titles { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.app-topbar .save-status, .embed-actions .save-status { font-size: var(--text-sm); color: var(--color-text-secondary); }
.app-topbar .btn--primary, .embed-actions .btn--primary, .side-io .btn { display: inline-flex; align-items: center; gap: var(--space-2); }
.trace-main { display: flex; flex-direction: column; gap: var(--space-4); }
.trace-meta { margin: 0; font-size: var(--text-sm); }
.trace-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-4); align-items: start; }
.trace-summary .kpi-row { margin-bottom: 0; }
.embed-actions { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); }
.embed-actions:empty { display: none; }
html.is-embed .app-globalbar, html.is-embed .app-topbar { display: none; }
.kpi-delta.warn { color: var(--color-high); }
.trace-toolbar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.trace-tabs > button { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: var(--space-2) var(--space-4); }
.tab-count { background: var(--color-surface-3); color: var(--color-text-secondary); font-family: var(--font-mono); }
.trace-tabs > .active .tab-count { background: var(--color-primary-light); color: var(--color-primary-dark); }
.side-card { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); box-shadow: none; }
.side-head h2 { margin: 0; font-size: var(--text-md); }
.side-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.side-close, .side-open { display: none; }
.side-sec { display: flex; flex-direction: column; gap: var(--space-3); }
.side-sub { margin: var(--space-2) 0 0; font-size: var(--text-sm); font-weight: 700; }
.legend-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.legend-table th { padding: var(--space-1) 0; text-align: left; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); }
.legend-table th.num, .legend-table td.num { text-align: right; }
.legend-table td { padding: 0; border-bottom: 1px solid var(--color-divider); }
.legend-table td.num { font-family: var(--font-mono); color: var(--color-text-secondary); font-size: var(--text-xs); }
.kind-opt { display: flex; align-items: center; gap: var(--space-2); min-height: 36px; font-size: var(--text-sm); cursor: pointer; }
.kind-opt .shape { display: block; font-size: var(--text-xs); color: var(--color-text-secondary); line-height: var(--leading-tight); }
.swatch-box { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex: none; }
.swatch { width: 12px; height: 12px; flex: none; }
.swatch--folder { background: var(--color-text-secondary); border-radius: var(--radius-sm); }
.swatch--file { background: var(--color-border-strong); border-radius: 0; }
.swatch--code { background: var(--color-primary); border-radius: var(--radius-full); }
.swatch--doc { background: var(--color-primary-dark); transform: rotate(45deg) scale(.8); }
.swatch--section { background: var(--color-primary-light); border: 1px solid var(--color-primary); border-radius: var(--radius-full); transform: scale(.7); }
.side-note { margin: 0; font-size: var(--text-xs); }
.field-icon { display: inline-flex; align-items: center; gap: var(--space-2); }
.side-io { margin-top: auto; display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
.side-io > p { margin: 0; font-size: var(--text-xs); color: var(--color-text-secondary); }
.graph-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-4); min-height: 520px; height: calc(100dvh - 360px); }
.graph-stage { position: relative; padding: 0; overflow: hidden; min-height: 480px; }
.graph-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
.graph-tools { position: absolute; top: var(--space-2); right: var(--space-2); display: flex; align-items: center; gap: var(--space-2); }
.graph-tools .muted { font-size: var(--text-xs); }
.graph-detail { padding: var(--space-4); overflow-y: auto; max-height: calc(100dvh - 160px); }
.detail-kind { margin: 0; font-size: var(--text-xs); color: var(--color-text-secondary); }
.detail-title { margin: var(--space-1) 0 var(--space-3); font-size: var(--text-lg); overflow-wrap: anywhere; }
.detail-meta { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-3); margin: 0 0 var(--space-2); font-size: var(--text-sm); }
.detail-meta dt { color: var(--color-text-secondary); }
.detail-meta dd { margin: 0; overflow-wrap: anywhere; }
.detail-sec h3 { margin: var(--space-4) 0 var(--space-2); font-size: var(--text-sm); }
.detail-sec .btn { margin-top: var(--space-3); }
.detail-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); }
.detail-list .sec { color: var(--color-text-secondary); font-size: var(--text-xs); }
.edge-label { margin-left: var(--space-2); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-primary-dark); }
.nb-btn { padding: 0; border: 0; background: none; color: var(--color-primary); font: inherit; text-align: left; cursor: pointer; overflow-wrap: anywhere; min-height: 0; min-width: 0; }
.nb-btn:hover { text-decoration: underline; }
.st { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-secondary); }
.st--ok { color: var(--color-primary-dark); }
.st--ng { color: var(--color-high); }
.table-card { padding: 0; overflow: hidden; }
.table-card > h2 { margin: 0; padding: var(--space-4); font-size: var(--text-md); }
.trace-table td.cell-wrap { white-space: normal; overflow-wrap: anywhere; min-width: 16ch; }
.manage-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-4); align-items: start; }
.manage-wrap .graph-detail { position: sticky; top: 0; }
.trace-table.compact { table-layout: fixed; }
.trace-table.compact td, .trace-table.compact th { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.c-check { width: 44px; } .c-ev { width: 80px; } .c-src { width: 220px; } .c-st { width: 96px; }
.link-row { cursor: pointer; }
.link-row.is-selected { background: var(--color-primary-light); }
.link-row:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.grp td { padding: 0; background: var(--color-surface-2); }
.grp--sec td { background: var(--color-surface); }
.grp-toggle { display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 44px; padding: var(--space-2) var(--space-4); border: 0; background: none; color: var(--color-text); font: inherit; text-align: left; cursor: pointer; }
.grp-caret { flex: none; width: 12px; color: var(--color-text-secondary); }
.grp--doc .grp-title { font-weight: 700; }
.grp--sec .grp-toggle { min-height: 36px; padding-left: var(--space-8); font-size: var(--text-sm); }
.grp-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grp-meta { margin-left: auto; flex: none; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-secondary); }
.grp-prog { flex: none; width: 96px; height: 4px; border-radius: var(--radius-full); background: var(--color-surface-3); overflow: hidden; }
.grp--sec .grp-prog { width: 64px; }
.grp-prog-fill { display: block; height: 100%; border-radius: var(--radius-full); background: var(--color-primary); }
.bulk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); background: var(--color-surface-2); font-size: var(--text-sm); }
.bulk-all { display: inline-flex; align-items: center; gap: var(--space-2); margin-right: var(--space-4); }
.detail-status { margin: var(--space-2) 0 var(--space-4); flex-wrap: wrap; }
.detail-memo .textarea { width: 100%; min-height: 120px; resize: vertical; }
.detail-nav { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.detail-nav .btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.detail-meta dd.pre { white-space: pre-line; }
.pagebar { padding: var(--space-3) var(--space-4); }
.pager button.page { border: 0; background: transparent; font: inherit; }
.pager button.page[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.pager .page.gap { cursor: default; }
.chip .x { display: inline-flex; padding: 0; border: 0; background: none; color: var(--color-text-secondary); cursor: pointer; min-height: 0; min-width: 0; }
.filter-row { margin-bottom: 0; }
.filter-row:empty { display: none; }
.gaps { display: flex; flex-direction: column; gap: var(--space-6); }
.ev-tag { font-weight: 600; padding: 0 var(--space-2); line-height: var(--leading-normal); vertical-align: baseline; }
.ev-tag--fact { color: var(--color-primary-dark); background: var(--color-primary-light); border-color: var(--color-primary); border-style: solid; }
.ev-tag--inference { color: var(--color-info); background: var(--color-info-bg); border-color: var(--color-info-border); border-style: dashed; }
.ev-tag--unknown { color: var(--color-text-secondary); background: var(--color-surface-2); border-color: var(--color-border-strong); border-style: dotted; }
@media (max-width: 1024px) {
  .graph-wrap, .manage-wrap { grid-template-columns: 1fr; height: auto; } .graph-stage { height: 480px; } .graph-detail { max-height: none; }
  .trace-summary { grid-template-columns: 1fr; } .embed-actions { align-items: flex-start; }
}
@media (max-width: 768px) {
  .side-close, .side-open { display: inline-flex; }
  .app-topbar .save-status { display: none; }
  .trace-body > .sidenav.open { display: flex; position: fixed; inset: 0 auto 0 0; width: min(320px, 85vw); z-index: var(--z-toast); box-shadow: var(--shadow-pop); overflow-y: auto; }
}
`;

export function renderTraceHtml(graph: TraceGraph, review?: TraceReview, options: TraceHtmlOptions = {}): string {
  const data = {
    graph,
    review: review ?? { version: TRACE_VERSION, runId: graph.runId, reviews: {} },
    labels: { status: REVIEW_STATUS_LABEL, evidence: EVIDENCE_LABELS, docs: DOC_TITLES, kind: LINK_KIND_LABEL, suspect: SUSPECT_REASON_LABEL },
    ...(options.apiUrl ? { apiUrl: options.apiUrl } : {}),
  };
  return `<!doctype html>
<html lang="ja" data-theme="light"${options.embed ? ' class="is-embed"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>トレーサビリティ ${escapeHtml(graph.runId)}</title>
<style>
${TOKENS_CSS}
${COMPONENTS_CSS}
${LAYOUT_CSS}
${TOAST_CSS}
${TRACE_CSS}
${TRACE_CSS_EXTRA}
</style></head>
<body>
<div class="trace-app">
<header class="app-globalbar"><span class="brand-home"><span class="brand-mark" aria-hidden="true">S</span><span class="brand">Spec2Doc</span></span><span class="spacer"></span><a class="back-link" href="/#result">生成した文書へ戻る</a></header>
<div class="app-body trace-body">
${sidebar()}
${mainCol()}
</div>
</div>
<script type="application/json" id="trace-data">${embedJson(data)}</script>
<script>${traceScript()}</script>
</body></html>
`;
}
