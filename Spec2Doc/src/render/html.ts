// HTML 出力（自己完結 1 ファイル）。デザインは yuki-aidd-kit を踏襲する:
// tokens.css → components.css → layout.css を無改変で <style> に埋め込み、骨格は .layout-2pane（左に目次、右に本文）、
// 部品は kit のクラス（.table-wrap .table / .callout / .card、根拠ラベルは .badge の形＋中立色の .ev-tag）をそのまま使う。
// 独自 CSS（DOC_CSS）は var(--*) だけで、kit に無い最小限（本文だけのスクロール・目次の現在位置・狭幅の折りたたみ目次・印刷）。

import type { Block, Document, ListItem, Provenance } from '../doc/model.ts';
import { evidenceLabel, formatSources, hasRevisionSection } from './common.ts';
import { renderDiagramSvg } from './diagram.ts';
import { COMPONENTS_CSS, KIT_ICONS, LAYOUT_CSS, TOKENS_CSS } from './kit-css.ts';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 根拠ラベル（深刻度ではない分類）。kit の severity バッジ（badge-critical/high/…）は深刻度の列挙専用で、
 * 状態色の転用は禁止（components.md）。kit に中立のチップが無いため、.badge の形だけを借り、
 * 色は中立〜情報系のトークンで 3 点セット（文字色＋淡い背景＋同系ボーダー）を割り当て（危険色は使わない）、
 * 区別の主は文字（事実/推測/不明）、補助に枠線の種類（実線/破線/点線）。
 */
export const EVIDENCE_TAG: Readonly<Record<Provenance['evidence'], string>> = {
  fact: 'badge ev-tag ev-tag--fact',
  inference: 'badge ev-tag ev-tag--inference',
  unknown: 'badge ev-tag ev-tag--unknown',
};

