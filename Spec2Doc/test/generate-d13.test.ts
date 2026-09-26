// D13 テスト観点表（ISTQB FL の技法でテスト条件を導く）の受入基準に対応するテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIr, type Boundary, type FunctionInfo, type IR, type UiElement } from '../src/ir/schema.ts';
import { featuresByUiElement } from '../src/generate/d13.ts';
import type { Document, TableBlock } from '../src/doc/model.ts';
import { generate } from '../src/generate/index.ts';

const leaf = (text: string) => ({ op: 'leaf' as const, text });

function ir(): IR {
  const base = emptyIr({ kind: 'folder', label: 'd13' }, '2026-09-26T00:00:00.000Z');
  return {
    ...base,
    files: [{ id: 'file:app.js', source: [], path: 'app.js', language: 'javascript', status: 'analyzed', lines: 80 }],
    functions: [
      { id: 'fn:submit', source: [{ file: 'app.js', line: 10, endLine: 60 }], name: 'submit', moduleId: 'mod:app', params: [], complexity: 3, calls: [], exported: false, refCount: 1, async: false, throws: ['err:age'] },
    ],
    eventHandlers: [{ id: 'eh:1', source: [{ file: 'app.js', line: 5 }], target: '#send', uiElementId: 'ui:send', event: 'click', handler: 'fn:submit' }],
    uiElements: [
      { id: 'ui:age', source: [{ file: 'index.html', line: 3 }], screenId: 'scr', domId: 'age', label: '年齢', kind: 'input', inputType: 'number', constraints: { min: '0', max: '120' } },
      { id: 'ui:send', source: [{ file: 'index.html', line: 4 }], screenId: 'scr', domId: 'send', label: '送信', kind: 'button', constraints: {} },
    ],
    boundaries: [
      { id: 'bnd:age-min', source: [{ file: 'app.js', line: 12 }], subject: 'age', bound: 'lower', value: '0', inclusive: true, unit: '歳', insideExample: '30', outsideExample: '-5', configurable: 'fixed' },
      { id: 'bnd:age-max', source: [{ file: 'app.js', line: 13 }], subject: 'age', bound: 'upper', value: '120', inclusive: true, unit: '歳', insideExample: '30', outsideExample: '130', configurable: 'fixed' },
      { id: 'bnd:to', source: [{ file: 'app.js', line: 14 }], subject: 'timeout', bound: 'timeout', value: '5000', inclusive: null, unit: 'ms', insideExample: '4000', outsideExample: '6000', configurable: 'fixed' },
    ],
    rules: [
      {
        id: 'rule:fee', source: [{ file: 'app.js', line: 20 }], functionId: 'fn:submit', name: 'fee', kind: 'if',
        cases: [
          { condition: { op: 'and', items: [leaf('age >= 65'), leaf('member')] }, result: '割引', source: [{ file: 'app.js', line: 20 }] },
          { condition: null, result: '通常', source: [{ file: 'app.js', line: 22 }] },
        ],
      },
      {
        id: 'rule:big', source: [{ file: 'app.js', line: 30 }], functionId: 'fn:submit', name: 'big', kind: 'if',
        cases: [{ condition: { op: 'or', items: ['a', 'b', 'c', 'd', 'e'].map(leaf) }, result: '警告', source: [{ file: 'app.js', line: 30 }] }],
      },
    ],
    states: [
      {
        id: 'st:mode', source: [{ file: 'app.js', line: 40 }], variable: 'mode', mechanism: 'variable', values: ['idle', 'sending', 'done'], initial: 'idle',
        transitions: [
          { from: 'idle', trigger: 'submit', to: 'sending', source: [{ file: 'app.js', line: 41 }] },
          { from: 'sending', trigger: 'response', to: 'done', source: [{ file: 'app.js', line: 42 }] },
        ],
      },
    ],
    errors: [{ id: 'err:age', source: [{ file: 'app.js', line: 15 }], message: '年齢を正しく入力してください', condition: 'age < 0', kind: 'validation', functionId: 'fn:submit' }],
  };
}

