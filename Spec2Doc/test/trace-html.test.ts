// traceability.html: 埋め込みのエスケープ・スクリプトが 1 つで構文が正しいこと・確認状態の保存形式・CSV の BOM と列
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReviewEntry, TraceGraph, TraceReview } from '../src/trace/schema.ts';
import { embedJson, renderTraceHtml, traceScript } from '../src/render/trace-html.ts';
import { TRACE_LIB_JS } from '../src/render/trace-html/lib.ts';

const EVIL = '</script><img src=x onerror=alert(1)>';

const graph: TraceGraph = {
  version: '1',
  runId: 'run-1',
  source: 'フォルダ: sample-app',
  generatedAt: '2026-09-26T00:00:00Z',
  nodes: [
    { id: 'folder:src', kind: 'folder', label: 'src', path: 'src' },
    { id: 'file:src/app.js', kind: 'file', label: EVIL, parent: 'folder:src', path: 'src/app.js', fileStatus: 'analyzed' },
    { id: 'file:src/unused.js', kind: 'file', label: 'unused.js', parent: 'folder:src', path: 'src/unused.js', fileStatus: 'analyzed' },
    { id: 'file:vendor/x.js', kind: 'file', label: 'x.js', path: 'vendor/x.js', fileStatus: 'excluded' },
    { id: 'code:FN-app.js-init', kind: 'code', label: 'init', parent: 'file:src/app.js', codeKind: 'function', line: 3 },
    { id: 'code:FN-app.js-orphan', kind: 'code', label: 'orphan', parent: 'file:src/app.js', codeKind: 'function', line: 9 },
    { id: 'doc:D02', kind: 'doc', label: '要求仕様書', docId: 'D02' },
    { id: 'section:D02/2.F-001', kind: 'section', label: 'F-001 init', parent: 'doc:D02', docId: 'D02' },
  ],
  edges: [
    { from: 'folder:src', to: 'file:src/app.js', kind: 'contains' },
    { from: 'file:src/app.js', to: 'code:FN-app.js-init', kind: 'contains' },
    { from: 'section:D02/2.F-001', to: 'code:FN-app.js-init', kind: 'documents' },
    { from: 'code:FN-app.js-init', to: 'code:FN-app.js-orphan', kind: 'uses', label: 'C/R' },
  ],
  links: [
    {
      id: 'L1', docId: 'D02', section: '2. 機能 / F-001 init', sectionNodeId: 'section:D02/2.F-001',
      summary: `初期化する ${EVIL} "引用" & \u2028改行`, evidence: 'fact', sources: [{ file: 'src/app.js', line: 3 }], irIds: ['FN-app.js-init'],
    },
    {
      id: 'L2', docId: 'D02', section: '2. 機能 / F-001 init', sectionNodeId: 'section:D02/2.F-001',
      summary: '=HYPERLINK("http://x")', evidence: 'unknown', sources: [], irIds: [],
    },
  ],
};

interface Lib {
  setReview(r: TraceReview, id: string, patch: Partial<ReviewEntry>, now: string): TraceReview;
  normalizeReview(raw: unknown, g: TraceGraph, now: string): { review: TraceReview; accepted: number; skipped: number };
  buildCsv(g: TraceGraph, r: TraceReview, labels: unknown): string;
  findGaps(g: TraceGraph): { undocumented: { id: string }[]; noSource: { id: string }[] };
  foldGraph(n: TraceGraph['nodes'], e: TraceGraph['edges'], fold: boolean): { nodes: TraceGraph['nodes']; edges: TraceGraph['edges'] };
  CSV_COLUMNS: string[];
  setReviewMany(r: TraceReview, ids: string[], status: string, now: string): TraceReview;
  overviewGraph(g: TraceGraph): { nodes: TraceGraph['nodes']; edges: (TraceGraph['edges'][number] & { weight?: number })[] };
  localExpand(g: TraceGraph, id: string, limit: number): string[];
  groupLinks(links: TraceGraph['links']): { docId: string; count: number; sections: { section: string; links: unknown[] }[] }[];
  formatJst(iso: string): string;
}
// 評価するのは自前の定数（TRACE_LIB_JS）だけ。外部の文字列は入れない
const lib = new Function(`${TRACE_LIB_JS}\nreturn { setReview, normalizeReview, buildCsv, findGaps, foldGraph, CSV_COLUMNS, setReviewMany, overviewGraph, localExpand, groupLinks, formatJst };`)() as Lib;

