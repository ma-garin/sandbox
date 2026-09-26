// E2E: Web サーバをプロセスとして起動し、フォルダ入力での実行から閲覧・ダウンロードまでを確認する
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close((err) => (err ? rej(err) : res(port)));
    });
    srv.on('error', rej);
  });
}

async function waitReady(base: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/`);
      await res.body?.cancel();
      if (res.status === 200) return;
    } catch {
      // まだ起動していない
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('サーバが起動しませんでした');
}

test('Web 経由でフォルダ入力を実行し、閲覧・ダウンロードできる', async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child: ChildProcess = spawn(process.execPath, ['src/web/server.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitReady(base, Date.now() + 10_000);

    const fd = new FormData();
    fd.set('kind', 'folder');
    fd.set('folder', 'fixtures/sample-app');
    fd.append('docs', 'D01');
    fd.append('formats', 'md');
    fd.append('formats', 'html');
    fd.append('formats', 'docx');
    fd.append('formats', 'trace');
    const runRes = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
    if (runRes.status !== 202) {
      throw new Error(`202 を期待したが ${runRes.status}: ${await runRes.text()}`);
    }
    const { jobId } = (await runRes.json()) as { jobId: string };

    const eventsRes = await fetch(`${base}/api/jobs/${jobId}/events`, { signal: AbortSignal.timeout(60_000) });
    const eventsText = await eventsRes.text();
    assert.match(eventsText, /event: result/, eventsText);
    const match = /event: result\ndata: (.*)\n/.exec(eventsText);
    assert.ok(match, 'result イベントが届く');
    const result = JSON.parse(match![1] ?? '') as {
      runId: string;
      docs: { id: string; title: string; files: string[] }[];
      trace?: { url: string; nodes: number; links: number; reviewed: number };
    };
    // トレーサビリティ: 結果に要約が載り、トップレベルのページとして開けて、確認状態を読める
    assert.equal(result.trace?.url, `/trace/${result.runId}`);
    assert.ok((result.trace?.nodes ?? 0) > 0, 'ノードがある');
    const traceRes = await fetch(`${base}/trace/${result.runId}`);
    assert.equal(traceRes.status, 200);
    const traceCspHeader = traceRes.headers.get('content-security-policy') ?? '';
    assert.doesNotMatch(traceCspHeader, /sandbox/);
    assert.match(traceCspHeader, /script-src 'sha256-/);
    assert.match(await traceRes.text(), /window\.SPEC2DOC_TRACE_API=/);
    const reviewRes = await fetch(`${base}/api/runs/${result.runId}/trace-review`);
    assert.equal(reviewRes.status, 200);
    assert.equal(typeof ((await reviewRes.json()) as { reviews: unknown }).reviews, 'object');
    assert.equal(result.docs[0]?.id, 'D01');
    const htmlFile = result.docs[0]?.files.find((f) => f.endsWith('.html'));
    const docxFile = result.docs[0]?.files.find((f) => f.endsWith('.docx'));
    assert.ok(htmlFile, 'html ファイルが結果に含まれる');
    assert.ok(docxFile, 'docx ファイルが結果に含まれる');

    const viewRes = await fetch(`${base}/view/${result.runId}/${htmlFile}`);
    assert.equal(viewRes.status, 200);
    // 生成 HTML の inline script（目次の追従）だけが動く CSP。外部読み込みと同一オリジン扱いは許さない
    const viewCsp = viewRes.headers.get('content-security-policy') ?? '';
    const viewHtml = await viewRes.text();
    assert.match(viewCsp, /^sandbox allow-scripts;/);
    assert.doesNotMatch(viewCsp, /allow-same-origin/);
    if (viewHtml.includes('<script>')) assert.match(viewCsp, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
    assert.doesNotMatch(viewHtml, /<script[^>]+src=|<link[^>]+href="https?:/);

    const dlRes = await fetch(`${base}/files/${result.runId}/${docxFile}`);
    assert.equal(dlRes.status, 200);
    const buf = new Uint8Array(await dlRes.arrayBuffer());
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);

    const traversalRes = await fetch(`${base}/files/${result.runId}/..%2F..%2Fetc%2Fpasswd`);
    assert.ok([400, 404].includes(traversalRes.status), String(traversalRes.status));
    await traversalRes.body?.cancel();
  } finally {
    child.kill();
  }
});
