// トレーサビリティ D1a: リンクの種類・要確認（suspect）・トレース先の候補・ベースライン比較・監査・ReqIF / Excel の書き出し
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { linkKindOf } from '../src/trace/kind.ts';
import { markSuspects, withFileHashes } from '../src/trace/suspect.ts';
import { addCandidates } from '../src/trace/candidates.ts';
import { compareTrace } from '../src/trace/compare.ts';
import { AUDIT_FILE, RUN_SCOPE, appendAudit, diffReviewToAudit } from '../src/trace/audit.ts';
import { carryOverReview, validateReview } from '../src/trace/review.ts';
import { toReqIF } from '../src/trace/export-reqif.ts';
import { toMatrixXlsx } from '../src/trace/export-xlsx.ts';
import { TRACE_VERSION, type TraceEdge, type TraceGraph, type TraceLink, type TraceNode, type TraceReview } from '../src/trace/schema.ts';

const NODES: TraceNode[] = [
  { id: 'folder:.', kind: 'folder', label: 'app', path: '.' },
  { id: 'folder:src', kind: 'folder', label: 'src', path: 'src', parent: 'folder:.' },
  { id: 'file:src/a.js', kind: 'file', label: 'a.js', path: 'src/a.js', parent: 'folder:src', fileStatus: 'analyzed' },
  { id: 'file:src/b.js', kind: 'file', label: 'b.js', path: 'src/b.js', parent: 'folder:src', fileStatus: 'analyzed' },
  { id: 'code:FN-init', kind: 'code', label: 'init', codeKind: 'function', parent: 'file:src/a.js', line: 1 },
  { id: 'code:FN-save', kind: 'code', label: 'saveData', codeKind: 'function', parent: 'file:src/a.js', line: 20 },
  { id: 'code:FN-load', kind: 'code', label: 'loadAll', codeKind: 'function', parent: 'file:src/b.js', line: 1 },
  { id: 'doc:D02', kind: 'doc', label: 'D02 要求仕様書', docId: 'D02' },
  { id: 'section:D02/F1', kind: 'section', label: 'F-001 init', parent: 'doc:D02', docId: 'D02' },
  { id: 'section:D02/F2', kind: 'section', label: 'F-002 saveData 保存', parent: 'doc:D02', docId: 'D02' },
];
const EDGES: TraceEdge[] = [
  { from: 'section:D02/F1', to: 'code:FN-init', kind: 'documents' },
  { from: 'code:FN-init', to: 'code:FN-save', kind: 'calls' },
];

function link(id: string, over: Partial<TraceLink> = {}): TraceLink {
  return { id, docId: 'D02', section: '2. 機能 / F-001 init', sectionNodeId: 'section:D02/F1', summary: `行 ${id}`, evidence: 'fact', sources: [{ file: 'src/a.js', line: 3 }], irIds: ['FN-init'], kind: 'satisfies', ...over };
}

function graph(runId: string, links: TraceLink[], hashes: Record<string, string> = {}): TraceGraph {
  const g: TraceGraph = { version: TRACE_VERSION, runId, generatedAt: '2026-09-27T00:00:00.000Z', nodes: NODES, edges: EDGES, links };
  return withFileHashes(g, new Map(Object.entries(hashes)));
}

const review = (runId: string, reviews: TraceReview['reviews'] = {}, extra: Partial<TraceReview> = {}): TraceReview => ({ version: TRACE_VERSION, runId, reviews, ...extra });

test('linkKindOf: D02 の機能の節=satisfies、D13=verifies、D07 の影響分析=derives、それ以外=describes', () => {
  assert.equal(linkKindOf({ docId: 'D02', section: '2. 機能ごとの仕様 / F-001 init' }), 'satisfies');
  assert.equal(linkKindOf({ docId: 'D02', section: '3. 非機能要件' }), 'describes');
  assert.equal(linkKindOf({ docId: 'D13', section: '1. テスト観点' }), 'verifies');
  assert.equal(linkKindOf({ docId: 'D07', section: '4. 変更影響分析' }), 'derives');
  assert.equal(linkKindOf({ docId: 'D07', section: '1. 未参照の関数' }), 'describes');
  assert.equal(linkKindOf({ docId: 'D12', section: '2. 関数 / init' }), 'describes');
});