function between(html: string, start: string, end: string): string {
  const i = html.indexOf(start);
  assert.ok(i >= 0, `${start} が無い`);
  const j = html.indexOf(end, i + start.length);
  return html.slice(i + start.length, j);
}

test('ソース由来の </script> や <img onerror> を含んでも埋め込みが閉じず、元の値に戻せる', () => {
  const html = renderTraceHtml(graph);
  const json = between(html, '<script type="application/json" id="trace-data">', '</script>');
  assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
  const data = JSON.parse(json) as { graph: TraceGraph };
  assert.equal(data.graph.nodes[1]?.label, EVIL);
  assert.equal(data.graph.links[0]?.summary, graph.links[0]?.summary);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.match(/<script/g)?.length, 2);
  assert.equal(html.match(/<\/script>/g)?.length, 2);
  assert.equal(embedJson('\u2028'), '"\\u2028"');
});

test('実行するスクリプトは 1 つで、構文が正しく、データに依らず一定', () => {
  const html = renderTraceHtml(graph);
  const script = between(html, '<script>', '</script>');
  assert.equal(script, traceScript());
  assert.doesNotThrow(() => new Function(script)); // 構文だけを確かめる（実行しない）
  assert.equal(renderTraceHtml({ ...graph, runId: 'run-2', nodes: [], edges: [], links: [] }).includes(script), true);
  assert.match(html, /<html lang="ja" data-theme="light">/);
  assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/, ''), /<link |src="http/); // kit の CSS の注記にある <link> は除く
});

test('確認状態の保存形式が TraceReview（schema）どおりで、元のオブジェクトを変えない', () => {
  const base: TraceReview = { version: '1', runId: 'run-1', reviews: {} };
  const r1 = lib.setReview(base, 'L1', { status: 'ok' }, '2026-09-26T01:00:00Z');
  const r2 = lib.setReview(r1, 'L1', { note: 'メモ' }, '2026-09-26T02:00:00Z');
  assert.deepEqual(base.reviews, {});
  assert.deepEqual(r2, { version: '1', runId: 'run-1', reviews: { L1: { status: 'ok', note: 'メモ', updatedAt: '2026-09-26T02:00:00Z' } } });
  assert.equal(lib.setReview(r2, 'L1', { note: 'x'.repeat(3000) }, 'now').reviews['L1']?.note?.length, 2000);
  assert.throws(() => lib.setReview(base, 'L1', { status: 'bad' as never }, 'now'));
  const html = renderTraceHtml(graph, r2);
  const data = JSON.parse(between(html, 'id="trace-data">', '</script>')) as { review: TraceReview };
  assert.deepEqual(data.review, r2);
});

test('読み込みはこの実行の行だけを取り込み、別の実行からなら引き継ぎ元を付ける', () => {
  const raw = { version: '1', runId: 'run-0', reviews: { L1: { status: 'ng', updatedAt: 't' }, ZZ: { status: 'ok', updatedAt: 't' }, L2: { status: 'bad' } } };
  const r = lib.normalizeReview(raw, graph, 'now');
  assert.equal(r.accepted, 1);
  assert.equal(r.skipped, 2);
  assert.deepEqual(r.review, { version: '1', runId: 'run-1', reviews: { L1: { status: 'ng', updatedAt: 't', carriedFrom: 'run-0' } } });
  assert.throws(() => lib.normalizeReview({ version: '9', reviews: {} }, graph, 'now'), /版が違います/);
});

