// traceability.html: 埋め込みのエスケープ・スクリプトが 1 つで構文が正しいこと・確認状態の保存形式（確認者・コメント・保存したビュー・ベースライン）・
// CSV・マトリクス・要確認・比較と監査の読み込み・5 つのタブの骨格
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReviewEntry, TraceGraph, TraceReview } from '../src/trace/schema.ts';
import { embedJson, renderTraceHtml, traceScript } from '../src/render/trace-html.ts';
import { TRACE_LIB_JS } from '../src/render/trace-html/lib.ts';
import { TRACE_REVIEW_LIB_JS } from '../src/render/trace-html/lib-review.ts';

const EVIL = '</script><img src=x onerror=alert(1)>';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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
      kind: 'describes', suspect: { since: '2026-09-25T00:00:00Z', reason: 'source-changed' },
    },
    {
      id: 'L2', docId: 'D02', section: '2. 機能 / F-001 init', sectionNodeId: 'section:D02/2.F-001',
      summary: '=HYPERLINK("http://x")', evidence: 'unknown', sources: [], irIds: [],
      candidates: [{ nodeId: 'code:FN-app.js-orphan', score: 0.8, why: EVIL }],
    },
  ],
};

type Links = TraceGraph['links'];
interface Matrix {
  docs: { docId: string; total: number; rows: { id: string; label: string; total: number; links: number; cells: Record<string, { count: number; judged: number; suspect: number }> }[] }[];
  cols: { file: string; folder: string; name: string; total: number }[];
  max: number; uncoveredRows: number; uncoveredCols: number;
}
interface Lib {
  setReview(r: TraceReview, id: string, patch: Partial<ReviewEntry> & { reviewer?: string; confirm?: boolean }, now: string): TraceReview;
  normalizeReview(raw: unknown, g: TraceGraph, now: string): { review: TraceReview; accepted: number; skipped: number };
  mergeReviews(a: TraceReview, b: TraceReview): TraceReview;
  buildCsv(g: TraceGraph, r: TraceReview, labels: unknown): string;
  findGaps(g: TraceGraph): { undocumented: { id: string }[]; noSource: { id: string }[] };
  foldGraph(n: TraceGraph['nodes'], e: TraceGraph['edges'], fold: boolean): { nodes: TraceGraph['nodes']; edges: TraceGraph['edges'] };
  CSV_COLUMNS: string[];
  setReviewMany(r: TraceReview, ids: string[], status: string, now: string, by?: string): TraceReview;
  overviewGraph(g: TraceGraph): { nodes: TraceGraph['nodes']; edges: (TraceGraph['edges'][number] & { weight?: number })[] };
  localExpand(g: TraceGraph, id: string, limit: number): string[];
  groupLinks(links: Links): { docId: string; count: number; sections: { section: string; links: unknown[] }[] }[];
  formatJst(iso: string): string;
  filterLinks(g: TraceGraph, r: TraceReview, f: Record<string, unknown>): Links;
  addComment(r: TraceReview, id: string, text: string, by: string, now: string): TraceReview;
  isSuspectOpen(l: Links[number], e: ReviewEntry | null, generatedAt: string): boolean;
  suspectCount(g: TraceGraph, r: TraceReview): number;
  confirmLink(r: TraceReview, id: string, by: string, now: string): TraceReview;
  saveView(r: TraceReview, name: string, tab: string, filters: Record<string, string>): TraceReview;
  deleteView(r: TraceReview, name: string): TraceReview;
  setBaseline(r: TraceReview, runId: string): TraceReview;
  buildMatrix(g: TraceGraph, r: TraceReview): Matrix;
  heatLevel(count: number, max: number): number;
  withKindLabel(e: TraceGraph['edges'][number], labels: Record<string, string>): TraceGraph['edges'][number];
  apiParts(api: string): { runs: string; run: string };
  sameSourceRuns(raw: unknown, source: string, runId: string): { runId: string; source: string; at: string }[];
  auditEvents(raw: unknown, linkId?: string): { linkId: string; field: string }[];
  compareRows(cmp: unknown, byId: Map<string, unknown>): { added: { id: string }[]; removed: { id: string }[]; changed: { id: string }[]; unchanged: number };
  gapCandidatesFor(g: unknown, nodeId: string): { nodeId: string }[];
}
// 評価するのは自前の定数（TRACE_LIB_JS・TRACE_REVIEW_LIB_JS）だけ。外部の文字列は入れない
const lib = new Function(`${TRACE_LIB_JS}\n${TRACE_REVIEW_LIB_JS}\nreturn { setReview, normalizeReview, mergeReviews, buildCsv, findGaps, foldGraph, CSV_COLUMNS, setReviewMany, overviewGraph, localExpand, groupLinks, formatJst,
  filterLinks, addComment, isSuspectOpen, suspectCount, confirmLink, saveView, deleteView, setBaseline, buildMatrix, heatLevel, withKindLabel, apiParts, sameSourceRuns, auditEvents, compareRows, gapCandidatesFor };`)() as Lib;