test('markSuspects: 根拠ソースの変更・記述の変更・新しい対応を 3 種に分け、初回は付けない', () => {
  const prev = graph('R1', [link('L1'), link('L2'), link('L3', { sources: [{ file: 'src/b.js', line: 1 }] })], { 'src/a.js': 'h1', 'src/b.js': 'hb' });
  const cur = graph('R2', [link('L1', { sources: [{ file: 'src/a.js', line: 9 }] }), link('L2', { summary: '行 L2 を書き換えた' }), link('L3', { sources: [{ file: 'src/b.js', line: 5 }] }), link('L4')], { 'src/a.js': 'h2', 'src/b.js': 'hb' });
  const marked = markSuspects(prev, cur);
  const by = new Map(marked.links.map((l) => [l.id, l.suspect] as const));
  assert.deepEqual(by.get('L1'), { since: 'R1', reason: 'source-changed' }, '位置がずれただけでもファイルの内容が変われば要確認');
  assert.deepEqual(by.get('L2'), { since: 'R1', reason: 'content-changed' });
  assert.equal(by.get('L3'), undefined, 'ファイルの内容も記述も同じなら付けない');
  assert.deepEqual(by.get('L4'), { since: 'R1', reason: 'new' });
  assert.equal(markSuspects(undefined, cur).links.some((l) => l.suspect), false, '前回が無い初回は付けない');
  assert.equal(cur.links[1]?.suspect, undefined, '元のグラフを変えない');
});

test('carryOverReview(keepChanged): 要確認の行も確認状態・確認者・コメントを残し、既定では内容が変わった行を捨てる', () => {
  const prev = graph('R1', [link('L1'), link('L2')]);
  const cur = graph('R2', [link('L1'), link('L2', { summary: '変わった' })]);
  const entry = { status: 'ok' as const, updatedAt: 't', reviewer: '山田', reviewedAt: 't', comments: [{ at: 't', text: 'c' }] };
  const r = review('R1', { L1: entry, L2: entry }, { baselineRunId: 'R0', savedViews: [{ name: 'v', tab: 'matrix', filters: { doc: 'D02' } }] });
  const kept = carryOverReview(prev, r, cur, { keepChanged: true });
  assert.deepEqual(kept.reviews.L2, { ...entry, carriedFrom: 'R1' });
  assert.equal(kept.baselineRunId, 'R0');
  assert.equal(kept.savedViews?.[0]?.name, 'v');
  assert.equal(carryOverReview(prev, r, cur).reviews.L2, undefined);
});

test('addCandidates: 抜けのコード要素・ファイルと孤立した行に、根拠付きの候補を score 順に最大 3 件付ける', () => {
  const g = graph('R1', [link('L1'), link('L2', { sectionNodeId: 'section:D02/F2', section: 'F-002' }), link('L3', { sectionNodeId: 'section:D02/F2', section: 'F-002', summary: 'loadAll で読み込む', sources: [], irIds: [] })]);
  const out = addCandidates(g);
  const save = out.gapCandidates?.['code:FN-save'] ?? [];
  assert.deepEqual(save.map((c) => [c.nodeId, c.score]), [['section:D02/F2', 0.9], ['section:D02/F1', 0.7]]);
  assert.match(save[0]?.why ?? '', /saveData/);
  assert.match(save[1]?.why ?? '', /呼び出し関係/);
  const fileB = out.gapCandidates?.['file:src/b.js'] ?? [];
  assert.ok(fileB.length > 0 && fileB.every((c) => /同じフォルダ/.test(c.why)), 'どの節からも根拠にされないファイル');
  assert.equal(out.gapCandidates?.['code:FN-init'], undefined, '記述済みの要素は抜けではない');
  const orphan = out.links.find((l) => l.id === 'L3')?.candidates ?? [];
  assert.equal(orphan[0]?.nodeId, 'code:FN-load');
  assert.ok(orphan.some((c) => c.nodeId === 'file:src/a.js'), '同じ節の他の行の根拠ファイル');
  assert.ok(orphan.length <= 3);
  assert.equal(out.links.find((l) => l.id === 'L1')?.candidates, undefined, '根拠のある行には付けない');
});

