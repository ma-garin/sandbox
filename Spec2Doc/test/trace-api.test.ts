// トレーサビリティの画面の配信（/trace/<runId>）と確認状態の保存 API（/api/runs/<runId>/trace-review）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createWebServer, injectTraceApi, traceCsp } from '../src/web/server.ts';

let server: Server;
let base: string;
let outDir: string;
const RUN_ID = '20260926-000000-trace1';
const PAGE_SCRIPT = 'document.body.dataset.ready="1";';

const graph = {
  version: '1',
  runId: RUN_ID,
  generatedAt: '2026-09-26T00:00:00.000Z',
  nodes: [
    { id: 'file:app.js', kind: 'file', label: 'app.js', path: 'app.js', fileStatus: 'analyzed' },
    { id: 'code:FN-app.js-init', kind: 'code', label: 'init', parent: 'file:app.js', codeKind: 'function', line: 1 },
    { id: 'doc:D02', kind: 'doc', label: 'D02', docId: 'D02' },
    { id: 'section:D02/F-001', kind: 'section', label: 'F-001 init', parent: 'doc:D02', docId: 'D02' },
  ],
  edges: [{ from: 'section:D02/F-001', to: 'code:FN-app.js-init', kind: 'documents' }],
  links: [
    {
      id: 'L1',
      docId: 'D02',
      section: '2. 機能ごとの仕様 / F-001 init',
      sectionNodeId: 'section:D02/F-001',
      summary: 'init は起動時に呼ばれる',
      evidence: 'fact',
      sources: [{ file: 'app.js', line: 1 }],
      irIds: ['FN-app.js-init'],
    },
  ],
};

const reviewUrl = (runId = RUN_ID): string => `${base}/api/runs/${runId}/trace-review`;
const sha = (s: string): string => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function put(body: string, headers: Record<string, string> = {}, runId = RUN_ID): Promise<{ status: number; json: { message?: string; hint?: string } }> {
  return new Promise((done, fail) => {
    const req = request(reviewUrl(runId), { method: 'PUT', headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (text += c));
      res.on('end', () => done({ status: res.statusCode ?? 0, json: text ? (JSON.parse(text) as { message?: string }) : {} }));
    });
    req.on('error', fail);
    req.end(body);
  });
}

const validReview = (status: string, note?: string): string =>
  JSON.stringify({ version: '1', runId: RUN_ID, reviews: { L1: { status, updatedAt: '2026-09-26T01:00:00.000Z', ...(note ? { note } : {}) } } });

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'spec2doc-trace-test-'));
  await mkdir(join(outDir, RUN_ID));
  await writeFile(join(outDir, RUN_ID, 'trace.json'), JSON.stringify(graph));
  await writeFile(
    join(outDir, RUN_ID, 'traceability.html'),
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>t</title></head><body><script>${PAGE_SCRIPT}</script></body></html>`,
  );
  server = createWebServer({ outDir, runner: async () => { throw new Error('使わない'); } });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await rm(outDir, { recursive: true, force: true });
});

test('GET /trace/<runId> はトップレベルのページとして 200、API の場所を差し込み、両方の script の hash だけを許す', async () => {
  const res = await fetch(`${base}/trace/${RUN_ID}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  const injected = `window.SPEC2DOC_TRACE_API="/api/runs/${RUN_ID}/trace-review"`;
  assert.ok(html.includes(`<head><script>${injected}</script>`), 'head の先頭に差し込む');
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.doesNotMatch(csp, /sandbox/);
  assert.ok(csp.includes(sha(injected)), '差し込んだ script の hash');
  assert.ok(csp.includes(sha(PAGE_SCRIPT)), '文書内の script の hash');
  for (const d of ["default-src 'none'", "style-src 'unsafe-inline'", 'img-src data:', "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.doesNotMatch(csp, /script-src[^;]*unsafe/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('traceCsp は src 付きの script を hash に数えず、head が無ければ先頭に差し込む', () => {
  assert.match(traceCsp('<script src="/x.js"></script>'), /script-src 'none'/);
  assert.match(injectTraceApi('<p>x</p>', 'abc'), /^<script>window\.SPEC2DOC_TRACE_API="\/api\/runs\/abc\/trace-review"<\/script><p>x<\/p>$/);
});

test('/trace の out/ 外・不正な runId は 400、無い実行は 404', async () => {
  for (const p of ['/trace/..%2F..%2Fetc', '/trace/a%2F..%2Fb', `/trace/${RUN_ID}/x`, '/trace/%E0%A4%A']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 400, p);
    await res.body?.cancel();
  }
  const res = await fetch(`${base}/trace/no-such-run`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { hint: string };
  assert.match(body.hint, /トレーサビリティ/);
});

test('確認状態: 保存前は空の reviews、PUT したものが GET で戻り、一時ファイルは残らない', async () => {
  const empty = await fetch(reviewUrl());
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { version: '1', runId: RUN_ID, reviews: {} });

  const saved = await put(validReview('ok', '仕様どおり'));
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const got = (await (await fetch(reviewUrl())).json()) as { runId: string; reviews: Record<string, { status: string; note?: string }> };
  assert.equal(got.runId, RUN_ID);
  assert.equal(got.reviews['L1']?.status, 'ok');
  assert.equal(got.reviews['L1']?.note, '仕様どおり');
  assert.deepEqual((await readdir(join(outDir, RUN_ID))).filter((n) => n.endsWith('.tmp')), []);
});

test('確認状態: 不正な status・壊れた JSON・JSON 以外は 400 で原因と次の行動を返し、保存済みを壊さない', async () => {
  const cases: [string, string, Record<string, string>][] = [
    ['不正な status', validReview('done'), {}],
    ['壊れた JSON', '{"version":', {}],
    ['別の実行 ID', JSON.stringify({ version: '1', runId: 'other-run', reviews: {} }), {}],
    ['JSON 以外', validReview('ok'), { 'content-type': 'text/plain' }],
  ];
  for (const [name, body, headers] of cases) {
    const r = await put(body, headers);
    assert.equal(r.status, 400, name);
    assert.ok(r.json.message && r.json.hint, `${name}: 原因と次の行動`);
  }
  const got = (await (await fetch(reviewUrl())).json()) as { reviews: Record<string, { status: string }> };
  assert.equal(got.reviews['L1']?.status, 'ok');
});

test('確認状態: 1 MB を超える本文は 413', async () => {
  const r = await put(validReview('ok', 'x'.repeat(1024 * 1024 + 10)));
  assert.equal(r.status, 413);
  assert.match(r.json.message ?? '', /1 MB/);
});

test('確認状態: 他オリジン・他ホストからの PUT は 403、`..` を含む runId は 400', async () => {
  assert.equal((await put(validReview('ng'), { origin: 'http://evil.example' })).status, 403);
  assert.equal((await put(validReview('ng'), { host: 'evil.example' })).status, 403);
  assert.equal((await put(validReview('ng'), {}, '..%2F..%2Fetc')).status, 400);
  assert.equal((await put(validReview('ng'), {}, `${RUN_ID}%2F..`)).status, 400);
  const got = (await (await fetch(reviewUrl())).json()) as { reviews: Record<string, { status: string }> };
  assert.equal(got.reviews['L1']?.status, 'ok', '拒否した送信は保存しない');
});
