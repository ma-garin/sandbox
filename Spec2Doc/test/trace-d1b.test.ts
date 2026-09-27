// D1b: 監査記録・ベースライン比較・書き出しの API、コメントの追記のみ、要確認の持ち越し、D09 の件数
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createWebServer } from '../src/web/server.ts';
import { countD09Rows } from '../src/core.ts';
import { carrySuspects, markSuspects } from '../src/trace/suspect.ts';
import type { Document } from '../src/doc/model.ts';
import type { TraceGraph, TraceLink, TraceReview } from '../src/trace/schema.ts';

const RUN = '20260927-010000-cur001';
const BASE = '20260926-010000-base01';
const NO_D09 = '20260927-020000-nod090';
const OLD = '20260927-030000-old000';

const link = (id: string, summary: string): TraceLink => ({
  id, docId: 'D02', section: '2. 機能 / F-001', sectionNodeId: 'section:D02/F-001', summary, evidence: 'fact', sources: [{ file: 'app.js', line: 1 }], irIds: ['FN-app.js-init'],
});
const graphOf = (runId: string, links: TraceLink[], generatedAt = '2026-09-27T01:00:00.000Z'): TraceGraph => ({
  version: '1', runId, generatedAt,
  nodes: [{ id: 'file:app.js', kind: 'file', label: 'app.js', path: 'app.js', fileStatus: 'analyzed' }, { id: 'section:D02/F-001', kind: 'section', label: 'F-001', docId: 'D02' }],
  edges: [],
  links,
});
const runLog = (runId: string, docIds: string[], extra: Record<string, unknown> = {}): unknown => ({
  runId, startedAt: '2026-09-27T01:00:00.000Z', durationMs: 10,
  settings: { docIds, formats: ['md'], exclude: [], llmEnabled: false },
  fileCounts: { total: 1, analyzed: 1, failed: 0, excluded: 0, unsupported: 0 }, outputs: [], ...extra,
});

let server: Server;
let base: string;
let outDir: string;

interface Reply { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }
function call(method: string, path: string, body?: string): Promise<Reply> {
  return new Promise((done, fail) => {
    const req = request(`${base}${path}`, { method, headers: body !== undefined ? { 'content-type': 'application/json' } : {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', fail);
    req.end(body);
  });
}
const json = (r: Reply): Record<string, unknown> => JSON.parse(r.body.toString('utf8')) as Record<string, unknown>;
const review = (reviews: TraceReview['reviews'], extra: Partial<TraceReview> = {}): string => JSON.stringify({ version: '1', runId: RUN, reviews, ...extra });
const putReview = (body: string): Promise<Reply> => call('PUT', `/api/runs/${RUN}/trace-review`, body);

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'spec2doc-d1b-'));
  for (const id of [RUN, BASE, NO_D09, OLD]) await mkdir(join(outDir, id));
  await writeFile(join(outDir, RUN, 'trace.json'), JSON.stringify(graphOf(RUN, [link('L1', 'init は起動時に呼ばれる（改）'), link('L2', '新しい行')])));
  await writeFile(join(outDir, BASE, 'trace.json'), JSON.stringify(graphOf(BASE, [link('L1', 'init は起動時に呼ばれる'), link('L0', '消えた行')])));
  await writeFile(join(outDir, RUN, 'run-log.json'), JSON.stringify(runLog(RUN, ['D02', 'D09'], { questions: 5 })));
  await writeFile(join(outDir, RUN, 'ir.json'), JSON.stringify({ unknowns: [1, 2] }));
  await writeFile(join(outDir, NO_D09, 'run-log.json'), JSON.stringify(runLog(NO_D09, ['D02'])));
  await writeFile(join(outDir, OLD, 'run-log.json'), JSON.stringify(runLog(OLD, ['D09'])));
  await writeFile(join(outDir, OLD, 'ir.json'), JSON.stringify({ unknowns: [1, 2] }));
  server = createWebServer({ outDir, runner: async () => { throw new Error('使わない'); } });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await rm(outDir, { recursive: true, force: true });
});