test('compareTrace: 追加・削除・変更（記述またはソースの内容）・変化なしに分ける', () => {
  const base = graph('R1', [link('L1'), link('L2'), link('L5')], { 'src/a.js': 'h1' });
  const cur = graph('R2', [link('L1'), link('L2', { summary: '変わった' }), link('L4')], { 'src/a.js': 'h1' });
  assert.deepEqual(compareTrace(base, cur), { baseRunId: 'R1', runId: 'R2', added: ['L4'], removed: ['L5'], changed: ['L2'], unchanged: 1 });
  const touched = graph('R3', [link('L1')], { 'src/a.js': 'h9' });
  assert.deepEqual(compareTrace(base, touched).changed, ['L1']);
});

test('diffReviewToAudit と appendAudit: 変化を 1 件ずつ記録し、ファイルには追記だけする', async () => {
  const prev = review('R1', { L1: { status: 'unreviewed', updatedAt: 't', comments: [{ at: 't', text: '既存' }] } });
  const next = review(
    'R1',
    { L1: { status: 'ok', note: 'メモ', updatedAt: 't2', reviewer: '山田', reviewedAt: 't2', comments: [{ at: 't', text: '既存' }, { at: 't2', text: '追加', by: '佐藤' }] } },
    { baselineRunId: 'R0', savedViews: [{ name: '未確認だけ', tab: 'manage', filters: { status: 'unreviewed' } }] },
  );
  const events = diffReviewToAudit(prev, next, 'R1', '山田', '2026-09-27T00:00:00.000Z');
  assert.deepEqual(events.map((e) => e.field).sort(), ['baseline', 'comment', 'note', 'reviewer', 'savedView', 'status']);
  assert.deepEqual(events.find((e) => e.field === 'status'), { at: '2026-09-27T00:00:00.000Z', runId: 'R1', linkId: 'L1', field: 'status', from: 'unreviewed', to: 'ok', by: '山田' });
  assert.deepEqual(events.find((e) => e.field === 'comment')?.to, '追加', '既存のコメントは記録しない');
  assert.equal(events.find((e) => e.field === 'comment')?.by, '佐藤');
  assert.equal(events.find((e) => e.field === 'baseline')?.linkId, RUN_SCOPE);
  assert.deepEqual(diffReviewToAudit(next, next, 'R1'), [], '変化が無ければ空');
  const dir = await mkdtemp(join(tmpdir(), 'spec2doc-audit-'));
  await appendAudit(dir, events.slice(0, 2));
  await appendAudit(dir, events.slice(2));
  await appendAudit(dir, []);
  const lines = (await readFile(join(dir, AUDIT_FILE), 'utf8')).trimEnd().split('\n');
  assert.equal(lines.length, events.length);
  assert.deepEqual(lines.map((l) => JSON.parse(l) as unknown), events, '先に書いた行を残して後ろに足す');
});

