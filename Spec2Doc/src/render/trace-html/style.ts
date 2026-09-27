// traceability.html の追加 CSS（マトリクス・要確認・レビュー・コメント・保存したビュー・比較・候補）。値は var(--*) だけ。
export const TRACE_CSS_EXTRA = `
.trace-summary { display: block; }
.trace-summary .kpi-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: 0; }
@media (max-width: 600px) { .trace-summary .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.embed-actions { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
.trace-tabs { flex-wrap: wrap; }
.c-kind { width: 96px; } .c-sus { width: 168px; }
.sus-cell { color: var(--color-high); font-size: var(--text-xs); font-weight: 600; }
.mx-summary { margin: 0; padding: 0 var(--space-4) var(--space-3); font-size: var(--text-sm); }
.mx-legend { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: 0 var(--space-4) var(--space-3); font-size: var(--text-xs); color: var(--color-text-secondary); }
.mx-key { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); vertical-align: middle; margin-right: var(--space-1); }
.mx-key.mx-sus-key { position: relative; background: var(--color-surface); }
.mx-wrap { max-height: calc(100dvh - 300px); overflow: auto; }
.mx-table { border-collapse: separate; border-spacing: 0; font-size: var(--text-xs); width: auto; }
.mx-table thead { position: sticky; top: 0; z-index: var(--z-sticky); }
.mx-table thead th { background: var(--color-surface-3); white-space: nowrap; }
.mx-table th, .mx-table td { padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--color-divider); }
.mx-corner { text-align: left; min-width: 220px; }
.mx-folder { text-align: left; border-left: 1px solid var(--color-border); max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.mx-col { max-width: 96px; min-width: 56px; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.mx-table .mx-row { position: sticky; left: 0; z-index: calc(var(--z-sticky) - 1); background: var(--color-surface); text-align: left; font-weight: 400; min-width: 220px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-table tfoot .mx-row { font-weight: 700; }
.mx-cell { padding: 2px; text-align: center; }
.mx-btn { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%; min-width: 44px; min-height: 36px;
  padding: var(--space-1); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font: inherit; font-family: var(--font-mono); cursor: pointer; background: var(--color-surface); color: var(--color-text); }
.mx-btn:hover { border-color: var(--color-primary); }
.mx-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.mx-l1 { background: var(--color-surface-2); }
.mx-l2 { background: var(--color-primary-light); }
.mx-l3 { background: var(--color-primary); color: var(--color-on-primary); }
.mx-l4 { background: var(--color-primary-dark); color: var(--color-on-primary); }
.mx-bar { display: block; width: 80%; height: 3px; border-radius: var(--radius-full); background: var(--color-surface-3); overflow: hidden; }
.mx-bar-fill { display: block; height: 100%; background: var(--color-low); }
.mx-sus { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--color-high); border: 1px solid var(--color-surface); }
.mx-total { text-align: right; font-family: var(--font-mono); color: var(--color-text-secondary); }
.mx-table .is-gap, .mx-table .mx-row.is-gap { background: var(--color-high-bg); color: var(--color-high); }
.detail-callout { margin: var(--space-3) 0; flex-direction: column; gap: var(--space-2); }
.detail-callout p { margin: 0; }
.detail-callout .callout-title { font-weight: 700; }
.detail-reviewer { margin-bottom: var(--space-2); }
.detail-reviewer .side-note, .detail-comment .side-note { display: block; }
.comment-text { white-space: pre-line; overflow-wrap: anywhere; }
.detail-comment .textarea { width: 100%; min-height: 72px; resize: vertical; }
.side-views { margin-top: var(--space-4); }
.view-save { display: flex; gap: var(--space-2); }
.view-save .input { flex: 1; min-width: 0; }
.view-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
.view-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
.view-item .nb-btn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compare-head { gap: var(--space-2); }
.compare-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); }
.compare-bar .field { flex: 1 1 280px; margin: 0; }
.compare-bar .btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.cand-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.cand-why { display: block; font-size: var(--text-xs); color: var(--color-text-secondary); }
.cand-list .btn { margin-top: var(--space-1); }
.side-backdrop { display: none; position: fixed; inset: 0; z-index: var(--z-modal); background: var(--color-scrim); }
@media (max-width: 768px) {
  .trace-body > .sidenav { display: none; }
  .side-backdrop.open { display: block; }
  .trace-meta { overflow-wrap: normal; word-break: keep-all; white-space: normal; }
  .trace-app { overflow-x: hidden; }
}
`;
