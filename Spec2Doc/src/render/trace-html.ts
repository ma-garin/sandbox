// traceability.html（自己完結 1 ファイル）。関係図・管理（トレーサビリティ・マトリクス）・抜けの 3 タブ。
// デザインは yuki-aidd-kit を踏襲: tokens.css → components.css → layout.css を無改変で <style> に埋め込み、骨格は .layout-2pane
// （左に絞り込み、右に本体）。トーストは kit の feedback.js と同じクラス。独自 CSS（TRACE_CSS）は var(--*) だけ。
// graph と review は <script type="application/json"> に入れ、< > & U+2028/2029 を \uXXXX にしてソース由来の文字列で script を閉じさせない。
// 実行するスクリプトは 1 つの inline <script> だけ（中身はデータに依らず一定。CSP の sha256 を固定できる）。

import { DOC_TITLES, EVIDENCE_LABELS } from '../doc/model.ts';
import { REVIEW_STATUS_LABEL, TRACE_VERSION, type TraceGraph, type TraceReview } from '../trace/schema.ts';
import { escapeHtml, kitIcon } from './html.ts';
import { COMPONENTS_CSS, LAYOUT_CSS, TOKENS_CSS } from './kit-css.ts';
import { TRACE_APP_JS } from './trace-html/app.ts';
import { TRACE_GRAPH_JS } from './trace-html/graph.ts';
import { TRACE_MANAGE_JS } from './trace-html/manage.ts';
import { TRACE_LIB_JS } from './trace-html/lib.ts';

export interface TraceHtmlOptions {
  /** 確認状態の保存先（PUT）。window.SPEC2DOC_TRACE_API が優先。どちらも無ければ localStorage */
  apiUrl?: string;
}