const EMPTY: TraceReview = { version: '1', runId: 'run-1', reviews: {} };
const T1 = '2026-09-26T01:00:00Z';
const T2 = '2026-09-26T02:00:00Z';

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
  assert.equal(data.graph.links[1]?.candidates?.[0]?.why, EVIL);
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
  // 表示は textContent。innerHTML に入れるのは自前のアイコンだけ
  for (const m of script.matchAll(/\.innerHTML = ([^;]+);/g)) assert.match(m[1] ?? '', /ICON\./);
});

test('確認状態の保存形式が TraceReview（schema）どおりで、元のオブジェクトを変えない', () => {
  const r1 = lib.setReview(EMPTY, 'L1', { status: 'ok' }, T1);
  const r2 = lib.setReview(r1, 'L1', { note: 'メモ' }, T2);
  assert.deepEqual(EMPTY.reviews, {});
  assert.deepEqual(r2, { version: '1', runId: 'run-1', reviews: { L1: { status: 'ok', note: 'メモ', updatedAt: T2, reviewedAt: T1 } } });
  assert.match(r2.reviews['L1']?.reviewedAt ?? '', ISO);
  assert.equal(lib.setReview(r2, 'L1', { note: 'x'.repeat(3000) }, 'now').reviews['L1']?.note?.length, 2000);
  assert.throws(() => lib.setReview(EMPTY, 'L1', { status: 'bad' as never }, 'now'));
  const html = renderTraceHtml(graph, r2);
  const data = JSON.parse(between(html, 'id="trace-data">', '</script>')) as { review: TraceReview; labels: { kind: Record<string, string>; suspect: Record<string, string> } };
  assert.deepEqual(data.review, r2);
  assert.equal(data.labels.kind['describes'], '記述する');
  assert.equal(data.labels.suspect['source-changed'], '根拠のソースが前回から変わった');
});

test('確認者: 判定に変えた時に確認者と日時を記録し、メモだけの変更では変えず、未確認に戻すと外す', () => {
  const r1 = lib.setReview(EMPTY, 'L1', { status: 'ng', reviewer: '山田' }, T1);
  assert.deepEqual(r1.reviews['L1'], { status: 'ng', updatedAt: T1, reviewer: '山田', reviewedAt: T1 });
  const r2 = lib.setReview(r1, 'L1', { note: 'n', reviewer: '佐藤' }, T2);
  assert.equal(r2.reviews['L1']?.reviewer, '山田');
  assert.equal(r2.reviews['L1']?.reviewedAt, T1);
  const r3 = lib.setReview(r2, 'L1', { status: 'ok', reviewer: '佐藤' }, T2);
  assert.deepEqual([r3.reviews['L1']?.reviewer, r3.reviews['L1']?.reviewedAt, r3.reviews['L1']?.note], ['佐藤', T2, 'n']);
  const r4 = lib.setReview(r3, 'L1', { status: 'unreviewed' }, T2);
  assert.equal(r4.reviews['L1']?.reviewer, undefined);
  assert.equal(r4.reviews['L1']?.reviewedAt, undefined);
  // 一括変更でも記録する
  const many = lib.setReviewMany(EMPTY, ['L1', 'L2'], 'ok', T1, '山田');
  assert.deepEqual(many.reviews['L2'], { status: 'ok', updatedAt: T1, reviewer: '山田', reviewedAt: T1 });
});

