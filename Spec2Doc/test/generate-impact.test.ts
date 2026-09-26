// D07 変更影響分析: 呼び出し関係を逆にたどり、関数ごとに影響する機能・画面・データ・連携と段数を表にする。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { emptyIr, type IR, type SourceRef } from '../src/ir/schema.ts';
import type { Document, TableBlock } from '../src/doc/model.ts';
import { D09Registry, type GenCtx } from '../src/generate/common.ts';
import { disabledLlm } from '../src/llm/index.ts';
import { buildD07, IMPACT_COLUMNS, WIDE_IMPACT } from '../src/generate/d07.ts';
import { analyze } from '../src/analyze/index.ts';

const at = (file: string, line: number, endLine?: number): SourceRef[] => [{ file, line, ...(endLine ? { endLine } : {}) }];
const fn = (id: string, name: string, line: number, extra: Partial<IR['functions'][number]> = {}): IR['functions'][number] => ({
  id, name, moduleId: 'mod:app', params: [], complexity: 1, calls: [], exported: false, refCount: 1, async: false, throws: [], source: at('app.ts', line, line + 5), ...extra,
});
const newCtx = (): GenCtx => ({ llm: disabledLlm, d09: new D09Registry(), generatedAt: '2026-09-25T00:00:00Z', commit: 'abc123' });

function impactTable(d: Document): TableBlock {
  const s = d.sections.find((x) => x.heading === '変更影響分析');
  assert.ok(s, '節「変更影響分析」がある');
  const t = s.blocks.find((b): b is TableBlock => b.type === 'table' && b.columns[0] === IMPACT_COLUMNS[0] && b.columns.length === IMPACT_COLUMNS.length);
  assert.ok(t, '影響分析の表がある');
  return t;
}
const rowOf = (t: TableBlock, id: string) => {
  const r = t.rows.find((x) => x.cells[0] === id);
  assert.ok(r, `${id} の行がある`);
  return r;
};

/** 6 つのハンドラ h1..h6 が共通関数 check を（h6 は mid 経由で 2 段）呼ぶ。check は保存と送信も行う */
function impactIr(): IR {
  const ir = emptyIr({ kind: 'folder', label: 'impact', commit: 'abc123' }, '2026-09-25T00:00:00Z');
  const handlers = [1, 2, 3, 4, 5].map((n) => fn(`fn:h${n}`, `h${n}`, 100 + n * 10, { calls: ['fn:check'] }));
  return {
    ...ir,
    screens: [{ id: 'scr:main', file: 'index.html', title: 'メイン', isErrorView: false, elementIds: ['ui:b1'], source: at('index.html', 1) }],
    uiElements: [{ id: 'ui:b1', screenId: 'scr:main', domId: 'b1', kind: 'button', label: 'b1', source: at('index.html', 5) } as IR['uiElements'][number]],
    functions: [
      fn('fn:check', 'check', 10, { calls: ['fn:check'] }),
      ...handlers,
      fn('fn:mid', 'mid', 60, { calls: ['fn:check'] }),
      fn('fn:h6', 'h6', 200, { calls: ['fn:mid', 'dynamicCall', 'Math.floor', 'Number', 'document.getElementById'] }),
      fn('fn:cb', 'cb', 80, { refCount: 1 }),
    ],
    eventHandlers: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `ev:${n}`, target: `#b${n}`, event: 'click', handler: `fn:h${n}`, ...(n === 1 ? { uiElementId: 'ui:b1' } : {}), source: at('app.ts', 300 + n) })),
    dataItems: [{ id: 'data:ls:items', kind: 'localStorage', name: 'items', fields: [], source: at('app.ts', 12) }],
    integrations: [{ id: 'int:1', direction: 'outbound', mechanism: 'fetch', method: 'POST', url: '/api/save', timing: 'check', failureConditions: [], functionId: 'fn:check', source: at('app.ts', 13) }],
  };
}

