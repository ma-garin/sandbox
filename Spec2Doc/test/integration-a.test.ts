// 結合（解析→生成）: ハンドラと画面要素の結び付け・HTML 属性からの関数参照・D09 の LLM 事項・D05/D11 の連携値
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { analyze, handlerCalleeNames, linkEventHandlers } from '../src/analyze/index.ts';
import { generate } from '../src/generate/index.ts';
import { LLM_ALL_GENERATED_TEXT } from '../src/generate/common.ts';
import { emptyIr, type IR } from '../src/ir/schema.ts';
import type { LlmClient } from '../src/llm/index.ts';
import type { Document } from '../src/doc/model.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-app');
const GEN_AT = '2026-01-01T00:00:00.000Z';

async function analyzeFixture(): Promise<IR> {
  const names = (await readdir(FIXTURE)).sort();
  return analyze(names.map((n) => ({ path: n, abs: join(FIXTURE, n) })), FIXTURE, { generatedAt: GEN_AT });
}

const tableRows = (doc: Document | undefined): string[][] =>
  (doc?.sections ?? []).flatMap((s) => s.blocks.flatMap((b) => (b.type === 'table' ? b.rows.map((r) => r.cells.map(String)) : [])));

const fakeLlm = {
  enabled: true,
  async explain() {
    return { text: '入力を検証して料金を計算する。', evidence: 'inference', source: [{ file: 'app.js', line: 1 }] };
  },
  usage() {
    return { calls: 0, inputTokens: 0, outputTokens: 0 };
  },
} as unknown as LlmClient;

test('handlerCalleeNames: 属性値から関数名だけを取り出す', () => {
  assert.deepEqual(handlerCalleeNames('doIt(1); return false'), ['doIt']);
  assert.deepEqual(handlerCalleeNames('onCalc'), ['onCalc']);
  assert.deepEqual(handlerCalleeNames('if (ok) { a.b(); save(event) }'), ['save']);
});

test('linkEventHandlers: #id の target を UiElement に結び付け、HTML 属性の呼び出しを refCount に足す', () => {
  const base = emptyIr({ kind: 'folder', label: 'x' }, GEN_AT);
  const src = (file: string) => [{ file, line: 1 }];
  const ir: IR = {
    ...base,
    uiElements: [
      { id: 'UI-a', source: src('a.html'), evidence: 'fact', screenId: 'SCR-a', domId: 'calc', kind: 'button', constraints: {} },
      { id: 'UI-d1', source: src('a.html'), evidence: 'fact', screenId: 'SCR-a', domId: 'dup', kind: 'button', constraints: {} },
      { id: 'UI-d2', source: src('b.html'), evidence: 'fact', screenId: 'SCR-b', domId: 'dup', kind: 'button', constraints: {} },
    ],
    eventHandlers: [
      { id: 'EVH-1', source: src('app.js'), evidence: 'fact', target: '#calc', event: 'click', handler: 'onCalc' },
      { id: 'EVH-2', source: src('app.js'), evidence: 'fact', target: '#dup', event: 'click', handler: 'x' },
      { id: 'EVH-3', source: src('a.html'), evidence: 'fact', target: '#calc', uiElementId: 'UI-a', event: 'click', handler: 'onlyHtml(); return false' },
    ],
    functions: [
      { id: 'FN-onlyHtml', source: src('app.js'), evidence: 'fact', name: 'onlyHtml', moduleId: 'MOD-app.js', params: [], complexity: 1, calls: [], exported: false, refCount: 0, async: false, throws: [] },
      { id: 'FN-unused', source: src('app.js'), evidence: 'fact', name: 'unused', moduleId: 'MOD-app.js', params: [], complexity: 1, calls: [], exported: false, refCount: 0, async: false, throws: [] },
    ],
  } as IR;
  const out = linkEventHandlers(ir);
  assert.equal(out.eventHandlers.find((h) => h.id === 'EVH-1')?.uiElementId, 'UI-a');
  assert.equal(out.eventHandlers.find((h) => h.id === 'EVH-2')?.uiElementId, undefined, '同じ id が複数あれば決めない');
  assert.equal(out.functions.find((f) => f.name === 'onlyHtml')?.refCount, 1);
  assert.equal(out.functions.find((f) => f.name === 'unused')?.refCount, 0);
  assert.equal(ir.functions[0]?.refCount, 0, '元の IR を変更しない');
});