test('コメント: 追記のみで履歴が残り、状態を変えても消えず、空は拒否する', () => {
  const c1 = lib.addComment(EMPTY, 'L1', '  最初  ', '山田', T1);
  const c2 = lib.addComment(c1, 'L1', '2 件目', '', T2);
  assert.deepEqual(EMPTY.reviews, {});
  assert.deepEqual(c1.reviews['L1']?.comments, [{ at: T1, by: '山田', text: '最初' }]);
  assert.deepEqual(c2.reviews['L1']?.comments, [{ at: T1, by: '山田', text: '最初' }, { at: T2, text: '2 件目' }]);
  assert.equal(c2.reviews['L1']?.status, 'unreviewed');
  const s = lib.setReview(c2, 'L1', { status: 'ok', reviewer: '山田' }, T2);
  assert.equal(s.reviews['L1']?.comments?.length, 2);
  assert.equal(lib.setReviewMany(s, ['L1'], 'na', T2).reviews['L1']?.comments?.length, 2);
  assert.throws(() => lib.addComment(EMPTY, 'L1', '   ', '山田', T1), /空/);
  assert.equal(lib.addComment(EMPTY, 'L1', 'y'.repeat(3000), '', T1).reviews['L1']?.comments?.[0]?.text.length, 2000);
});

test('保存したビューとベースラインが TraceReview に入り、状態の変更・読み込み・重ねで失われない', () => {
  const v1 = lib.saveView(EMPTY, ' 要確認だけ ', 'manage', { suspect: 'open', status: '', node: 'file:src/app.js' });
  assert.deepEqual(v1.savedViews, [{ name: '要確認だけ', tab: 'manage', filters: { suspect: 'open', node: 'file:src/app.js' } }]);
  const v2 = lib.saveView(v1, '要確認だけ', 'matrix', {});
  assert.deepEqual(v2.savedViews, [{ name: '要確認だけ', tab: 'matrix', filters: {} }]);
  assert.throws(() => lib.saveView(EMPTY, '  ', 'manage', {}), /名前/);
  assert.throws(() => lib.saveView(EMPTY, 'x', 'bad', {}));
  const b = lib.setBaseline(v2, 'run-0');
  const r = lib.setReview(lib.addComment(b, 'L1', 'c', '山田', T1), 'L1', { status: 'ok', reviewer: '山田' }, T1);
  assert.equal(r.baselineRunId, 'run-0');
  assert.equal(r.savedViews?.length, 1);
  assert.deepEqual(lib.deleteView(r, '要確認だけ').savedViews, []);
  assert.equal(v1.savedViews?.length, 1); // 元は変えない
  // サーバ・書き出しから読み込んでも確認者・コメント・ビュー・ベースラインを保つ
  const n = lib.normalizeReview(JSON.parse(JSON.stringify(r)), graph, 'now').review;
  assert.deepEqual(n, r);
  const merged = lib.mergeReviews(EMPTY, n);
  assert.deepEqual([merged.baselineRunId, merged.savedViews?.length, merged.reviews['L1']?.reviewer], ['run-0', 1, '山田']);
  const html = renderTraceHtml(graph, r);
  assert.deepEqual((JSON.parse(between(html, 'id="trace-data">', '</script>')) as { review: TraceReview }).review, r);
});