test('validateReview: 確認者・コメント・保存した絞り込み・ベースラインの形と上限を検査する', () => {
  const g = graph('R1', [link('L1')]);
  const ok = { version: TRACE_VERSION, runId: 'R1', reviews: { L1: { status: 'ok', updatedAt: 't', reviewer: '山田', reviewedAt: 't', comments: [{ at: 't', text: 'c', by: '佐藤' }] } }, baselineRunId: 'run-0', savedViews: [{ name: 'v', tab: 'gaps', filters: { a: 'b' } }] };
  const v = validateReview(ok, g);
  assert.equal(v.reviews.L1?.reviewer, '山田');
  assert.equal(v.reviews.L1?.comments?.[0]?.by, '佐藤');
  assert.equal(v.baselineRunId, 'run-0');
  assert.equal(v.savedViews?.length, 1);
  const bad = (patch: (x: typeof ok) => unknown, re: RegExp): void => assert.throws(() => validateReview(patch(structuredClone(ok)), g), re);
  bad((x) => ({ ...x, reviews: { L1: { ...x.reviews.L1, reviewer: 'あ'.repeat(101) } } }), /確認者が長すぎます/);
  bad((x) => ({ ...x, reviews: { L1: { ...x.reviews.L1, comments: [{ at: 't', text: 'x'.repeat(2001) }] } } }), /コメントが長すぎます/);
  bad((x) => ({ ...x, reviews: { L1: { ...x.reviews.L1, comments: Array.from({ length: 201 }, () => ({ at: 't', text: 'c' })) } } }), /コメントが多すぎます/);
  bad((x) => ({ ...x, savedViews: Array.from({ length: 21 }, (_, i) => ({ name: `v${i}`, tab: 'graph', filters: {} })) }), /多すぎます/);
  bad((x) => ({ ...x, savedViews: [{ name: 'v', tab: 'nope', filters: {} }] }), /画面が不正/);
  bad((x) => ({ ...x, baselineRunId: '../etc' }), /ベースライン/);
});

