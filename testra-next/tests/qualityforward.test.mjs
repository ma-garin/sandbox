import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../core/pipeline.js';
import { toQualityForwardPayload, syncToQualityForward } from '../core/connectors/qualityforward.js';

const input = { title: 'ログイン', sources: [{ name: 's', kind: 'spec', text: 'ユーザーはログインできる。' }] };

test('QF payload: スイート/ケース/結果を対応づける', async () => {
  const run = await runPipeline(input, {});
  const p = toQualityForwardPayload(run);
  assert.ok(p.suites.length >= 1);
  assert.equal(p.testCases.length, p.testResults.length);
  assert.ok(p.testResults.every((r) => ['Passed', 'Failed', 'Blocked', 'Untested'].includes(r.status)));
});

test('sync: 既定は dry-run で送信しない', async () => {
  const run = await runPipeline(input, {});
  const res = await syncToQualityForward(run, {});
  assert.equal(res.mode, 'dry-run');
  assert.equal(res.sent, false);
});

test('sync: apiKey+baseUrl 指定時は注入 fetch へ POST する', async () => {
  const run = await runPipeline(input, {});
  let called = null;
  const fetchImpl = async (url, opts) => {
    called = { url, opts };
    return { ok: true, status: 200 };
  };
  const res = await syncToQualityForward(run, {
    dryRun: false,
    baseUrl: 'https://qf.example.com',
    apiKey: 'TOKEN',
    fetchImpl,
  });
  assert.equal(res.mode, 'live');
  assert.equal(res.sent, true);
  assert.match(called.url, /test_results$/);
  assert.equal(called.opts.headers.ApiToken, 'TOKEN');
});