test('analyze: onclick 属性だけから呼ばれる関数は未参照にならない', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spec2doc-int-a-'));
  try {
    await writeFile(join(dir, 'index.html'), '<!doctype html><html><head><title>t</title></head><body>\n<button id="go" onclick="onlyHtml()">実行</button>\n<script src="app.js"></script></body></html>\n');
    await writeFile(join(dir, 'app.js'), 'function onlyHtml() { return 1; }\nfunction unused() { return 2; }\n');
    const ir = await analyze([{ path: 'app.js', abs: join(dir, 'app.js') }, { path: 'index.html', abs: join(dir, 'index.html') }], dir);
    assert.ok((ir.functions.find((f) => f.name === 'onlyHtml')?.refCount ?? 0) >= 1);
    assert.equal(ir.functions.find((f) => f.name === 'unused')?.refCount, 0);
    const h = ir.eventHandlers.find((e) => e.handler.includes('onlyHtml'));
    assert.equal(h?.uiElementId, ir.uiElements.find((u) => u.domId === 'go')?.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('analyze: sample-app の #id 形のハンドラはすべて UiElement に結び付く', async () => {
  const ir = await analyzeFixture();
  const byId = ir.eventHandlers.filter((h) => /^#[\w-]+$/.test(h.target));
  assert.ok(byId.length > 0);
  for (const h of byId) {
    const el = ir.uiElements.find((u) => u.id === h.uiElementId);
    assert.equal(`#${el?.domId}`, h.target, h.id);
  }
});

test('D09: 選ばれた全文書で LLM が動けば番号を残して「該当なし」にする', async () => {
  const ir = await analyzeFixture();
  const docs = ['D01', 'D02', 'D03', 'D09'] as const;
  const on = await generate(ir, [...docs], { llm: fakeLlm });
  const off = await generate(ir, [...docs]);
  const onRows = tableRows(on.find((d) => d.id === 'D09'));
  const offRows = tableRows(off.find((d) => d.id === 'D09'));
  const hit = onRows.find((r) => r.includes(LLM_ALL_GENERATED_TEXT));
  assert.ok(hit, 'LLM 有効時は該当なしの行がある');
  assert.equal(onRows.length, offRows.length, '番号（行数）は変わらない');
  assert.ok(offRows.some((r) => r[0] === hit[0]), '同じ番号が LLM 無効時にもある');
  assert.ok(!offRows.some((r) => r.includes(LLM_ALL_GENERATED_TEXT)));
});

test('D05/D11: timeout 5000ms・retries 3 が fetch の連携行に結び付く', async () => {
  const ir = await analyzeFixture();
  const out = await generate(ir, ['D05', 'D11']);
  const d05 = tableRows(out.find((d) => d.id === 'D05')).find((r) => r[0]?.startsWith('INT-') && r[2]?.includes('fetch'));
  assert.ok(d05?.some((c) => c.includes('5000 ms')), 'D05 にタイムアウト');
  assert.ok(d05?.some((c) => c.includes('3 回')), 'D05 に再試行');
  const d11 = tableRows(out.find((d) => d.id === 'D11'));
  const intId = d05?.[0] ?? '';
  assert.ok(d11.some((r) => r.join('|').includes('5000 ms') && r.join('|').includes(intId)), 'D11 のタイムアウトが連携に結び付く');
  assert.ok(d11.some((r) => r.join('|').includes('3 回') && r.join('|').includes(intId)), 'D11 の再試行が連携に結び付く');
});

test('全文書の md 相当に undefined・[object Object]・NaN が出ない', async () => {
  const ir = await analyzeFixture();
  const out = await generate(ir, ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D11', 'D12']);
  const text = JSON.stringify(out);
  assert.ok(!/undefined|object Object|NaN/.test(text));
});
