// 実行の履歴 API（GET /api/runs・GET /api/runs/<runId>）: 新しい順・件数・壊れた記録の除外・1 件取得が実行直後の結果と同じ形
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createWebServer, type RunSummary, type Runner } from '../src/web/server.ts';
import type { RunResult } from '../src/core.ts';

let server: Server;
let base: string;
let outDir: string;

const OLD = '20260101-000000-aaaaaa';
const MID = '20260102-000000-bbbbbb';
const NEW = '20260103-000000-cccccc';
const LIVE = '20250101-000000-live01';

function makeLog(runId: string, startedAt: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    runId,
    input: { kind: 'folder', label: '/Users/someone/secret/app' },
    settings: { docIds: ['D01', 'D02'], formats: ['md', 'html'], exclude: [], llmEnabled: false },
    startedAt,
    finishedAt: startedAt,
    durationMs: 1234,
    stageMs: {},
    fileCounts: { total: 10, analyzed: 8, failed: 1, excluded: 1, unsupported: 0 },
    llm: { inputTokens: 0, outputTokens: 0, requests: 0, sentFiles: [] },
    outputs: ['D01.md', 'D01.html', 'D02.md', 'D02.html', 'ir.json', 'run-log.json'],
    sourceKey: 'フォルダ: app',
    sectionDigests: {},
    docVersions: {},
    docChanges: {},
    trace: { nodes: 0, edges: 0, links: 0, skippedLinks: 0 },
    ...extra,
  };
}

async function putRun(runId: string, content: string | undefined): Promise<void> {
  await mkdir(join(outDir, runId), { recursive: true });
  if (content !== undefined) await writeFile(join(outDir, runId, 'run-log.json'), content);
}

const graph = {
  version: '1',
  runId: LIVE,
  generatedAt: '2025-01-01T00:00:00.000Z',
  nodes: [{ id: 'doc:D01', kind: 'doc', label: 'D01', docId: 'D01' }],
  edges: [],
  links: [{ id: 'L1', docId: 'D01', section: 's', sectionNodeId: 'doc:D01', summary: 'x', evidence: 'fact', sources: [], irIds: [] }],
};

/** 実行直後の結果と 1 件取得を比べるため、実際と同じく run-log.json を書いてから結果を返す */
const writingRunner: Runner = async (options, onProgress) => {
  const log = makeLog(LIVE, '2025-01-01T00:00:00.000Z', {
    settings: { docIds: options.docIds, formats: options.formats, exclude: [], llmEnabled: false },
    outputs: ['D01.md', 'D01.html', 'ir.json', 'run-log.json', 'traceability.html'],
    docChanges: { D01: [{ section: '1. 概要', kind: 'changed' }, { section: '2. 構成', kind: 'moved' }] },
  });
  await putRun(LIVE, JSON.stringify(log));
  await writeFile(join(outDir, LIVE, 'traceability.html'), '<!doctype html><html><head></head><body></body></html>');
  await writeFile(join(outDir, LIVE, 'trace.json'), JSON.stringify(graph));
  onProgress({ stage: 'done', message: '完了しました', ratio: 1 });
  return { runId: LIVE, outPath: join(outDir, LIVE), ir: {}, hasFailures: true, log } as unknown as RunResult;
};

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'spec2doc-runs-test-'));
  await putRun(OLD, JSON.stringify(makeLog(OLD, '2026-01-01T00:00:00.000Z')));
  await putRun(NEW, JSON.stringify(makeLog(NEW, '2026-01-03T00:00:00.000Z', { docChanges: { D01: [{ section: 'a', kind: 'changed' }], D02: [{ section: 'b', kind: 'moved' }] } })));
  await putRun(MID, JSON.stringify(makeLog(MID, '2026-01-02T00:00:00.000Z')));
  await writeFile(join(outDir, MID, 'traceability.html'), '<p>t</p>');
  // 壊れた・欠けた記録
  await putRun('20260104-000000-broken', '{ not json');
  await putRun('20260105-000000-nolog', undefined);
  await putRun('20260106-000000-mismatch', JSON.stringify(makeLog('other-id', '2026-01-06T00:00:00.000Z')));
  await putRun('20260107-000000-nocount', JSON.stringify(makeLog('20260107-000000-nocount', '2026-01-07T00:00:00.000Z', { fileCounts: undefined })));
  server = createWebServer({ outDir, runner: writingRunner });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await rm(outDir, { recursive: true, force: true });
});