test('D07 変更影響分析: 共通関数は 6 機能に影響し「影響が広い」として先頭に並び、段数・画面・データ・連携が載る', () => {
  const d = buildD07(impactIr(), newCtx());
  const t = impactTable(d);
  assert.deepEqual(t.columns, IMPACT_COLUMNS);
  assert.equal(t.rows[0]?.cells[0], 'fn:check', '影響が広い関数が先頭');
  const check = rowOf(t, 'fn:check');
  assert.match(check.cells[2] ?? '', new RegExp(`影響が広い（6 機能）`));
  assert.ok(6 >= WIDE_IMPACT);
  assert.match(check.cells[3] ?? '', /（1段）/);
  assert.match(check.cells[3] ?? '', /（2段）/, 'h6 へは mid 経由の 2 段');
  assert.equal(check.cells[4], '2');
  assert.match(check.cells[5] ?? '', /S-001/);
  assert.match(check.cells[6] ?? '', /items（localStorage）/);
  assert.match(check.cells[7] ?? '', /POST \/api\/save/);
  assert.equal(check.evidence, 'fact');
  assert.match(check.cells[8] ?? '', /app\.ts:10-15/, '関数の位置');
  assert.match(check.cells[8] ?? '', /app\.ts:60-65/, '呼び出し元の位置');
  const h1 = rowOf(t, 'fn:h1');
  assert.match(h1.cells[3] ?? '', /（0段）/, '関数自身が機能なら 0 段');
  assert.equal(h1.cells[6], 'なし');
});

test('D07 変更影響分析: 呼び出し元を追えない関数と解決できない呼び出しは「不明（D09-n）」', () => {
  const ctx = newCtx();
  const d = buildD07(impactIr(), ctx);
  const cb = rowOf(impactTable(d), 'fn:cb');
  assert.match(cb.cells[3] ?? '', /^不明（D09-\d+）$/);
  assert.equal(cb.evidence, 'unknown');
  assert.ok(cb.d09Ref);
  const s = d.sections.find((x) => x.heading === '変更影響分析');
  const un = s?.blocks.find((b): b is TableBlock => b.type === 'table' && b.caption === '呼び出し先を追えない呼び出し');
  assert.ok(un);
  assert.equal(un.rows.length, 1);
  assert.equal(un.rows[0]?.cells[2], 'dynamicCall');
  assert.match(un.rows[0]?.cells[3] ?? '', /^不明（D09-\d+）$/);
  for (const r of (s?.blocks ?? []).filter((b): b is TableBlock => b.type === 'table').flatMap((b) => b.rows)) {
    assert.ok(r.evidence === 'unknown' ? r.d09Ref : r.source.length > 0, '全行に根拠');
  }
});

test('D07 変更影響分析: sample-app で validate 等の共通関数から機能 onSubmit までの経路と段数が事実として出る', async () => {
  const dir = resolve(import.meta.dirname, '../fixtures/sample-app');
  const names = (await readdir(dir)).filter((n) => !n.startsWith('.'));
  const ir = await analyze(names.map((n) => ({ path: n, abs: join(dir, n) })), dir, { generatedAt: '2026-09-25T00:00:00Z' });
  const d = buildD07(ir, newCtx());
  const t = impactTable(d);
  const byName = (name: string) => {
    const r = t.rows.find((x) => x.cells[1] === name);
    assert.ok(r, `${name} の行がある`);
    return r;
  };
  for (const name of ['validate', 'setState', 'showError', 'clearError']) {
    const r = byName(name);
    assert.match(r.cells[3] ?? '', /^F-\d{3}（1段）$/, `${name}: ${r.cells[3]}`);
    assert.equal(r.evidence, 'fact');
    assert.match(r.cells[8] ?? '', /app\.js:136/, `${name}: 呼び出し元 onSubmit の位置が根拠`);
  }
  assert.match(byName('postWithRetry').cells[7] ?? '', /\S/, '連携列がある');
  const s = d.sections.find((x) => x.heading === '変更影響分析');
  const un = s?.blocks.find((b): b is TableBlock => b.type === 'table' && b.caption === '呼び出し先を追えない呼び出し');
  assert.equal(un, undefined, '標準 API・メソッド呼び出しは不明に数えない');
});