test('CSV は UTF-8 BOM 付き・CRLF・指定の列で、式として解釈される値を無効にする', () => {
  const review = lib.setReview({ version: '1', runId: 'run-1', reviews: {} }, 'L1', { status: 'ok', note: 'a,"b"' }, '2026-09-26T01:00:00Z');
  const labels = { status: { unreviewed: '未確認', ok: '確認済み', ng: '要修正', na: '対象外' }, evidence: { fact: '事実', inference: '推測', unknown: '不明' }, docs: { D02: '要求仕様書' } };
  const csv = lib.buildCsv(graph, review, labels);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 4); // 見出し + 2 行 + 末尾の空
  assert.equal(lines[0], '"ID","文書","節","要約","根拠","ソース位置","状態","メモ","更新日時"');
  assert.deepEqual(lib.CSV_COLUMNS, ['ID', '文書', '節', '要約', '根拠', 'ソース位置', '状態', 'メモ', '更新日時']);
  assert.match(lines[1] ?? '', /^"L1","D02 要求仕様書",[\s\S]*"事実","src\/app\.js:3","確認済み","a,""b""","2026-09-26T01:00:00Z"$/);
  assert.match(lines[2] ?? '', /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(lines[2] ?? '', /"未確認","",""$/);
});

test('抜け: 参照されないファイル・コード要素（対象外は除く）と、ソース位置の無い行', () => {
  const g = lib.findGaps(graph);
  assert.deepEqual(g.undocumented.map((n) => n.id).sort(), ['code:FN-app.js-orphan', 'file:src/unused.js']);
  assert.deepEqual(g.noSource.map((l) => l.id), ['L2']);
});

test('畳み: code を親の file に付け替え、線のラベルを残す', () => {
  const f = lib.foldGraph(graph.nodes, graph.edges, true);
  assert.equal(f.nodes.some((n) => n.kind === 'code'), false);
  assert.deepEqual(f.edges.find((e) => e.kind === 'documents'), { from: 'section:D02/2.F-001', to: 'file:src/app.js', kind: 'documents' });
  assert.equal(f.edges.some((e) => e.kind === 'uses'), false); // 同じ file 内の線は自己ループなので消える
  const g2 = lib.foldGraph(graph.nodes, [{ from: 'code:FN-app.js-init', to: 'folder:src', kind: 'uses', label: 'C/U' }], true);
  assert.deepEqual(g2.edges, [{ from: 'file:src/app.js', to: 'folder:src', kind: 'uses', label: 'C/U' }]);
});

test('概観: folder・file・doc だけを残し、節→コードの documents を file→doc の線 1 本（件数付き）に集約する', () => {
  const o = lib.overviewGraph(graph);
  assert.deepEqual(o.nodes.map((n) => n.kind).sort(), ['doc', 'file', 'file', 'file', 'folder']);
  assert.deepEqual(o.edges.find((e) => e.kind === 'documents'), { from: 'file:src/app.js', to: 'doc:D02', kind: 'documents', weight: 1, label: '1 件' });
  assert.ok(o.edges.some((e) => e.kind === 'contains' && e.from === 'folder:src' && e.to === 'file:src/app.js'));
  assert.equal(o.edges.some((e) => e.from === e.to), false);
  assert.deepEqual(lib.localExpand(graph, 'file:src/app.js', 300).sort(), ['code:FN-app.js-init', 'code:FN-app.js-orphan', 'section:D02/2.F-001']);
  assert.deepEqual(lib.localExpand(graph, 'file:src/app.js', 1).length, 1);
});

test('一括変更はメモを残し元を変えない・文書→節のグループ・日時の表示', () => {
  const base = lib.setReview({ version: '1', runId: 'run-1', reviews: {} }, 'L1', { note: 'n' }, 't0');
  const r = lib.setReviewMany(base, ['L1', 'L2'], 'na', 't1');
  assert.deepEqual(r.reviews, { L1: { status: 'na', note: 'n', updatedAt: 't1' }, L2: { status: 'na', updatedAt: 't1' } });
  assert.equal(base.reviews['L1']?.status, 'unreviewed');
  const g = lib.groupLinks(graph.links);
  assert.equal(g.length, 1);
  assert.equal(g[0]?.count, 2);
  assert.equal(g[0]?.sections[0]?.links.length, 2);
  assert.equal(lib.formatJst('2026-09-26T06:19:07.805Z'), '2026-09-26 15:19（JST）');
  assert.equal(lib.formatJst('不正'), '不正');
});

test('画面の骨格: 詳細表示の切替・一括変更・右の詳細欄・メモ列なし', () => {
  const html = renderTraceHtml(graph);
  for (const id of ['g-detail-mode', 'm-bulk', 'm-detail', 'm-body']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /<th scope="col">メモ<\/th>/);
});
