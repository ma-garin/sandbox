// トレーサビリティ: 図のデータ（buildTraceGraph）と確認状態の引き継ぎ・検証（carryOverReview・validateReview）、core での書き出し
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/core.ts';
import { buildTrace, buildTraceGraph } from '../src/trace/graph.ts';
import { carryOverReview, validateReview } from '../src/trace/review.ts';
import { TRACE_VERSION, type TraceGraph, type TraceReview } from '../src/trace/schema.ts';
import { emptyIr, type FunctionInfo, type IR } from '../src/ir/schema.ts';
import type { Document } from '../src/doc/model.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-app');

function fn(id: string, line: number, endLine: number, calls: string[] = []): FunctionInfo {
  return { id, source: [{ file: 'src/app/a.js', line, endLine }], name: id, moduleId: 'M1', params: [], complexity: 1, calls, exported: false, refCount: 0, async: false, throws: [] };
}

function sampleIr(shift = 0): IR {
  const ir = emptyIr({ kind: 'folder', label: 'x' }, '2026-09-26T00:00:00.000Z');
  return {
    ...ir,
    files: [{ id: 'F1', source: [], path: 'src/app/a.js', language: 'javascript', status: 'analyzed', lines: 40 }],
    functions: [fn('FN-init', 1 + shift, 20 + shift, ['FN-save', 'unresolved']), fn('FN-save', 22 + shift, 30 + shift)],
    dataItems: [{ id: 'DI-key', source: [{ file: 'src/app/a.js', line: 25 + shift }], kind: 'localStorage', name: 'key', fields: [] }],
  };
}

function sampleDoc(shift = 0): Document {
  return {
    id: 'D02',
    title: '要求仕様書',
    sections: [
      { heading: '2. 機能', level: 2, blocks: [] },
      {
        heading: 'F-001 init',
        level: 3,
        blocks: [
          { type: 'paragraph', text: `初期化する（a.js:${3 + shift}）`, evidence: 'fact', source: [{ file: 'src/app/a.js', line: 3 + shift }], irIds: ['FN-init'] },
          { type: 'table', columns: ['項目', '値'], rows: [{ cells: ['保存', 'key'], evidence: 'fact', source: [{ file: 'src/app/a.js', line: 25 + shift }] }] },
        ],
      },
      { heading: '改版履歴', level: 2, blocks: [{ type: 'paragraph', text: '2026-09-26', evidence: 'fact', source: [] }] },
    ],
    revision: [],
  };
}

const graphOf = (runId: string, shift = 0): TraceGraph =>
  buildTraceGraph(sampleIr(shift), [sampleDoc(shift)], { runId, source: 'フォルダ: app', generatedAt: '2026-09-26T00:00:00.000Z' });

test('buildTraceGraph: フォルダ階層・ファイル・コード・文書・節と、包含・記述・呼び出し・利用の線を作る', () => {
  const g = graphOf('R1');
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const id of ['folder:.', 'folder:src', 'folder:src/app', 'file:src/app/a.js', 'code:FN-init', 'code:DI-key', 'doc:D02', 'section:D02/2. 機能 / F-001 init']) assert.ok(ids.has(id), id);
  assert.equal(g.nodes.find((n) => n.id === 'file:src/app/a.js')?.fileStatus, 'analyzed');
  assert.equal(g.nodes.find((n) => n.id === 'code:FN-init')?.parent, 'file:src/app/a.js');
  const has = (from: string, to: string, kind: string): boolean => g.edges.some((e) => e.from === from && e.to === to && e.kind === kind);
  assert.ok(has('folder:src', 'folder:src/app', 'contains'));
  assert.ok(has('file:src/app/a.js', 'code:FN-init', 'contains'));
  assert.ok(has('doc:D02', 'section:D02/2. 機能 / F-001 init', 'contains'));
  assert.ok(has('section:D02/2. 機能 / F-001 init', 'code:FN-init', 'documents'), 'irIds から');
  assert.ok(has('section:D02/2. 機能 / F-001 init', 'code:FN-save', 'documents'), 'ソース位置が定義範囲に入る');
  assert.ok(has('code:FN-init', 'code:FN-save', 'calls'));
  assert.ok(has('code:FN-save', 'code:DI-key', 'uses'));
  assert.equal(g.edges.filter((e) => e.to === 'code:unresolved').length, 0, '解決できない呼び出し先は線にしない');
  assert.equal(g.links.length, 2, '段落と表の行。改版履歴は含めない');
  assert.equal(g.links[0]?.section, '2. 機能 / F-001 init');
});