async function getRuns(query = ''): Promise<{ status: number; runs: RunSummary[]; body: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/runs${query}`);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, runs: (body['runs'] as RunSummary[] | undefined) ?? [], body };
}

test('一覧は新しい順で、壊れた・欠けた run-log は外して理由をサーバのログにだけ出す', async (t) => {
  const errors: string[] = [];
  t.mock.method(console, 'error', (msg: unknown) => void errors.push(String(msg)));
  const { status, runs, body } = await getRuns();
  assert.equal(status, 200);
  assert.deepEqual(runs.map((r) => r.runId), [NEW, MID, OLD]);
  assert.equal(errors.length, 4);
  for (const id of ['broken', 'nolog', 'mismatch', 'nocount']) assert.ok(errors.some((e) => e.includes(id)), id);
  assert.doesNotMatch(JSON.stringify(body), /broken|nolog|mismatch|nocount/);
});

test('一覧の 1 件は契約どおりの項目を持ち、絶対パスを出さない', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { runs } = await getRuns();
  const [newest, mid] = runs;
  assert.deepEqual(newest, {
    runId: NEW,
    startedAt: '2026-01-03T00:00:00.000Z',
    source: 'フォルダ: app',
    fileCount: 10,
    analyzed: 8,
    failed: 1,
    excluded: 1,
    docs: ['D01', 'D02'],
    formats: ['md', 'html'],
    durationMs: 1234,
    hasTrace: false,
    changedDocs: 1, // D02 は位置のみ変更なので数えない
  });
  assert.equal(mid?.hasTrace, true);
  assert.equal(mid?.traceUrl, `/trace/${MID}`);
  assert.equal(mid?.changedDocs, 0);
  assert.doesNotMatch(JSON.stringify(runs), /\/Users\//);
});

test('limit で件数を絞り、1〜200 の整数以外は 400', async (t) => {
  t.mock.method(console, 'error', () => {});
  const two = await getRuns('?limit=2');
  assert.equal(two.status, 200);
  assert.deepEqual(two.runs.map((r) => r.runId), [NEW, MID]);
  assert.equal((await getRuns('?limit=1')).runs.length, 1);
  assert.equal((await getRuns('?limit=200')).status, 200);
  for (const q of ['?limit=0', '?limit=201', '?limit=-1', '?limit=abc', '?limit=1.5', '?limit=']) {
    const r = await getRuns(q);
    assert.equal(r.status, 400, q);
    assert.equal(typeof r.body['message'], 'string');
    assert.equal(typeof r.body['hint'], 'string');
  }
});

test('不正な runId は 400、無い・壊れた実行は 404（原因と次の行動を返す）', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const p of ['bad.id', 'a..b', 'a%2Fb', 'x'.repeat(81)]) {
    const res = await fetch(`${base}/api/runs/${p}`);
    assert.equal(res.status, 400, p);
  }
  for (const id of ['20991231-000000-none00', '20260104-000000-broken', '20260105-000000-nolog']) {
    const res = await fetch(`${base}/api/runs/${id}`);
    assert.equal(res.status, 404, id);
    const body = (await res.json()) as { message?: string; hint?: string };
    assert.ok(body.message && body.hint, id);
  }
});

test('許可していない Host からの一覧は 403', async () => {
  const port = (server.address() as AddressInfo).port;
  const status = await new Promise<number>((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/runs', headers: { host: `evil.example:${port}` } }, (res) => {
      res.resume();
      done(res.statusCode ?? 0);
    });
    req.on('error', fail);
    req.end();
  });
  assert.equal(status, 403);
});

test('1 件取得は実行完了の SSE の result と同じ形を返す', async (t) => {
  t.mock.method(console, 'error', () => {});
  const fd = new FormData();
  fd.set('kind', 'github');
  fd.set('url', 'https://github.com/owner/repo');
  fd.append('docs', 'D01');
  fd.append('formats', 'md');
  fd.append('formats', 'html');
  const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
  assert.equal(res.status, 202);
  const { jobId } = (await res.json()) as { jobId: string };
  const events = await (await fetch(`${base}/api/jobs/${jobId}/events`)).text();
  const result: unknown = JSON.parse(/event: result\ndata: (.*)\n/.exec(events)?.[1] ?? 'null');
  assert.ok(result);
  const one = await fetch(`${base}/api/runs/${LIVE}`);
  assert.equal(one.status, 200);
  const got: unknown = await one.json();
  assert.deepEqual(got, result);
  const r = got as { hasFailures: boolean; docs: { id: string; changes?: number }[]; trace?: { url: string } };
  assert.equal(r.hasFailures, true);
  assert.equal(r.docs[0]?.changes, 1);
  assert.equal(r.trace?.url, `/trace/${LIVE}`);
  // 実行した回も一覧に載る（最も古いので末尾）
  const { runs } = await getRuns();
  assert.equal(runs.at(-1)?.runId, LIVE);
});