/** 簡易の XML パーサ: 開始・終了タグの対応、属性値と本文のエスケープ、参照先の IDENTIFIER の存在を確かめる */
function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^?]*\?>\s*/, '');
  const re = /<(\/?)([A-Za-z][\w.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/y;
  const badAmp = /&(?!(?:amp|lt|gt|quot|apos|#\d+);)/;
  const stack: string[] = [];
  let pos = 0;
  while (pos < body.length) {
    re.lastIndex = pos;
    const m = re.exec(body);
    assert.ok(m, `構文が崩れている: ${body.slice(pos, pos + 60)}`);
    pos = re.lastIndex;
    if (m[5] !== undefined) {
      assert.ok(!badAmp.test(m[5]), `本文の & が未エスケープ: ${m[5].slice(0, 40)}`);
      continue;
    }
    assert.ok(!badAmp.test(m[3] ?? ''), '属性値の & が未エスケープ');
    if (m[1]) assert.equal(stack.pop(), m[2]);
    else if (!m[4]) stack.push(m[2] ?? '');
  }
  assert.deepEqual(stack, []);
  const ids = new Set([...xml.matchAll(/IDENTIFIER="([^"]+)"/g)].map((x) => x[1]));
  for (const ref of xml.matchAll(/<[A-Z-]+-REF>([^<]+)<\/[A-Z-]+-REF>/g)) assert.ok(ids.has(ref[1]), `参照先が無い: ${ref[1]}`);
}

test('toReqIF: ReqIF 1.2 の最小構成を well-formed に書き、値をエスケープする', () => {
  const g = graph('R1', [link('L1', { summary: `a<b & "c" 'd' >e\u0001` }), link('L2', { kind: 'verifies', docId: 'D13', sources: [{ file: 'src/b.js' }] })]);
  const xml = toReqIF(g, review('R1', { L1: { status: 'ok', updatedAt: 't', reviewer: 'A&B <x>', reviewedAt: '2026-09-27' } }));
  assertWellFormed(xml);
  assert.ok(xml.includes('a&lt;b &amp; &quot;c&quot; &apos;d&apos; &gt;e"'), '記述のエスケープと制御文字の除去');
  assert.ok(xml.includes('THE-VALUE="A&amp;B &lt;x&gt;"'), '確認者');
  assert.ok(xml.includes('THE-VALUE="確認済み"'));
  for (const tag of ['SPEC-OBJECT-TYPE', 'SPEC-RELATION-TYPE', 'SPEC-OBJECTS', 'SPEC-RELATIONS', 'SPECIFICATION']) assert.ok(xml.includes(`<${tag} `) || xml.includes(`<${tag}>`), tag);
  assert.equal((xml.match(/<SPEC-RELATION-TYPE /g) ?? []).length, 6, 'LINK_KIND ごと');
  assert.ok(xml.includes('<SPEC-RELATION-TYPE-REF>SRT-verifies</SPEC-RELATION-TYPE-REF>'));
  assert.equal((xml.match(/<SPEC-RELATION /g) ?? []).length, 4, 'L1→init・a.js、L2→init・b.js');
});

test('toMatrixXlsx: マトリクス（件数と判定済み割合）と対応一覧の 2 シートの xlsx を返す', async () => {
  const g = graph('R1', [link('L1'), link('L2', { suspect: { since: 'R0', reason: 'new' } })]);
  const buf = await toMatrixXlsx(g, review('R1', { L1: { status: 'ok', updatedAt: 't', reviewer: '山田' } }));
  assert.equal(buf.subarray(0, 2).toString('latin1'), 'PK');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['マトリクス', '対応一覧']);
  const m = wb.getWorksheet('マトリクス');
  assert.equal(m?.getRow(1).getCell(3).value, 'src/a.js');
  assert.equal(m?.getRow(2).getCell(3).value, '2（判定済み 50%）');
  const list = wb.getWorksheet('対応一覧');
  assert.equal(list?.getRow(2).getCell(6).value, '山田');
  assert.equal(list?.getRow(3).getCell(8).value, '前回の実行に無かった対応');
});

test('core: file ノードに内容ハッシュを持たせ、2 回目の実行でソースが変わった対応を要確認にし、確認状態は残す', async () => {
  const { cp, appendFile, writeFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const { run } = await import('../src/core.ts');
  const work = await mkdtemp(join(tmpdir(), 'spec2doc-d1a-'));
  const src = join(work, 'app');
  await cp(resolve(import.meta.dirname, '../fixtures/sample-app'), src, { recursive: true });
  const out = join(work, 'out');
  const input = { kind: 'folder' as const, path: src };
  const first = await run({ input, outDir: out, docIds: ['D02', 'D13'], formats: ['md'], runId: 'run-a' });
  const g1 = JSON.parse(await readFile(join(first.outPath, 'trace.json'), 'utf8')) as TraceGraph & { gapCandidates?: unknown };
  assert.ok(g1.nodes.some((n) => n.kind === 'file' && typeof (n as { hash?: unknown }).hash === 'string'), 'file ノードの hash');
  assert.equal(g1.links.some((l) => l.suspect), false, '初回は要確認を付けない');
  assert.ok(g1.links.some((l) => l.kind === 'satisfies') && g1.links.some((l) => l.kind === 'verifies'));
  assert.equal(typeof g1.gapCandidates, 'object');
  const target = g1.links.find((l) => l.sources.length > 0);
  assert.ok(target);
  const file = target.sources[0]?.file ?? '';
  await writeFile(join(first.outPath, 'trace-review.json'), JSON.stringify(review('run-a', { [target.id]: { status: 'ok', updatedAt: 't', reviewer: '山田' } })));
  await appendFile(join(src, file), '\n// 変更\n');
  const second = await run({ input, outDir: out, docIds: ['D02', 'D13'], formats: ['md'], runId: 'run-b' });
  const g2 = JSON.parse(await readFile(join(second.outPath, 'trace.json'), 'utf8')) as TraceGraph;
  const r2 = JSON.parse(await readFile(join(second.outPath, 'trace-review.json'), 'utf8')) as TraceReview;
  const same = g2.links.find((l) => l.id === target.id);
  assert.ok(same?.suspect, '根拠のファイルが変わった対応は要確認');
  assert.equal(same.suspect.since, 'run-a');
  assert.ok(g2.links.some((l) => l.suspect?.reason === 'source-changed'));
  assert.equal(g2.links.filter((l) => !l.sources.some((s) => s.file === file)).some((l) => l.suspect?.reason === 'source-changed'), false, '変えていないファイルだけの対応は付けない');
  assert.equal(r2.reviews[target.id]?.status, 'ok', '要確認でも確認状態は残す');
  assert.equal(r2.reviews[target.id]?.reviewer, '山田');
});