test('読み込みはこの実行の行だけを取り込み、別の実行からなら引き継ぎ元を付ける', () => {
  const raw = { version: '1', runId: 'run-0', reviews: { L1: { status: 'ng', updatedAt: 't' }, ZZ: { status: 'ok', updatedAt: 't' }, L2: { status: 'bad' } } };
  const r = lib.normalizeReview(raw, graph, 'now');
  assert.equal(r.accepted, 1);
  assert.equal(r.skipped, 2);
  assert.deepEqual(r.review, { version: '1', runId: 'run-1', reviews: { L1: { status: 'ng', updatedAt: 't', carriedFrom: 'run-0' } } });
  assert.throws(() => lib.normalizeReview({ version: '9', reviews: {} }, graph, 'now'), /版が違います/);
});

test('要確認: 生成より後に判定すれば解消。件数・絞り込み・「確認済みにする」', () => {
  const l1 = graph.links[0]!;
  assert.equal(lib.isSuspectOpen(l1, null, graph.generatedAt), true);
  assert.equal(lib.isSuspectOpen(graph.links[1]!, null, graph.generatedAt), false);
  assert.equal(lib.suspectCount(graph, EMPTY), 1);
  // 前回の実行で判定した（生成より前の）確認は解消に数えない
  const old = lib.setReview(EMPTY, 'L1', { status: 'ok' }, '2026-09-25T12:00:00Z');
  assert.equal(lib.suspectCount(graph, old), 1);
  assert.deepEqual(lib.filterLinks(graph, old, { suspect: 'open' }).map((l) => l.id), ['L1']);
  const ok = lib.confirmLink(old, 'L1', '山田', T1);
  assert.deepEqual(ok.reviews['L1'], { status: 'ok', updatedAt: T1, reviewer: '山田', reviewedAt: T1 });
  assert.equal(lib.suspectCount(graph, ok), 0);
  assert.deepEqual(lib.filterLinks(graph, ok, { suspect: 'open' }), []);
  assert.deepEqual(lib.filterLinks(graph, EMPTY, { section: 'section:D02/2.F-001', file: 'src/app.js' }).map((l) => l.id), ['L1']);
  assert.deepEqual(lib.filterLinks(graph, EMPTY, { kind: 'describes' }).map((l) => l.id), ['L1']);
});

test('マトリクス: 行=節・列=ファイル（対象外を除く）。件数・判定済み・要確認・対応の無い行列', () => {
  const m = lib.buildMatrix(graph, EMPTY);
  assert.deepEqual(m.cols.map((c) => [c.folder, c.name, c.total]), [['src', 'app.js', 1], ['src', 'unused.js', 0]]);
  assert.equal(m.docs.length, 1);
  const row = m.docs[0]!.rows[0]!;
  assert.deepEqual([row.id, row.label, row.total, row.links], ['section:D02/2.F-001', '2. 機能 / F-001 init', 1, 2]);
  assert.deepEqual(row.cells['src/app.js'], { count: 1, judged: 0, suspect: 1 });
  assert.deepEqual([m.max, m.uncoveredRows, m.uncoveredCols], [1, 0, 1]);
  const judged = lib.buildMatrix(graph, lib.confirmLink(EMPTY, 'L1', '山田', T1));
  assert.deepEqual(judged.docs[0]!.rows[0]!.cells['src/app.js'], { count: 1, judged: 1, suspect: 0 });
  assert.deepEqual([0, 1, 2, 5, 8].map((n) => lib.heatLevel(n, 8)), [0, 1, 1, 3, 4]);
  assert.equal(lib.heatLevel(1, 1), 4);
});

