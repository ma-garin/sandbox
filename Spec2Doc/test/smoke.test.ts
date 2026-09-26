// P0 スモーク: スタブのままの中核 run が out/<実行ID>/ に文書・ir.json・run-log.json を書くこと
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/core.ts';
import { ALL_DOC_IDS } from '../src/doc/model.ts';
import { IR_VERSION } from '../src/ir/schema.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-app');

test('run はサンプルアプリから out/<実行ID>/ に全文書と ir.json・run-log.json を書く', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'spec2doc-smoke-'));
  try {
    const stages: string[] = [];
    const result = await run({ input: { kind: 'folder', path: FIXTURE }, outDir }, (p) => stages.push(p.stage));

    assert.equal(result.outPath, join(outDir, result.runId));
    const names = (await readdir(result.outPath)).sort();
    for (const id of ALL_DOC_IDS) assert.ok(names.includes(`${id}.md`), `${id}.md がある`);
    assert.ok(names.includes('ir.json'));
    assert.ok(names.includes('run-log.json'));

    const ir = JSON.parse(await readFile(join(result.outPath, 'ir.json'), 'utf8'));
    assert.equal(ir.irVersion, IR_VERSION);
    assert.equal(ir.files.length, 5, 'sample-app の 5 ファイルが載る');

    const log = JSON.parse(await readFile(join(result.outPath, 'run-log.json'), 'utf8'));
    for (const key of ['input', 'settings', 'durationMs', 'fileCounts', 'llm']) assert.ok(key in log, `run-log に ${key}`);
    assert.equal(log.fileCounts.total, 5);
    assert.equal(log.llm.requests, 0, 'LLM 無効なら送信 0 件');
    assert.deepEqual(stages, ['ingest', 'analyze', 'generate', 'render', 'done']);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('docIds で選んだ文書だけを書く（REQ-F-020）', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'spec2doc-smoke-'));
  try {
    const result = await run({ input: { kind: 'folder', path: FIXTURE }, outDir, docIds: ['D02', 'D03'] });
    const docs = (await readdir(result.outPath)).filter((n) => /^D\d\d\./.test(n)).sort();
    assert.deepEqual(docs, ['D02.md', 'D03.md']);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