test('buildTraceGraph: 解析の追加欄 access・readsUiIds があれば uses の線をそれで作り、C/R/U/D のラベルを付ける', () => {
  const base = sampleIr();
  const ir = {
    ...base,
    functions: base.functions.map((f) => (f.id === 'FN-init' ? { ...f, readsUiIds: ['qty', 'nm'] } : f)),
    uiElements: [
      { id: 'UI-qty', source: [], screenId: 'S1', domId: 'qty', kind: 'input' as const, constraints: {} },
      { id: 'UI-nm', source: [], screenId: 'S1', name: 'nm', kind: 'input' as const, constraints: {} },
    ],
    dataItems: base.dataItems.map((d) => ({ ...d, access: [{ functionId: 'FN-init', op: 'R' }, { functionId: 'FN-init', op: 'C/U' }] })),
  } as IR;
  const g = buildTraceGraph(ir, [], { runId: 'R', generatedAt: 'x' });
  const uses = g.edges.filter((e) => e.kind === 'uses') as (TraceGraph['edges'][number] & { label?: string })[];
  assert.deepEqual(uses.find((e) => e.to === 'code:DI-key'), { from: 'code:FN-init', to: 'code:DI-key', kind: 'uses', label: 'C/R/U' });
  assert.ok(!uses.some((e) => e.from === 'code:FN-save' && e.to === 'code:DI-key'), 'access があれば位置からの推定はしない');
  assert.ok(uses.some((e) => e.from === 'code:FN-init' && e.to === 'code:UI-qty'), 'id 属性で対応');
  assert.ok(uses.some((e) => e.from === 'code:FN-init' && e.to === 'code:UI-nm'), 'name で対応');
});

test('buildTraceGraph: 行番号だけずれた再実行では link の id が変わらない。絶対パスは入れない', () => {
  const a = graphOf('R1');
  const b = graphOf('R2', 7);
  assert.deepEqual(b.links.map((l) => l.id), a.links.map((l) => l.id));
  const abs = buildTraceGraph({ ...sampleIr(), files: [{ id: 'F1', source: [], path: '/Users/x/secret/a.js', language: 'javascript', status: 'failed', lines: 0 }] }, [], { runId: 'R', generatedAt: 'x' });
  assert.ok(!JSON.stringify(abs).includes('/Users/x'));
});

test('buildTrace: 根拠の無い行・D08 の横断表・他文書が指す D09 の再掲を links から除き、件数を返す', () => {
  const p = (text: string, src: boolean, extra: object = {}) => ({ type: 'paragraph' as const, text, evidence: 'fact' as const, source: src ? [{ file: 'src/app/a.js', line: 3 }] : [], ...extra });
  const mk = (id: 'D02' | 'D08' | 'D09', heading: string, blocks: ReturnType<typeof p>[]): Document => ({ id, title: id, sections: [{ heading, level: 2, blocks }], revision: [] });
  const docs = [
    mk('D02', '2. 機能', [p('根拠あり', true), p('凡例: 事実=ソースから確定', false), p('単位不明', false, { evidence: 'unknown', d09Ref: 'D09-1' })]),
    mk('D08', '文書横断の対応表（記述→ソース位置）', [p('D02 / 根拠あり', true)]),
    mk('D08', 'ファイル別の解析結果', [p('a.js', true)]),
    mk('D09', '1. 確認事項一覧', [p('D09-1 単位', true, { d09Ref: 'D09-1' }), p('D09-2 定数', true, { d09Ref: 'D09-2' })]),
  ];
  const { graph, skippedLinks } = buildTrace(sampleIr(), docs, { runId: 'R', generatedAt: 'x' });
  assert.deepEqual(graph.links.map((l) => l.summary), ['根拠あり', '単位不明', 'a.js', 'D09-2 定数']);
  assert.equal(skippedLinks, 3);
});