export const DOC_CSS = `
/* ── Spec2Doc 文書（kit に無い最小限。値は var(--*) だけ） ── */
html[data-theme="light"] { color-scheme: light; }
.doc-main h1, .doc-main h2, .doc-main h3, .doc-main h4, .doc-main h5, .doc-main h6 { line-height: var(--leading-tight); color: var(--color-text); }
.doc-main h1 { font-size: var(--text-2xl); font-weight: 700; margin: 0 0 var(--space-2); }
.doc-main h2 { font-size: var(--text-xl); font-weight: 700; margin: var(--space-12) 0 var(--space-4); padding-top: var(--space-6); border-top: 1px solid var(--color-border); }
.doc-main h3 { font-size: var(--text-lg); font-weight: 700; margin: var(--space-8) 0 var(--space-3); }
.doc-main h4 { font-size: var(--text-md); font-weight: 600; margin: var(--space-6) 0 var(--space-2); }
.doc-main h5, .doc-main h6 { font-size: var(--text-base); font-weight: 600; margin: var(--space-5) 0 var(--space-2); }
.doc-main p, .doc-main ul, .doc-main ol { max-width: var(--text-measure); }
.doc-header { margin: 0 0 var(--space-4); }
.doc-header .meta { margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-6); }
.doc-header .meta dt { font-weight: 600; }
.doc-header .meta div { display: flex; gap: var(--space-2); }
.doc-header .meta dd { margin: 0; }
.doc-main .table-wrap { margin: 0 0 var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.doc-main .diagram-wrap { margin: 0 0 var(--space-5); padding: var(--space-3); overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.doc-main .diagram-wrap figcaption { margin: 0 0 var(--space-2); font-weight: 700; }
.doc-main .diagram-wrap svg { display: block; max-width: none; }
.doc-main .table caption { caption-side: top; text-align: left; font-weight: 600; padding: var(--space-2) var(--space-3); }
.doc-main .table { width: auto; min-width: 100%; }
.doc-main .table th, .doc-main .table td { white-space: nowrap; }
.doc-main .table .cell-wrap { white-space: normal; overflow-wrap: anywhere; min-width: calc(var(--text-measure) / 3); }
.doc-main .table .cell-wrap .badge { white-space: normal; }
.doc-main .callout { margin: 0 0 var(--space-6); flex-wrap: wrap; align-items: center; }
.doc-main section.card { margin-top: var(--space-12); }
.doc-main .callout + section > h2:first-child { margin-top: var(--space-8); }
.ev { margin-left: var(--space-2); }
.ev-tag { font-weight: 600; padding: 0 var(--space-2); line-height: var(--leading-normal); vertical-align: baseline; }
.ev-src { margin-left: var(--space-1); font-size: var(--text-xs); }
.ev-tag--fact { color: var(--color-primary-dark); background: var(--color-primary-light); border-color: var(--color-primary); border-style: solid; }
.ev-tag--inference { color: var(--color-info); background: var(--color-info-bg); border-color: var(--color-info-border); border-style: dashed; }
.ev-tag--unknown { color: var(--color-text-secondary); background: var(--color-surface-2); border-color: var(--color-border-strong); border-style: dotted; }
.table td .ev { margin-left: 0; }
.toc-title { margin: 0 0 var(--space-2); font-size: var(--text-sm); color: var(--color-text-secondary); font-weight: 600; }
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc ol { display: flex; flex-direction: column; gap: 2px; }
.toc li { margin: 0; }
.toc a { display: block; min-height: 0; min-width: 0; padding: var(--space-1) var(--space-3); line-height: var(--leading-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid transparent; border-radius: var(--radius-sm); color: var(--color-text); text-decoration: none; font-size: var(--text-sm); }
.toc a[aria-current="location"] { background: var(--color-primary-light); color: var(--color-primary-dark); border-left-color: var(--color-primary); font-weight: 600; }
.toc a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
.toc .toc-l2 a { padding-left: var(--space-6); color: var(--color-text-secondary); }
.toc .toc-l2 a[aria-current="location"] { color: var(--color-primary-dark); }
.toc-toggle { display: none; margin: 0 0 var(--space-4); min-height: var(--tap-min); }
.toc-toggle svg, .toc-close svg { flex: none; }
.toc-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.toc-close { display: none; min-height: var(--tap-min); min-width: var(--tap-min); }
@media (min-width: 769px) {
  .layout-2pane { height: 100dvh; min-height: 0; }
  .layout-2pane > main { overflow-y: auto; }
}
@media (max-width: 768px) {
  .toc-toggle { display: inline-flex; }
  .sidenav.open { display: block; position: fixed; top: 0; left: 0; bottom: 0; width: 280px; max-width: 85vw; height: auto; z-index: var(--z-dropdown); box-shadow: var(--shadow-pop); }
  .sidenav.open .toc-close { display: inline-flex; }
  .sidenav.open .toc a { min-height: var(--tap-min); line-height: var(--tap-min); padding-top: 0; padding-bottom: 0; }
  .layout-2pane > main { padding: var(--space-4); }
}
@media print {
  body { background: var(--color-surface); font-size: var(--text-sm); }
  .sidenav, .toc-toggle { display: none; }
  .layout-2pane { display: block; height: auto; }
  .layout-2pane > main { overflow: visible; padding: 0; }
  .doc-main h1, .doc-main h2, .doc-main h3 { break-after: avoid; }
  .table tr, .doc-main li, .doc-main p { break-inside: avoid; }
  .table thead { display: table-header-group; }
  .doc-main .table-wrap { overflow: visible; }
  .badge, .callout, .table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-main a { color: var(--color-text); text-decoration: none; }
}
`;