/** JSON を <script type="application/json"> に安全に入れられる文字列にする */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** 画面のスクリプト（1 つにまとめた inline script の中身）。データに依らず一定 */
export function traceScript(): string {
  const icons = { close: kitIcon('close', 18), closeSmall: kitIcon('close', 14), ok: kitIcon('check-circle', 20), error: kitIcon('error', 20), info: kitIcon('info', 20) };
  return `(function () {\n'use strict';\nvar ICON = ${embedJson(icons)};\n${TRACE_LIB_JS}\n${TRACE_GRAPH_JS}\n${TRACE_MANAGE_JS}\n${TRACE_APP_JS}\n})();`;
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
.layout-2pane > main.trace-main { height: 100dvh; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); }
.trace-head { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
.trace-head h1 { margin: 0; font-size: var(--text-xl); line-height: var(--leading-tight); }
.trace-head .save-status { margin-left: auto; font-size: var(--text-sm); color: var(--color-text-secondary); }
.side-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.side-title { margin: 0; font-weight: 700; font-size: var(--text-md); }
.side-close, .side-open { display: none; }
.side-sec { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4) 0; border-bottom: 1px solid var(--color-border); }
.side-set { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
.side-set legend { padding: 0; margin-bottom: var(--space-1); font-size: var(--text-sm); color: var(--color-text-secondary); }
.kind-opt { display: flex; align-items: center; gap: var(--space-2); min-height: 32px; font-size: var(--text-sm); cursor: pointer; }
.kind-opt .count { margin-left: auto; font-family: var(--font-mono); color: var(--color-text-secondary); }
.swatch { width: 12px; height: 12px; flex: none; }
.swatch--folder { background: var(--color-text-secondary); border-radius: var(--radius-sm); }
.swatch--file { background: var(--color-border-strong); border-radius: 0; }
.swatch--code { background: var(--color-primary); border-radius: var(--radius-full); }
.swatch--doc { background: var(--color-primary-dark); transform: rotate(45deg) scale(.8); }
.swatch--section { background: var(--color-primary-light); border: 1px solid var(--color-primary); border-radius: var(--radius-full); transform: scale(.7); }
.side-actions .btn, .field-icon { display: inline-flex; align-items: center; gap: var(--space-2); }
.side-actions { display: flex; flex-direction: column; gap: var(--space-2); }
.graph-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-4); flex: 1; min-height: 480px; }
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
.table-card { padding: 0; }
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
.grp-toggle { display: flex; align-items: center; gap: var(--space-2); width: 100%; min-height: 0; padding: var(--space-2) var(--space-3); border: 0; background: none; color: var(--color-text); font: inherit; text-align: left; cursor: pointer; }
.grp--doc .grp-title { font-weight: 700; }
.grp--sec .grp-toggle { padding-left: var(--space-8); }
.grp-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grp-meta { margin-left: auto; flex: none; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-secondary); }
.bulk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); font-size: var(--text-sm); }
.bulk-all { display: inline-flex; align-items: center; gap: var(--space-2); margin-right: var(--space-4); }
.detail-status { margin: var(--space-2) 0 var(--space-4); flex-wrap: wrap; }
.detail-memo .textarea { width: 100%; min-height: 120px; resize: vertical; }
.detail-nav { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.detail-nav .btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.detail-meta dd.pre { white-space: pre-line; }
.pager button.page { border: 0; background: transparent; font: inherit; }
.pager button.page[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.pager .page.gap { cursor: default; }
.chip .x { display: inline-flex; padding: 0; border: 0; background: none; color: var(--color-text-secondary); cursor: pointer; min-height: 0; min-width: 0; }
.gaps { display: flex; flex-direction: column; gap: var(--space-6); }
.ev-tag { font-weight: 600; padding: 0 var(--space-2); line-height: var(--leading-normal); vertical-align: baseline; }
.ev-tag--fact { color: var(--color-primary-dark); background: var(--color-primary-light); border-color: var(--color-primary); border-style: solid; }
.ev-tag--inference { color: var(--color-info); background: var(--color-info-bg); border-color: var(--color-info-border); border-style: dashed; }
.ev-tag--unknown { color: var(--color-text-secondary); background: var(--color-surface-2); border-color: var(--color-border-strong); border-style: dotted; }
@media (max-width: 1024px) { .graph-wrap, .manage-wrap { grid-template-columns: 1fr; } .graph-detail { max-height: none; } }
@media (max-width: 768px) {
  .side-close, .side-open { display: inline-flex; }
  .sidenav.open { display: block; position: fixed; inset: 0 auto 0 0; width: min(320px, 85vw); z-index: var(--z-toast); box-shadow: var(--shadow-pop); }
  .layout-2pane > main.trace-main { height: auto; overflow: visible; padding: var(--space-4); }
}
`;

const KIND_OPTIONS: [string, string][] = [
  ['folder', 'フォルダ（角丸四角）'], ['file', 'ファイル（四角）'], ['code', 'コード要素（円）'], ['doc', '文書（ひし形）'], ['section', '節（小さい円）'],
];

function sidebar(): string {
  const kinds = KIND_OPTIONS.map(
    ([k, label]) => `<label class="kind-opt"><input type="checkbox" data-kind="${k}" checked><span class="swatch swatch--${k}" aria-hidden="true"></span>${label}<span class="count"></span></label>`,
  ).join('');
  return `<aside class="sidenav" id="trace-side" aria-label="絞り込み">
<div class="side-head"><p class="side-title">絞り込み</p><button class="btn btn--ghost side-close" id="side-close" type="button" aria-label="絞り込みを閉じる">${kitIcon('close')}</button></div>
<section class="side-sec" data-for="graph">
<div class="field"><label for="g-search" class="field-icon">${kitIcon('manage-search', 16)}<span>点を探す</span></label><input class="input" id="g-search" type="search" placeholder="名前・パス" autocomplete="off"></div>
<p class="muted" id="g-search-count" role="status"></p>
<label class="kind-opt"><input type="checkbox" id="g-detail-mode">詳細を表示（コード要素・節）</label>
<fieldset class="side-set"><legend>表示する種類（凡例）</legend>${kinds}</fieldset>
<div id="g-fold"><label class="kind-opt"><input type="checkbox" id="g-expand">コード要素を展開</label><p class="muted" id="g-fold-note"></p></div>
</section>
<section class="side-sec" data-for="manage">
<div class="field"><label for="f-doc">文書</label><select class="select" id="f-doc"><option value="">すべて</option></select></div>
<div class="field"><label for="f-status">状態</label><select class="select" id="f-status"><option value="">すべて</option></select></div>
<div class="field"><label for="f-evidence">根拠</label><select class="select" id="f-evidence"><option value="">すべて</option></select></div>
<div class="field"><label for="f-text">語</label><input class="input" id="f-text" type="search" placeholder="節・要約・ソース位置・メモ" autocomplete="off"></div>
</section>
<section class="side-sec side-actions" data-for="graph manage gaps">
<button class="btn" id="io-csv" type="button">${kitIcon('download')}<span>CSV で書き出す</span></button>
<button class="btn" id="io-json" type="button">${kitIcon('download')}<span>JSON で書き出す</span></button>
<button class="btn" id="io-import" type="button">${kitIcon('data-object')}<span>JSON を読み込む</span></button>
<input type="file" id="io-file" accept="application/json,.json" hidden>
</section>
</aside>`;
}

function mainPane(): string {
  const th = (cols: string[]) => `<thead><tr>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>`;
  return `<main class="trace-main">
<header class="trace-head">
<button class="btn btn--ghost side-open" id="side-open" type="button" aria-controls="trace-side">${kitIcon('checklist')}<span>絞り込み</span></button>
<h1>トレーサビリティ</h1><p class="muted" id="t-meta"></p><span class="save-status" id="t-save" role="status"></span>
</header>
<div class="seg" role="tablist" aria-label="表示">
<button type="button" role="tab" id="tab-btn-graph" data-tab="graph" aria-controls="tab-graph" class="active" aria-selected="true">関係図</button>
<button type="button" role="tab" id="tab-btn-manage" data-tab="manage" aria-controls="tab-manage" aria-selected="false" tabindex="-1">管理</button>
<button type="button" role="tab" id="tab-btn-gaps" data-tab="gaps" aria-controls="tab-gaps" aria-selected="false" tabindex="-1">抜け（<span id="tab-gaps-count">0</span>）</button>
</div>
<section id="tab-graph" role="tabpanel" aria-labelledby="tab-btn-graph" class="graph-wrap">
<div class="card graph-stage"><canvas id="g-canvas" role="img" aria-label="関係図。点を選ぶと右に詳細が出ます"></canvas>
<div class="graph-tools"><span class="muted" id="g-count"></span><button class="btn" id="g-fit" type="button">全体を表示</button></div></div>
<aside class="card graph-detail" id="g-detail" aria-live="polite"></aside>
</section>
<section id="tab-manage" role="tabpanel" aria-labelledby="tab-btn-manage" hidden>
<div class="kpi-row" id="m-kpi"></div>
<div class="filter-row" id="m-chips"></div>
<div class="manage-wrap">
<div class="card table-card"><div class="bulk-bar" id="m-bulk"></div><div class="table-wrap"><table class="table trace-table compact" id="m-table"><colgroup><col class="c-check"><col><col class="c-ev"><col class="c-src"><col class="c-st"></colgroup>${th(['<span class="visually-hidden">選択</span>', '要約', '根拠', 'ソース位置', '状態'])}<tbody id="m-body"></tbody></table></div><div class="pagebar" id="m-pagebar"></div></div>
<aside class="card graph-detail" id="m-detail" aria-live="polite"></aside>
</div>
</section>
<section id="tab-gaps" role="tabpanel" aria-labelledby="tab-btn-gaps" class="gaps" hidden>
<div class="card table-card"><h2>未記述（どの節からも参照されないファイル・コード要素）</h2><div class="table-wrap"><table class="table trace-table">${th(['種類', '名前', '位置', '要素の種類・解析'])}<tbody id="gap-u-body"></tbody></table></div><div class="pagebar" id="gap-u-pagebar"></div></div>
<div class="card table-card"><h2>根拠なし（ソース位置の無い行）</h2><div class="table-wrap"><table class="table trace-table">${th(['文書', '節', '要約', '根拠', '状態'])}<tbody id="gap-s-body"></tbody></table></div><div class="pagebar" id="gap-s-pagebar"></div></div>
</section>
</main>`;
}

export function renderTraceHtml(graph: TraceGraph, review?: TraceReview, options: TraceHtmlOptions = {}): string {
  const data = {
    graph,
    review: review ?? { version: TRACE_VERSION, runId: graph.runId, reviews: {} },
    labels: { status: REVIEW_STATUS_LABEL, evidence: EVIDENCE_LABELS, docs: DOC_TITLES },
    ...(options.apiUrl ? { apiUrl: options.apiUrl } : {}),
  };
  return `<!doctype html>
<html lang="ja" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>トレーサビリティ ${escapeHtml(graph.runId)}</title>
<style>
${TOKENS_CSS}
${COMPONENTS_CSS}
${LAYOUT_CSS}
${TOAST_CSS}
${TRACE_CSS}
</style></head>
<body>
<div class="layout-2pane">
${sidebar()}
${mainPane()}
</div>
<script type="application/json" id="trace-data">${embedJson(data)}</script>
<script>${traceScript()}</script>
</body></html>
`;
}