test('bundleLinks: 同じ文書で irIds が同じ行は 1 件にまとめ alsoIn に他の節を並べる。D13 は導出元の ID で束ね、行が増減しても id は変わらない', () => {
  const p = (text: string, irIds: string[]) => ({ type: 'paragraph' as const, text, evidence: 'fact' as const, source: [{ file: 'src/app/a.js', line: 3 }], irIds });
  const d02: Document = {
    id: 'D02',
    title: 'D02',
    sections: [
      { heading: 'F-001', level: 2, blocks: [p('一覧', ['FN-save', 'FN-init']), p('別', ['FN-save'])] },
      { heading: 'F-001-4', level: 3, blocks: [p('境界', ['FN-init', 'FN-save'])] },
    ],
    revision: [],
  };
  const d13 = (n: number): Document => ({
    id: 'D13',
    title: 'D13',
    sections: [
      {
        heading: '2. 境界値分析',
        level: 2,
        blocks: [
          {
            type: 'table',
            columns: ['No', '導出元（D02 境界）', 'テスト値'],
            rows: Array.from({ length: n }, (_, i) => ({ cells: [`BV-${i + 1}`, 'D02 F-001-4 境界（BND-1）', String(i)], evidence: 'fact' as const, source: [{ file: 'src/app/a.js', line: 3 + i }], irIds: ['FN-init', 'BND-1'] })),
          },
        ],
      },
    ],
    revision: [],
  });
  const meta = { runId: 'R', generatedAt: 'x' };
  const g = buildTraceGraph(sampleIr(), [d02, d13(3)], meta);
  const d02Links = g.links.filter((l) => l.docId === 'D02') as (TraceGraph['links'][number] & { alsoIn?: string[] })[];
  assert.equal(d02Links.length, 2);
  assert.equal(d02Links[0]?.summary, '一覧');
  assert.equal(d02Links[0]?.section, 'F-001');
  assert.deepEqual(d02Links[0]?.alsoIn, ['F-001 / F-001-4']);
  const d13Links = g.links.filter((l) => l.docId === 'D13');
  assert.equal(d13Links.length, 1, '導出元 BND-1 ごとに 1 件');
  assert.equal(d13Links[0]?.sources.length, 3);
  const again = buildTraceGraph(sampleIr(), [d02, d13(5)], meta).links.filter((l) => l.docId === 'D13');
  assert.equal(again[0]?.id, d13Links[0]?.id, '束の行が増えても id は同じ');
});

test('carryOverReview: 同じ id・同じ内容の行だけ引き継ぎ、消えた行は捨てる', () => {
  const prev = graphOf('R1');
  const [l0, l1] = prev.links;
  assert.ok(l0 && l1);
  const review: TraceReview = {
    version: TRACE_VERSION,
    runId: 'R1',
    reviews: { [l0.id]: { status: 'ok', note: 'よい', updatedAt: 't1' }, [l1.id]: { status: 'ng', updatedAt: 't2' } },
  };
  const next = graphOf('R2', 3);
  const nextChanged: TraceGraph = { ...next, links: next.links.slice(0, 1) };
  const out = carryOverReview(prev, review, nextChanged);
  assert.equal(out.runId, 'R2');
  assert.deepEqual(out.reviews, { [l0.id]: { status: 'ok', note: 'よい', updatedAt: 't1', carriedFrom: 'R1' } });
  const contentChanged: TraceGraph = { ...next, links: next.links.map((l) => ({ ...l, evidence: 'unknown' as const })) };
  assert.deepEqual(carryOverReview(prev, review, contentChanged).reviews, {}, '内容が変わった行は引き継がない');
});