/** 目次の現在位置（本文のスクロールに合わせて aria-current を付け替える）と、狭幅の off-canvas 開閉。外部読み込みなし */
const SCROLLSPY_JS = `
(() => {
  const nav = document.getElementById('toc-nav');
  const toggle = document.querySelector('.toc-toggle');
  const closeBtn = document.querySelector('.toc-close');
  if (nav && toggle) {
    const setOpen = (open, focusBack) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) (nav.querySelector('a') || closeBtn)?.focus();
      else if (focusBack) toggle.focus();
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open'), false));
    closeBtn?.addEventListener('click', () => setOpen(false, true));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false, false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false, true); });
    document.addEventListener('click', (e) => { if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false, false); });
  }
})();
(() => {
  const main = document.querySelector('.layout-2pane > main');
  const links = [...document.querySelectorAll('.sidenav a[href^="#"]')];
  const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!main || targets.length === 0 || !('IntersectionObserver' in window)) return;
  const mark = (id) => links.forEach((a) => (a.getAttribute('href') === '#' + id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
  const io = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (hit) mark(hit.target.id);
  }, { root: window.matchMedia('(min-width: 769px)').matches ? main : null, rootMargin: '0px 0px -70% 0px' });
  targets.forEach((t) => io.observe(t));
  mark(targets[0].id);
})();
`;

/** kit の icons.js と同じ描き方（Material Symbols・viewBox 0 -960 960 960・塗りは文字色） */
export function kitIcon(name: keyof typeof KIT_ICONS, size = 18): string {
  return `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false">${KIT_ICONS[name]}</svg>`;
}

/** この文字数を超える値を持つ列は折り返してよい列（ソース位置・条件式・説明など）。それ以外は折り返さない */
export const WRAP_COLUMN_MIN_CHARS = 24;

/** 根拠タグ（区分だけ）＋ソース位置・確認事項番号はタグの外に小さな補足文字で */
/** 図の見出しに並べるソース位置の上限（全件は図の下の表にある） */
const DIAGRAM_SOURCES_MAX = 5;

function badge(p: Provenance, maxSources = Number.POSITIVE_INFINITY): string {
  const rest = Math.max(0, p.source.length - maxSources);
  const sources = rest > 0 ? `${formatSources({ ...p, source: p.source.slice(0, maxSources) })}, 他 ${rest} 件（全件は下の表）` : formatSources(p);
  const detail = [sources, p.d09Ref ?? ''].filter((x) => x !== '').join('。');
  const src = detail ? `<span class="ev-src muted mono">${escapeHtml(detail)}</span>` : '';
  return `<span class="ev"><span class="${EVIDENCE_TAG[p.evidence]}" data-evidence="${p.evidence}">${escapeHtml(evidenceLabel(p))}</span>${src}</span>`;
}

/** 目次に出す見出しの段（h2・h3 まで） */
export const TOC_MAX_HEADING = 3;

function listToHtml(items: readonly ListItem[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  const lis = items
    .map((it) => `<li>${escapeHtml(it.text)}${badge(it)}${it.children && it.children.length > 0 ? listToHtml(it.children, ordered) : ''}</li>`)
    .join('');
  return `<${tag}>${lis}</${tag}>`;
}

/** 表示文字数（タグを除く） */
function visibleLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, '_').length;
}

/** rows のセルは HTML（エスケープ済み）。長い値を持つ列だけ .cell-wrap（最小幅つきで折り返し）、他は折り返さない */
function tableHtml(columns: readonly string[], rows: readonly string[][], caption?: string): string {
  const wrap = columns.map((_, i) => rows.some((r) => visibleLength(r[i] ?? '') > WRAP_COLUMN_MIN_CHARS));
  const cls = (i: number): string => (wrap[i] ? ' class="cell-wrap"' : '');
  const cap = caption ? `<caption>${escapeHtml(caption)}</caption>` : '';
  const head = `<thead><tr>${columns.map((c, i) => `<th scope="col"${cls(i)}>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="table">${cap}${head}<tbody>${body}</tbody></table></div>`;
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${escapeHtml(block.text)}${badge(block)}</p>`;
    case 'list':
      return listToHtml(block.items, block.ordered);
    case 'diagram':
      return `<figure class="diagram-wrap"><figcaption>${escapeHtml(block.title)}${badge(block.provenance, DIAGRAM_SOURCES_MAX)}</figcaption>${renderDiagramSvg(block)}</figure>`;
    case 'table':
      return tableHtml(
        [...block.columns, '根拠'],
        block.rows.map((r) => [...r.cells.map(escapeHtml), badge(r)]),
        block.caption,
      );
  }
}