test('線ラベルにリンクの種類・API の分解・同じ入力元の実行・監査・比較・候補', () => {
  const kinds = { describes: '記述する', calls: '呼び出す', uses: '利用する' };
  assert.equal(lib.withKindLabel({ from: 'a', to: 'b', kind: 'uses', label: 'C/R' }, kinds).label, '利用する C/R');
  assert.equal(lib.withKindLabel({ from: 'a', to: 'b', kind: 'documents' }, kinds).label, '記述する');
  assert.equal(lib.withKindLabel({ from: 'a', to: 'b', kind: 'contains' }, kinds).label, undefined);
  assert.deepEqual(lib.apiParts('/api/runs/r-1/trace-review'), { runs: '/api/runs', run: '/api/runs/r-1' });
  assert.deepEqual(lib.apiParts(''), { runs: '', run: '' });
  const runs = { runs: [{ runId: 'a', source: 's', startedAt: '2026-01-01' }, { runId: 'b', source: 's', startedAt: '2026-02-01' }, { runId: 'c', source: 'x' }, { runId: 'run-1', source: 's' }] };
  assert.deepEqual(lib.sameSourceRuns(runs, 's', 'run-1').map((r) => r.runId), ['b', 'a']);
  const events = { events: [{ at: 't2', runId: 'run-1', linkId: 'L1', field: 'status', from: 'unreviewed', to: 'ok' }, { at: 't1', runId: 'run-1', linkId: 'L2', field: 'comment' }, { bad: 1 }] };
  assert.deepEqual(lib.auditEvents(events).length, 2);
  assert.deepEqual(lib.auditEvents(events, 'L1').map((e) => e.field), ['status']);
  assert.deepEqual(lib.auditEvents(null), []);
  const byId = new Map<string, unknown>(graph.links.map((l) => [l.id, l]));
  const cmp = lib.compareRows({ baseRunId: 'run-0', runId: 'run-1', added: ['L1'], removed: ['GONE'], changed: ['L2'], unchanged: 5 }, byId);
  assert.deepEqual([cmp.added[0], cmp.removed[0], cmp.changed[0]?.id, cmp.unchanged], [graph.links[0], { id: 'GONE' }, 'L2', 5]);
  assert.deepEqual(lib.gapCandidatesFor({ gapCandidates: { 'file:src/unused.js': [{ nodeId: 'section:D02/2.F-001', score: 1, why: 'w' }] } }, 'file:src/unused.js').length, 1);
  assert.deepEqual(lib.gapCandidatesFor({ gapCandidates: [{ nodeId: 'n', candidates: [{ nodeId: 'x', score: 1, why: 'w' }] }] }, 'n').length, 1);
  assert.deepEqual(lib.gapCandidatesFor(graph, 'n'), []);
});

test('CSV は UTF-8 BOM 付き・CRLF・指定の列で、式として解釈される値を無効にする', () => {
  const review = lib.setReview(EMPTY, 'L1', { status: 'ok', note: 'a,"b"' }, T1);
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
  const base = lib.setReview(EMPTY, 'L1', { note: 'n' }, T1);
  const r = lib.setReviewMany(base, ['L1', 'L2'], 'na', T2);
  assert.deepEqual(r.reviews, { L1: { status: 'na', note: 'n', updatedAt: T2, reviewedAt: T2 }, L2: { status: 'na', updatedAt: T2, reviewedAt: T2 } });
  assert.match(r.reviews['L2']?.reviewedAt ?? '', ISO);
  assert.equal(base.reviews['L1']?.status, 'unreviewed');
  const g = lib.groupLinks(graph.links);
  assert.equal(g.length, 1);
  assert.equal(g[0]?.count, 2);
  assert.equal(g[0]?.sections[0]?.links.length, 2);
  assert.equal(lib.formatJst('2026-09-26T06:19:07.805Z'), '2026-09-26 15:19（JST）');
  assert.equal(lib.formatJst('不正'), '不正');
});