test('1 監査記録: PUT の差分が追記され、GET は新しい順で返す', async () => {
  // Given: 監査記録の無い実行
  assert.deepEqual(json(await call('GET', `/api/runs/${RUN}/trace-audit`)), { events: [] });
  // When: 状態を確認済みにし、次にコメントを追記して保存する
  const c1 = { at: '2026-09-27T02:00:00.000Z', text: '見た' };
  assert.equal((await putReview(review({ L1: { status: 'ok', updatedAt: '2026-09-27T02:00:00.000Z', reviewer: '藤', reviewedAt: '2026-09-27T02:00:00.000Z', comments: [c1] } }))).status, 200);
  const c2 = { at: '2026-09-27T03:00:00.000Z', text: '再確認' };
  assert.equal((await putReview(review({ L1: { status: 'ok', updatedAt: '2026-09-27T03:00:00.000Z', reviewer: '藤', reviewedAt: '2026-09-27T02:00:00.000Z', comments: [c1, c2] } }))).status, 200);
  // Then: 追記のみ（ファイルは 1 行 1 件）で、GET は最後の変更（2 件目のコメント）が先頭
  const lines = (await readFile(join(outDir, RUN, 'trace-audit.jsonl'), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 4); // status・reviewer・comment（1 回目）＋ comment（2 回目）
  const events = json(await call('GET', `/api/runs/${RUN}/trace-audit`)).events as { field: string; to?: string }[];
  assert.equal(events.length, 4);
  assert.deepEqual([events[0]?.field, events[0]?.to], ['comment', '再確認']);
  assert.ok(events.some((e) => e.field === 'status' && e.to === 'ok'));
});

test('1 監査記録: 不正な runId・パス横断・トレースの無い実行は拒否', async () => {
  // Given/When: 不正な形の runId、.. を含む指定、trace.json の無い実行
  // Then: 400 / 404（次の行動の hint 付き）
  assert.equal((await call('GET', '/api/runs/a.b/trace-audit')).status, 400);
  assert.notEqual((await call('GET', '/api/runs/%2E%2E/trace-audit')).status, 200);
  const r = await call('GET', `/api/runs/${NO_D09}/trace-audit`);
  assert.equal(r.status, 404);
  assert.ok(typeof json(r).hint === 'string');
  assert.equal((await call('POST', `/api/runs/${RUN}/trace-audit`, '{}')).status, 405);
});

test('2 ベースライン比較: 追加・削除・変更を返す', async () => {
  // Given: 基準の実行（L1 旧・L0）と今の実行（L1 改・L2）
  // When: 比較を取得する
  const r = await call('GET', `/api/runs/${RUN}/trace-compare?base=${BASE}`);
  // Then: L2 は追加、L0 は削除、L1 は変更
  assert.equal(r.status, 200);
  assert.deepEqual(json(r), { baseRunId: BASE, runId: RUN, added: ['L2'], removed: ['L0'], changed: ['L1'], unchanged: 0 });
});

test('2 ベースライン比較: base の不正は 400、存在しない base は 404（日本語と次の行動）', async () => {
  // Given/When: base 無し・形式不正・パス横断・存在しない実行
  for (const q of ['', '?base=', '?base=..%2Fx', '?base=a.b']) {
    const r = await call('GET', `/api/runs/${RUN}/trace-compare${q}`);
    // Then: 400
    assert.equal(r.status, 400, q);
    assert.match(String(json(r).message), /比較の基準/);
    assert.ok(String(json(r).hint).length > 0);
  }
  const r = await call('GET', `/api/runs/${RUN}/trace-compare?base=20990101-000000-none00`);
  assert.equal(r.status, 404);
  assert.match(String(json(r).message), /見つかりません/);
  assert.ok(String(json(r).hint).length > 0);
});

test('3 書き出し: reqif と xlsx を添付ファイルで返し、形式の不正は 400', async () => {
  // Given: トレースのある実行
  // When: reqif を書き出す
  const x = await call('GET', `/api/runs/${RUN}/trace-export?format=reqif`);
  // Then: 添付・XML
  assert.equal(x.status, 200);
  assert.match(String(x.headers['content-disposition']), /^attachment; filename="trace-20260927-010000-cur001\.reqif"$/);
  assert.match(x.body.toString('utf8'), /REQ-IF/);
  // When: xlsx を書き出す  Then: 添付・zip（PK）
  const b = await call('GET', `/api/runs/${RUN}/trace-export?format=xlsx`);
  assert.equal(b.status, 200);
  assert.match(String(b.headers['content-disposition']), /^attachment; filename=".+\.xlsx"$/);
  assert.equal(b.body.subarray(0, 2).toString('latin1'), 'PK');
  // When: 形式が不正・無い  Then: 400
  assert.equal((await call('GET', `/api/runs/${RUN}/trace-export?format=csv`)).status, 400);
  assert.equal((await call('GET', `/api/runs/${RUN}/trace-export`)).status, 400);
});

test('4 ベースライン: PUT で保存でき、存在しない実行は拒否', async () => {
  const cur = json(await call('GET', `/api/runs/${RUN}/trace-review`)) as unknown as TraceReview;
  // Given: 今の確認状態  When: 存在する実行をベースラインにして保存
  const ok = await putReview(JSON.stringify({ ...cur, baselineRunId: BASE }));
  // Then: 保存され、監査記録に baseline が残る
  assert.equal(ok.status, 200);
  assert.equal((json(await call('GET', `/api/runs/${RUN}/trace-review`)) as { baselineRunId?: string }).baselineRunId, BASE);
  const events = json(await call('GET', `/api/runs/${RUN}/trace-audit`)).events as { field: string; to?: string }[];
  assert.deepEqual([events[0]?.field, events[0]?.to], ['baseline', BASE]);
  // When: 存在しない実行をベースラインにする  Then: 400 で保存されない
  const ng = await putReview(JSON.stringify({ ...cur, baselineRunId: '20990101-000000-none00' }));
  assert.equal(ng.status, 400);
  assert.match(String(json(ng).message), /ベースライン/);
  assert.equal((json(await call('GET', `/api/runs/${RUN}/trace-review`)) as { baselineRunId?: string }).baselineRunId, BASE);
});

test('5 コメント: 保存済みの削除・書き換えは 409、追記は通る', async () => {
  const cur = json(await call('GET', `/api/runs/${RUN}/trace-review`)) as unknown as TraceReview;
  const entry = cur.reviews['L1'];
  assert.ok(entry?.comments && entry.comments.length === 2);
  const withComments = (comments: unknown[]): string => JSON.stringify({ ...cur, reviews: { ...cur.reviews, L1: { ...entry, comments } } });
  // Given: 2 件のコメントが保存済み  When: 1 件を消す／書き換える／行ごと消す
  const cases = [
    withComments([entry.comments[0]]),
    withComments([entry.comments[0], { ...entry.comments[1], text: '書き換え' }]),
    JSON.stringify({ ...cur, reviews: {} }),
  ];
  for (const body of cases) {
    const r = await putReview(body);
    // Then: 409・日本語のエラーと次の行動
    assert.equal(r.status, 409);
    assert.match(String(json(r).message), /コメント/);
    assert.ok(String(json(r).hint).length > 0);
  }
  // When: 末尾に追記する  Then: 200
  assert.equal((await putReview(withComments([...entry.comments, { at: '2026-09-27T04:00:00.000Z', text: '追記' }]))).status, 200);
});

test('6 要確認の持ち越し: 確認済みにされるまで元の since と reason のまま残る', () => {
  const prevPrev = graphOf('R0', [link('A', '旧'), link('B', 'b')], '2026-09-25T00:00:00.000Z');
  const prev = markSuspects(prevPrev, graphOf('R1', [link('A', '新'), link('B', 'b')], '2026-09-26T00:00:00.000Z'));
  assert.deepEqual(prev.links.find((l) => l.id === 'A')?.suspect, { since: 'R0', reason: 'content-changed' });
  // Given: 前回 A が要確認（since=R0）で、今回は A に変化が無い
  const cur = markSuspects(prev, graphOf('R2', [link('A', '新'), link('B', 'b')]));
  assert.equal(cur.links.find((l) => l.id === 'A')?.suspect, undefined); // 持ち越さないと消える
  const sinceAt = (id: string): string | undefined => (id === 'R0' ? '2026-09-25T00:00:00.000Z' : undefined);
  const reviewWith = (reviewedAt?: string): TraceReview => ({ version: '1', runId: 'R2', reviews: { A: { status: 'ok', updatedAt: 'x', ...(reviewedAt ? { reviewedAt } : {}) } } });
  // When: 確認日時が無い／since より古い  Then: 元の since・reason で持ち越す
  for (const r of [reviewWith(), reviewWith('2026-09-24T00:00:00.000Z')]) {
    const out = carrySuspects(prev, cur, r, sinceAt);
    assert.deepEqual(out.links.find((l) => l.id === 'A')?.suspect, { since: 'R0', reason: 'content-changed' });
    assert.equal(out.links.find((l) => l.id === 'B')?.suspect, undefined);
  }
  // When: since より新しく確認済みにされた  Then: 持ち越さない
  assert.equal(carrySuspects(prev, cur, reviewWith('2026-09-26T12:00:00.000Z'), sinceAt).links.find((l) => l.id === 'A')?.suspect, undefined);
  // When: since の実行の日時が分からない  Then: 安全側で持ち越す
  assert.ok(carrySuspects(prev, cur, reviewWith('2026-09-26T12:00:00.000Z'), () => undefined).links.find((l) => l.id === 'A')?.suspect);
  // When: 前回が無い  Then: 変えない
  assert.equal(carrySuspects(undefined, cur, reviewWith(), sinceAt), cur);
});

test('7 D09 の件数: 生成した D09 の一覧表の行数で数え、D09 が無ければ null', async () => {
  // Given: 一覧表 2 行＋検証で足した 1 行の D09、0 件（段落）の D09、D09 無し
  const row = (no: string) => ({ cells: [no, 'x'], evidence: 'unknown' as const });
  const d09 = { id: 'D09', title: 'D09', revision: [], sections: [
    { heading: '1', level: 2, blocks: [{ type: 'table', columns: ['No.', '事項'], rows: [row('Q-001'), row('Q-002'), row('Q-003')] }, { type: 'table', columns: ['版', '日付'], rows: [row('1')] }] },
  ] } as unknown as Document;
  const empty = { id: 'D09', title: 'D09', revision: [], sections: [{ heading: '1', level: 2, blocks: [{ type: 'paragraph', text: 'なし', evidence: 'fact' }] }] } as unknown as Document;
  // When/Then: 行数、0、null
  assert.equal(countD09Rows([d09]), 3);
  assert.equal(countD09Rows([empty]), 0);
  assert.equal(countD09Rows([]), null);
  // When: 実行の結果を取得する  Then: run-log の questions（ir.json の unknowns=2 ではなく 5）
  assert.equal(json(await call('GET', `/api/runs/${RUN}`)).questions, 5);
  // D09 を生成しなかった実行は null
  assert.equal(json(await call('GET', `/api/runs/${NO_D09}`)).questions, null);
  // questions を持たない古い実行は ir.json の unknowns で代える
  assert.equal(json(await call('GET', `/api/runs/${OLD}`)).questions, 2);
});