test('validateReview: 版・実行 ID・状態・メモの長さ・未知の行を拒否する', () => {
  const g = graphOf('R1');
  const id = g.links[0]?.id ?? '';
  const ok = { version: TRACE_VERSION, runId: 'R1', reviews: { [id]: { status: 'na', note: 'x', updatedAt: 't' } } };
  assert.deepEqual(validateReview(ok, g).reviews[id], { status: 'na', note: 'x', updatedAt: 't' });
  const bad: unknown[] = [
    null,
    { ...ok, version: '0' },
    { ...ok, runId: 'R9' },
    { ...ok, reviews: { [id]: { status: 'done', updatedAt: 't' } } },
    { ...ok, reviews: { [id]: { status: 'ok', note: 'あ'.repeat(2001), updatedAt: 't' } } },
    { ...ok, reviews: { unknown0000000000: { status: 'ok', updatedAt: 't' } } },
  ];
  for (const b of bad) assert.throws(() => validateReview(b, g), { name: 'InputError' }, JSON.stringify(b)?.slice(0, 80));
  assert.equal(Object.keys(validateReview({ ...ok, reviews: { [id]: { status: 'ok', note: 'あ'.repeat(2000) } } }, g).reviews).length, 1);
});

test('core: trace.json・trace-review.json・traceability.html を書き、2 回目の実行で前回の確認状態を引き継ぐ', async () => {
  const out = await mkdtemp(join(tmpdir(), 'spec2doc-trace-'));
  const input = { kind: 'folder' as const, path: FIXTURE };
  const first = await run({ input, outDir: out, docIds: ['D02', 'D03'], formats: ['md', 'trace'], runId: 'run-1' });
  const graph = JSON.parse(await readFile(join(first.outPath, 'trace.json'), 'utf8')) as TraceGraph;
  const kinds = new Set(graph.nodes.map((n) => n.kind));
  for (const k of ['folder', 'file', 'code', 'doc', 'section']) assert.ok(kinds.has(k as never), k);
  assert.ok(graph.links.length > 0);
  assert.ok(!JSON.stringify(graph).includes(FIXTURE), '絶対パスを含めない');
  await access(join(first.outPath, 'traceability.html'));
  assert.ok(first.log.outputs.includes('D02.md') && !first.log.outputs.includes('D02.trace'));
  assert.deepEqual({ ...first.log.trace, skippedLinks: 0 }, { nodes: graph.nodes.length, edges: graph.edges.length, links: graph.links.length, skippedLinks: 0 });
  assert.ok(first.log.trace.skippedLinks >= 0);
  const empty = JSON.parse(await readFile(join(first.outPath, 'trace-review.json'), 'utf8')) as TraceReview;
  assert.deepEqual(empty.reviews, {});

  const linkId = graph.links[0]?.id ?? '';
  const saved: TraceReview = { version: TRACE_VERSION, runId: 'run-1', reviews: { [linkId]: { status: 'ok', note: '確認した', updatedAt: '2026-09-26T00:00:00.000Z' } } };
  await writeFile(join(first.outPath, 'trace-review.json'), JSON.stringify(saved));

  const second = await run({ input, outDir: out, docIds: ['D02', 'D03'], formats: ['md'], runId: 'run-2' });
  const carried = JSON.parse(await readFile(join(second.outPath, 'trace-review.json'), 'utf8')) as TraceReview;
  assert.equal(carried.runId, 'run-2');
  assert.deepEqual(carried.reviews[linkId], { status: 'ok', note: '確認した', updatedAt: '2026-09-26T00:00:00.000Z', carriedFrom: 'run-1' });
  await assert.rejects(access(join(second.outPath, 'traceability.html')), 'trace を選ばなければ画面は書かない');
});