test('画面の骨格: 5 つのタブ・マトリクス・管理の要確認と種類の列・比較・監査・保存したビュー・書き出し', () => {
  const html = renderTraceHtml(graph);
  const ids = ['g-detail-mode', 'm-bulk', 'm-detail', 'm-body', 'm-kpi', 'mx-host', 'mx-summary', 'mx-uncovered', 'f-suspect', 'f-kind', 'c-base', 'c-set-baseline', 'c-kpi', 'c-body',
    'audit', 'audit-body', 't-audit', 'v-name', 'v-save', 'v-list', 'io-csv', 'io-xlsx', 'io-reqif', 'io-json', 'gap-c-body', 'gap-u-body', 'gap-s-body'];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`));
  const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['graph', 'matrix', 'manage', 'gaps', 'compare']);
  for (const t of tabs) assert.match(html, new RegExp(`id="tab-${t}" role="tabpanel"`));
  assert.match(html, /<th scope="col">要確認<\/th><th scope="col">状態<\/th>/);
  assert.match(html, /<th scope="col">種類<\/th>/);
  assert.doesNotMatch(html, /<th scope="col">メモ<\/th>/);
  // KPI 行はタブの外（本文の最上段）にあり、書き出しの操作列とは別の行
  assert.ok(html.indexOf('id="m-kpi"') < html.indexOf('id="tab-manage"'));
  assert.ok(html.indexOf('id="embed-actions"') < html.indexOf('class="trace-summary"'));
  // 塗りのボタン（主操作）は画面に 1 つだけ（CSV で書き出す）
  assert.equal(html.replace(/<style>[\s\S]*?<\/style>/, '').match(/btn--primary/g)?.length, 1);
  const script = traceScript();
  for (const s of ['/trace-audit', '/trace-compare?base=', '/trace-export?format=', 'res.status === 409', 'res.status === 404', 'spec2doc-reviewer']) assert.ok(script.includes(s), s);
});

test('埋め込み表示: embed の有無で globalbar・topbar を出し分け、主操作を上部の操作列に移す', () => {
  const normal = renderTraceHtml(graph);
  const embed = renderTraceHtml(graph, undefined, { embed: true });
  assert.match(normal, /<html lang="ja" data-theme="light">/);
  assert.match(embed, /<html lang="ja" data-theme="light" class="is-embed">/);
  for (const html of [normal, embed]) {
    assert.match(html, /<header class="app-globalbar">/);
    assert.match(html, /<header class="app-topbar">/);
    assert.match(html, /id="embed-actions"/);
    assert.match(html, /html\.is-embed \.app-globalbar, html\.is-embed \.app-topbar \{ display: none; \}/);
  }
  const script = traceScript();
  assert.match(script, /embed=1/);
  assert.match(script, /window\.SPEC2DOC_EMBED === true/);
  assert.match(script, /\$\('embed-actions'\)\.appendChild\(\$\('io-csv'\)\)/);
  assert.equal(embed.includes(script), true); // 埋め込みでも実行するスクリプトは同じ（CSP の sha256 が変わらない）
});

test('狭い幅（768px 以下）: 絞り込みドロワーは既定で閉じ、背景幕・× ・Esc で開閉する', () => {
  const html = renderTraceHtml(graph);
  // 背景幕は絞り込み欄より前に置き、既定は非表示
  assert.ok(html.indexOf('id="side-backdrop"') < html.indexOf('id="trace-side"'));
  assert.match(html, /\.side-backdrop \{ display: none;/);
  // 768px 以下では絞り込み欄が既定で閉じ、開いた時だけ背景幕が出る
  assert.match(html, /@media \(max-width: 768px\) \{\s*\n\s*\.trace-body > \.sidenav \{ display: none; \}/);
  assert.match(html, /\.side-backdrop\.open \{ display: block; \}/);
  // 上端のメタ情報は折り返し可・語の途中で割らない
  assert.match(html, /\.trace-meta \{ overflow-wrap: normal; word-break: keep-all;/);
  const script = traceScript();
  assert.match(script, /sideBackdrop\.addEventListener\('click', closeSide\)/);
  assert.match(script, /ev\.key === 'Escape'/);
});