function tables(doc: Document, heading: string): TableBlock[] {
  const s = doc.sections.find((x) => x.heading.includes(heading));
  assert.ok(s, `節「${heading}」がある`);
  return s.blocks.filter((b): b is TableBlock => b.type === 'table');
}

async function d13(): Promise<Document> {
  const [doc] = await generate(ir(), ['D13']);
  assert.ok(doc && doc.id === 'D13' && doc.title === 'テスト観点表');
  return doc;
}

test('Given 年齢の境界 0〜120（含む） When D13 を作る Then 2 値境界値（-1 拒否・0 受理・120 受理・121 拒否）と同値分割の代表値が機能 ID・導出元付きで出る', async () => {
  const [bv] = tables(await d13(), '境界値分析');
  assert.ok(bv);
  const find = (v: string) => bv.rows.find((r) => r.cells[3] === 'age' && r.cells[7] === v && r.cells[5] === '境界値分析（2 値）');
  assert.deepEqual([find('-1')?.cells[8], find('0')?.cells[8], find('120')?.cells[8], find('121')?.cells[8]], ['拒否', '受理', '受理', '拒否']);
  assert.equal(find('-1')?.cells[6], '直前');
  assert.equal(find('121')?.cells[6], '直後');
  assert.equal(find('0')?.cells[1], 'F-001');
  assert.match(find('0')?.cells[2] ?? '', /D02 F-001-4 .*bnd:age-min/);
  assert.equal(find('0')?.evidence, 'inference', '刻み幅 1 は推測');
  const ep = bv.rows.filter((r) => r.cells[5] === '同値分割法' && r.cells[3] === 'age');
  assert.ok(ep.some((r) => r.cells[7] === '-5' && r.cells[8] === '拒否' && r.evidence === 'fact'));
});

test('Given 受理/拒否が決まらない境界（timeout） When D13 を作る Then 期待結果は「不明（D09-n）」', async () => {
  const [bv] = tables(await d13(), '境界値分析');
  const rows = bv?.rows.filter((r) => r.cells[3] === 'timeout') ?? [];
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.match(r.cells[8] ?? '', /^不明（D09-\d+）$/);
    assert.equal(r.evidence, 'unknown');
  }
});

test('Given AND 条件の規則と条件 5 個の規則 When D13 を作る Then 全組合せのデシジョンテーブルと、16 超の縮約表が出る', async () => {
  const doc = await d13();
  const ts = tables(doc, 'デシジョンテーブル');
  const full = ts.find((t) => t.columns.includes('C1') && t.columns.includes('C2') && !t.columns.includes('C3'));
  assert.ok(full, '全組合せの表がある');
  assert.equal(full.rows.length, 4);
  assert.deepEqual(full.rows.map((r) => r.cells.slice(3)), [['T', 'T', '割引'], ['T', 'F', '通常'], ['F', 'T', '通常'], ['F', 'F', '通常']]);
  assert.ok(ts.some((t) => t.columns.includes('成り立つ条件')), '縮約表がある');
  const s = doc.sections.find((x) => x.heading.includes('デシジョンテーブル'));
  assert.ok(s?.blocks.some((b) => b.type === 'paragraph' && /組合せ 32 通りが 16 を超える/.test(b.text)));
});

test('Given 状態 mode の遷移 2 件 When D13 を作る Then 0 スイッチの遷移表と無効遷移の候補（期待は不明）が出る', async () => {
  const ts = tables(await d13(), '状態遷移テスト');
  const valid = ts.find((t) => t.caption?.includes('0 スイッチ'));
  assert.deepEqual(valid?.rows.map((r) => [r.cells[3], r.cells[4], r.cells[6]]), [['idle', 'submit', 'sending'], ['sending', 'response', 'done']]);
  assert.match(valid?.rows[0]?.cells[2] ?? '', /D02 F-001-5/);
  const invalid = ts.find((t) => t.caption?.includes('無効遷移'));
  assert.equal(invalid?.rows.length, 4, '3 状態 × 2 イベント − 定義済み 2');
  assert.ok(invalid?.rows.every((r) => /^不明（D09-\d+）$/.test(r.cells[5] ?? '') && r.evidence === 'unknown'));
});