/** 見出しの段を飛ばさない（h1 は文書名。節は h2 から、前の段 +1 まで） */
export function headingLevels(levels: readonly number[]): number[] {
  return levels.reduce<number[]>((acc, lv) => {
    const prev = acc.length > 0 ? acc[acc.length - 1]! : 1;
    return [...acc, Math.max(2, Math.min(lv + 1, prev + 1, 6))];
  }, []);
}

interface TocEntry {
  id: string;
  heading: string;
  depth: number;
}

function tocList(entries: readonly TocEntry[]): string {
  return `<ol>${entries
    .map((e) => `<li class="toc-l${e.depth}"><a href="#${e.id}" title="${escapeHtml(e.heading)}">${escapeHtml(e.heading)}</a></li>`)
    .join('')}</ol>`;
}

export function renderHtml(doc: Document): string {
  const title = `${doc.id} ${doc.title}`;
  const hs = headingLevels(doc.sections.map((s) => s.level));
  const showRevision = doc.revision.length > 0 && !hasRevisionSection(doc);
  const entries: TocEntry[] = [
    ...doc.sections
      .map((s, i) => ({ id: `sec-${i + 1}`, heading: s.heading, h: hs[i] ?? 2 }))
      .filter((e) => e.h <= TOC_MAX_HEADING)
      .map((e) => ({ id: e.id, heading: e.heading, depth: e.h - 1 })),
    ...(showRevision ? [{ id: 'revision', heading: '改版履歴', depth: 1 }] : []),
  ];
  const body = doc.sections
    .map((s, i) => {
      const h = hs[i] ?? 2;
      return `<section><h${h} id="sec-${i + 1}">${escapeHtml(s.heading)}</h${h}>\n${s.blocks.map(blockToHtml).join('\n')}</section>`;
    })
    .join('\n');
  const rev = showRevision
    ? `<section class="card" aria-labelledby="revision"><h2 id="revision">改版履歴</h2>${tableHtml(
        ['生成日時', 'コミット', '変更した節'],
        doc.revision.map((r) => [escapeHtml(r.generatedAt), escapeHtml(r.commit ?? ''), escapeHtml(r.changedSections.join(', '))]),
      )}</section>`
    : '';
  const legend =
    '<div class="callout callout--info" role="note"><strong>表示の意味</strong>' +
    '<span><span class="badge ev-tag ev-tag--fact">事実</span> ソースの位置で確認済み</span>' +
    '<span><span class="badge ev-tag ev-tag--inference">推測</span> ソースから推定</span>' +
    '<span><span class="badge ev-tag ev-tag--unknown">不明</span> 確認事項一覧で確認が必要</span></div>';
  const toc = tocList(entries);
  const latest = doc.revision.at(-1);
  const meta: [string, string | undefined][] = [
    ['入力元', latest?.source],
    ['コミット', latest?.commit],
    ['生成日時', latest?.generatedAt],
  ];
  const metaHtml = meta
    .filter((m): m is [string, string] => typeof m[1] === 'string' && m[1] !== '')
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');
  const header = `<header class="card doc-header"><h1>${escapeHtml(title)}</h1>${metaHtml ? `<dl class="meta">${metaHtml}</dl>` : ''}</header>`;
  return `<!doctype html>
<html lang="ja" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
<style>
${TOKENS_CSS}
${COMPONENTS_CSS}
${LAYOUT_CSS}
${DOC_CSS}
</style></head>
<body>
<div class="layout-2pane">
<aside class="sidenav" id="toc-nav"><nav class="toc" aria-label="目次"><div class="toc-head"><p class="toc-title">目次</p><button class="btn btn--ghost toc-close" type="button" aria-label="目次を閉じる">${kitIcon('close')}</button></div>${toc}</nav></aside>
<main class="doc-main">
<button class="btn btn--ghost toc-toggle" type="button" aria-controls="toc-nav" aria-expanded="false">${kitIcon('checklist')}<span>目次</span></button>
${header}
${legend}
${body}
${rev}
</main>
</div>
<script>${SCROLLSPY_JS}</script>
</body></html>
`;
}