test('Given エラー 1 件 When D13 を作る Then 発生条件と表示文言とエラー推測の起点が出る', async () => {
  const [eg] = tables(await d13(), 'エラー推測');
  assert.deepEqual(eg?.rows[0]?.cells.slice(0, 5), ['EG-1', 'F-001', 'D02 F-001-6 エラー E-001（err:age）', 'age < 0', '年齢を正しく入力してください']);
  assert.match(eg?.rows[0]?.cells[7] ?? '', /範囲外/);
});

function uiIr(): IR {
  const base = emptyIr({ kind: 'folder', label: 'd13-ui' }, '2026-09-26T00:00:00.000Z');
  const fn = (id: string, name: string, line: number, calls: string[], reads: string[]): FunctionInfo =>
    Object.assign(
      { id, source: [{ file: 'app.js', line, endLine: line + 5 }], name, moduleId: 'mod:app', params: [], complexity: 1, calls, exported: false, refCount: 1, async: false, throws: [] },
      { readsUiIds: reads },
    );
  const ui = (id: string, domId: string, kind: 'form' | 'input', line: number, endLine = line): UiElement => ({
    id, source: [{ file: 'index.html', line, endLine }], screenId: 'scr', domId, name: domId, kind, constraints: {},
  });
  const bnd = (id: string, uiElementId: string, subject: string): Boundary => ({
    id, source: [{ file: 'index.html', line: 1 }], uiElementId, subject, bound: 'lower', value: '0', inclusive: true, unit: '個', insideExample: '1', outsideExample: '-1', configurable: 'fixed',
  });
  return {
    ...base,
    files: [{ id: 'file:app.js', source: [], path: 'app.js', language: 'javascript', status: 'analyzed', lines: 60 }],
    functions: [fn('fn:onSubmit', 'onSubmit', 10, [], []), fn('fn:onCalc', 'onCalc', 30, ['fn:check'], []), fn('fn:check', 'check', 45, [], ['qty'])],
    eventHandlers: [
      { id: 'eh:submit', source: [{ file: 'app.js', line: 2 }], target: '#order', uiElementId: 'ui:order', event: 'submit', handler: 'fn:onSubmit' },
      { id: 'eh:calc', source: [{ file: 'app.js', line: 3 }], target: '#calc', event: 'click', handler: 'fn:onCalc' },
    ],
    uiElements: [ui('ui:order', 'order', 'form', 1, 10), ui('ui:age', 'age', 'input', 3), ui('ui:qty', 'qty', 'input', 4), ui('ui:note', 'note', 'input', 20)],
    boundaries: [bnd('bnd:age', 'ui:age', 'age'), bnd('bnd:qty', 'ui:qty', 'qty'), bnd('bnd:note', 'ui:note', 'note')],
  };
}

test('Given 画面側の境界（制約属性） When D13 を作る Then readsUiIds の逆たどりとフォームの submit ハンドラで機能 ID が付き、結び付かない境界だけ「—」', async () => {
  const x = uiIr();
  const links = featuresByUiElement(x);
  assert.deepEqual(links.get('ui:qty')?.map((f) => f.fn.id), ['fn:onSubmit', 'fn:onCalc']);
  assert.deepEqual(links.get('ui:age')?.map((f) => f.fn.id), ['fn:onSubmit']);
  assert.equal(links.get('ui:note'), undefined);
  const [doc] = await generate(x, ['D13']);
  assert.ok(doc);
  const [bv] = tables(doc, '境界値分析');
  const featOf = (subject: string) => bv?.rows.find((r) => r.cells[3] === subject)?.cells[1];
  assert.equal(featOf('age'), 'F-001');
  assert.equal(featOf('qty'), 'F-001、F-002');
  assert.match(featOf('note') ?? '', /^—/);
});
