// 生成 A（D01・D02・D03・D09 と generate の合流）の受入基準に対応するテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIr, type Boundary, type DataItem, type EventHandler, type FunctionInfo, type IR, type Unknown } from '../src/ir/schema.ts';
import type { Block, Document, ListItem, Provenance, TableRow } from '../src/doc/model.ts';
import { generate } from '../src/generate/index.ts';
import { VIEWPOINTS } from '../src/generate/d02.ts';
import { LLM_DISABLED_TEXT, type LlmClient } from '../src/llm/index.ts';
import type { ScreenWithHeadings } from '../src/analyze/html.ts';
import { LLM_ALL_GENERATED_TEXT } from '../src/generate/common.ts';

function sampleIr(opts: { failed?: boolean } = {}): IR {
  const base = emptyIr({ kind: 'folder', label: 'sample', commit: 'abc123' }, '2026-09-25T00:00:00.000Z');
  const indexScreen: ScreenWithHeadings = {
    id: 'scr:index', source: [{ file: 'index.html', line: 1 }], file: 'index.html', title: '購入', isErrorView: false, elementIds: ['ui:qty', 'ui:buy'],
    headings: [{ level: 1, text: '商品の購入', line: 3 }, { level: 2, text: '数量', line: 8 }],
  };
  return {
    ...base,
    files: [
      { id: 'file:index.html', source: [], path: 'index.html', language: 'html', status: 'analyzed', lines: 30 },
      { id: 'file:app.js', source: [], path: 'app.js', language: 'javascript', status: 'analyzed', lines: 40 },
      ...(opts.failed ? [{ id: 'file:bad.js', source: [], path: 'bad.js', language: 'javascript' as const, status: 'failed' as const, lines: 3, reason: 'syntax' }] : []),
    ],
    modules: [{ id: 'mod:app', source: [{ file: 'app.js', line: 1 }], name: 'app', file: 'app.js', kind: 'script' }],
    functions: [
      { id: 'fn:submit', source: [{ file: 'app.js', line: 10, endLine: 20 }], name: 'submit', moduleId: 'mod:app', params: [], complexity: 2, calls: ['fn:calc'], exported: false, refCount: 1, async: false, throws: [] },
      { id: 'fn:calc', source: [{ file: 'app.js', line: 22, endLine: 35 }], name: 'calc', moduleId: 'mod:app', params: [{ name: 'qty', type: 'number' }], complexity: 3, calls: [], exported: false, refCount: 1, async: false, throws: ['err:qty'] },
    ],
    eventHandlers: [{ id: 'eh:1', source: [{ file: 'app.js', line: 5 }], target: '#buy', uiElementId: 'ui:buy', event: 'click', handler: 'fn:submit' }],
    screens: [
      indexScreen,
      { id: 'scr:error', source: [{ file: 'error.html', line: 1 }], file: 'error.html', title: 'エラー', isErrorView: true, elementIds: [] },
    ],
    uiElements: [
      { id: 'ui:qty', source: [{ file: 'index.html', line: 10 }], screenId: 'scr:index', domId: 'qty', label: '数量', kind: 'input', inputType: 'text', constraints: { maxlength: '256' } },
      { id: 'ui:buy', source: [{ file: 'index.html', line: 12 }], screenId: 'scr:index', domId: 'buy', label: '購入する', kind: 'button', constraints: {}, navigatesTo: 'error.html' },
    ],
    rules: [
      {
        id: 'rule:1', source: [{ file: 'app.js', line: 25 }], functionId: 'fn:calc', name: '加熱判定', kind: 'if',
        cases: [
          {
            condition: { op: 'or', items: [{ op: 'leaf', text: '温度が 110 を超える' }, { op: 'and', items: [{ op: 'leaf', text: 'モードが keep' }, { op: 'leaf', text: '経過が 180 以上' }] }] },
            result: '停止', source: [{ file: 'app.js', line: 25 }],
          },
          { condition: null, result: '継続', source: [{ file: 'app.js', line: 28 }] },
        ],
      },
    ],
    boundaries: [
      { id: 'b:qty', source: [{ file: 'index.html', line: 10 }], subject: '数量', uiElementId: 'ui:qty', bound: 'length', value: '256', inclusive: true, unit: '文字', insideExample: '256 文字は入力可', outsideExample: '257 文字目は入力不可', configurable: 'fixed' },
      { id: 'b:t', source: [{ file: 'app.js', line: 26 }], subject: 'timeout', bound: 'timeout', value: '3000', inclusive: false, unit: null, insideExample: '2999', outsideExample: '3000', configurable: 'fixed' },
    ],
    errors: [{ id: 'err:qty', source: [{ file: 'app.js', line: 30 }], message: '数量を入力してください', condition: '数量が空', kind: 'validation', functionId: 'fn:calc' }],
    unknowns: [{ id: 'unk:1', source: [{ file: 'app.js', line: 33 }], topic: '定数 42', question: '42 の意味', relatedIds: [], category: 'magic-number' }],
  };
}

function provs(doc: Document): Provenance[] {
  const fromItems = (items: ListItem[]): Provenance[] => items.flatMap((i) => [i, ...fromItems(i.children ?? [])]);
  const fromBlock = (b: Block): Provenance[] => (b.type === 'paragraph' ? [b] : b.type === 'table' ? b.rows : b.type === 'diagram' ? [b.provenance] : fromItems(b.items));
  return doc.sections.flatMap((s) => s.blocks.flatMap(fromBlock));
}

function texts(doc: Document): string {
  return JSON.stringify(doc.sections);
}

test('選んだ文書だけを作り、無い生成器は未実装の文書を返す（REQ-F-020）', async () => {
  const docs = await generate(sampleIr(), ['D02', 'D03']);
  assert.deepEqual(docs.map((d) => d.id), ['D02', 'D03']);
});

test('D02: 機能ごとに 7 観点の節があり、空の節が無い（REQ-F-031）', async () => {
  const [d02] = await generate(sampleIr(), ['D02']);
  assert.ok(d02);
  const featureHeads = d02.sections.filter((s) => /^F-\d{3} /.test(s.heading));
  assert.equal(featureHeads.length, 1); // submit（ハンドラ登録）だけが機能
  assert.equal(featureHeads[0]?.level, 2);
  const vps = d02.sections.filter((s) => /^F-\d{3}-\d /.test(s.heading));
  for (const v of vps) assert.equal(v.level, 3);
  assert.equal(vps.length, 7);
  assert.deepEqual(vps.map((s) => s.heading.replace(/^F-001-\d /, '')), [...VIEWPOINTS]);
  for (const s of vps) assert.ok(s.blocks.length > 0, `空の節: ${s.heading}`);
  assert.ok(!texts(d02).includes('対象外'));
});

test('D02: 0 件の観点は「検出なし」＋D09 番号、解析失敗があれば「不明（D09-n）」', async () => {
  const [ok] = await generate(sampleIr(), ['D02']);
  const state = ok?.sections.find((s) => s.heading.endsWith('状態と状態遷移'));
  const p = state?.blocks[0];
  assert.ok(p && p.type === 'paragraph');
  assert.match(p.text, /^ソース上に検出なし（抽出した結果 0 件。仕様として存在しないかは D09-\d+ で確認）$/);
  assert.equal(p.evidence, 'unknown');
  assert.match(p.d09Ref ?? '', /^D09-\d+$/);

  const [ng] = await generate(sampleIr({ failed: true }), ['D02']);
  const st2 = ng?.sections.find((s) => s.heading.endsWith('状態と状態遷移'))?.blocks[0];
  assert.ok(st2 && st2.type === 'paragraph');
  assert.match(st2.text, /^不明（D09-\d+）$/);
});

test('D02: AND/OR を入れ子の列挙に展開し、境界の内側例・外側例を載せる（REQ-F-033・036）', async () => {
  const [d02] = await generate(sampleIr(), ['D02']);
  assert.ok(d02);
  const rules = d02.sections.find((s) => s.heading.endsWith('業務ルール／計算式'));
  const list = rules?.blocks.find((b) => b.type === 'list');
  assert.ok(list && list.type === 'list');
  const or = list.items[0]?.children?.[0];
  assert.equal(or?.text, '次のいずれかを満たす');
  assert.equal(or?.children?.[1]?.text, '次のすべてを満たす');
  assert.deepEqual(or?.children?.[1]?.children?.map((c) => c.text), ['モードが keep', '経過が 180 以上']);
  // 機能から到達しない入力欄（qty）の境界は D02 に載らず、D03 の入力項目の境界に内側・外側の例付きで載る
  assert.ok(!texts(d02).includes('256 文字は入力可'));
  const [d03] = await generate(sampleIr(), ['D03']);
  const b = texts(d03 as Document);
  assert.ok(b.includes('256 文字は入力可') && b.includes('257 文字目は入力不可'));
  assert.ok(b.includes('数量を入力してください'));
});

test('D09: IR の不明事項が先に D09-1、各文書の不明事項も採番され一覧に載る（REQ-F-025）', async () => {
  const docs = await generate(sampleIr(), ['D09', 'D01', 'D02', 'D03']);
  assert.deepEqual(docs.map((d) => d.id), ['D09', 'D01', 'D02', 'D03']);
  const d09 = docs[0];
  assert.ok(d09);
  const tbl = d09.sections.flatMap((s) => s.blocks).find((b) => b.type === 'table');
  assert.ok(tbl && tbl.type === 'table');
  assert.equal(tbl.rows[0]?.cells[0], 'D09-1');
  assert.equal(tbl.rows[0]?.cells[2], '定数 42');
  const nos = tbl.rows.map((r) => r.cells[0]);
  assert.deepEqual(nos, nos.map((_, i) => `D09-${i + 1}`));
  // 他文書で参照した D09 番号がすべて一覧にある
  const refs = new Set(docs.filter((d) => d.id !== 'D09').flatMap(provs).flatMap((p) => (p.d09Ref ? [p.d09Ref] : [])));
  assert.ok(refs.size > 0);
  for (const r of refs) assert.ok(nos.includes(r), `一覧に無い: ${r}`);
  // 単位不明の境界は D09 に送られる
  assert.ok(tbl.rows.some((r) => r.cells[1] === '単位不明'));
});

test('全記述に Provenance が付き、不明には D09 番号、事実には位置（REQ-F-017）', async () => {
  const docs = await generate(sampleIr(), ['D01', 'D02', 'D03', 'D09']);
  for (const d of docs) {
    for (const p of provs(d)) {
      assert.ok(['fact', 'inference', 'unknown'].includes(p.evidence), d.id);
      assert.ok(Array.isArray(p.source));
      if (p.evidence === 'unknown') assert.match(p.d09Ref ?? '', /^D09-\d+$/, `${d.id} の不明に D09 番号が無い`);
    }
    const last = d.sections.at(-1);
    assert.equal(last?.heading, '改版履歴');
    assert.ok(texts(d).includes('abc123'));
  }
});

test('D01 用語集に「数量 ↔ qty」、D02・D03 で同じ ID（REQ-F-022・032）', async () => {
  const [d01, d02, d03] = await generate(sampleIr(), ['D01', 'D02', 'D03']);
  assert.ok(d01 && d02 && d03);
  const gl = d01.sections.find((s) => s.heading === '4. 用語集')?.blocks[0];
  assert.ok(gl && gl.type === 'table');
  const qty = gl.rows.find((r) => r.cells[1] === '数量');
  assert.equal(qty?.cells[3], 'qty');
  // 画面の語の位置と、同名の引数 qty を持つ関数の位置の両方を根拠にする
  assert.deepEqual(qty?.source, [{ file: 'index.html', line: 10 }, { file: 'app.js', line: 22, endLine: 35 }]);
  assert.equal(qty?.evidence, 'fact');
  // 異常系の画面・エラーに独立 ID、D02 と D03 で同じ E-001
  const t3 = texts(d03);
  assert.ok(t3.includes('S-001') && t3.includes('S-002') && t3.includes('E-001') && t3.includes('P-001'));
  assert.ok(texts(d02).includes('E-001'));
  // 2 回生成して ID が同じ
  // 2 回生成して ID・D09 番号が同じ（同じ文書の選び方のとき）
  const again = await generate(sampleIr(), ['D01', 'D02', 'D03']);
  assert.equal(texts(again[2] as Document), t3);
});

test('LLM 無効なら説明文は LLM_DISABLED_TEXT、有効なら機能一覧の行が「推測」（REQ-F-016・029）', async () => {
  const [off] = await generate(sampleIr(), ['D02']);
  assert.ok(texts(off as Document).includes(LLM_DISABLED_TEXT));
  const fake: LlmClient = {
    enabled: true,
    async explain(req) {
      return { text: `${req.targetId} の説明`, evidence: 'inference', source: [{ file: 'app.js', line: 10 }] };
    },
    usage: () => ({ inputTokens: 0, outputTokens: 0, requests: 0, sentFiles: [] }),
  };
  const [on] = await generate(sampleIr(), ['D02'], { llm: fake });
  const list = on?.sections.find((s) => s.heading === '1. 機能一覧')?.blocks.find((b) => b.type === 'table');
  assert.ok(list && list.type === 'table');
  for (const r of list.rows) {
    assert.equal(r.evidence, 'inference');
    assert.equal(r.origin, 'llm');
  }
  assert.equal(list.rows[0]?.cells[3], 'fn:submit の説明');
});

test('生成器の無い文書は「未実装」の文書 1 節と D09 番号を返す', async () => {
  const { notImplementedDoc, D09Registry } = await import('../src/generate/common.ts');
  const d = notImplementedDoc('D11', { llm: {} as LlmClient, d09: new D09Registry(), generatedAt: 'x' });
  assert.equal(d.sections.filter((s) => s.heading === '未実装').length, 1);
  assert.match(provs(d)[0]?.d09Ref ?? '', /^D09-1$/);
});

function d09Table(doc: Document | undefined) {
  const t = doc?.sections.flatMap((s) => s.blocks).find((b) => b.type === 'table');
  assert.ok(t && t.type === 'table');
  return t;
}

test('D09 番号は文書の選び方に依存せず、D09 だけ選んでも D02 由来の「検出なし」が載る', async () => {
  const [only] = await generate(sampleIr(), ['D09']);
  const all = await generate(sampleIr(), ['D01', 'D02', 'D03', 'D09']);
  const tOnly = d09Table(only);
  assert.deepEqual(tOnly.rows, d09Table(all[3]).rows);
  assert.ok(tOnly.rows.some((r) => r.cells[4] === 'D02' && r.cells[1] === '検出なし（対象外か実装漏れか）'));
  // D02 が参照する番号は、D09 だけを選んだときの一覧にも同じ番号である
  const refs = provs(all[1] as Document).flatMap((p) => (p.d09Ref ? [p.d09Ref] : []));
  const nos = tOnly.rows.map((r) => r.cells[0]);
  for (const r of refs) assert.ok(nos.includes(r), r);
  const [again] = await generate(sampleIr(), ['D09']);
  assert.deepEqual(d09Table(again).rows, tOnly.rows);
});

test('D08 に文書横断の対応表 2 つが改版履歴の前に載る（REQ-F-023）', async () => {
  const [d08] = await generate(sampleIr(), ['D08']);
  assert.ok(d08);
  const heads = d08.sections.map((s) => s.heading);
  const iFwd = heads.indexOf('文書横断の対応表（記述→ソース位置）');
  const iBack = heads.indexOf('文書横断の対応表（ソース→文書・節）');
  assert.ok(iFwd > 0 && iBack > iFwd && heads.at(-1) === '改版履歴');
  const fwd = d08.sections[iFwd]?.blocks[0];
  assert.ok(fwd && fwd.type === 'table');
  const glossary = fwd.rows.find((r) => r.cells[0] === 'D01' && r.cells[1] === '4. 用語集' && r.cells[2]?.includes('数量'));
  assert.ok(glossary);
  assert.ok(glossary.cells[3]?.includes('index.html:10'));
  assert.equal(glossary.evidence, 'fact');
  const back = d08.sections[iBack]?.blocks[0];
  assert.ok(back && back.type === 'table');
  const app = back.rows.find((r) => r.cells[0] === 'app.js');
  assert.ok(app && app.cells[2]?.includes('D02'));
  assert.ok(app.source.every((s) => s.file === 'app.js'));
});

test('D01 用語集に HTML の見出しが載り、ラベルと重なる語は二重に載せない', async () => {
  const [d01] = await generate(sampleIr(), ['D01']);
  const gl = d01?.sections.find((s) => s.heading === '4. 用語集')?.blocks[0];
  assert.ok(gl && gl.type === 'table');
  const h = gl.rows.find((r) => r.cells[1] === '商品の購入');
  assert.ok(h);
  assert.deepEqual(h.source, [{ file: 'index.html', line: 3 }]);
  assert.equal(h.evidence, 'fact');
  assert.equal(gl.rows.filter((r) => r.cells[1] === '数量').length, 1);
});

test('LLM は選んだ文書にだけ使い、D09 番号は LLM の有効・無効で変わらない', async () => {
  const calls: string[] = [];
  const mock: LlmClient = {
    enabled: true,
    async explain(req) {
      calls.push(req.targetId);
      return { text: `${req.targetId} の説明`, evidence: 'inference', source: [{ file: 'app.js', line: 10 }] };
    },
    usage: () => ({ inputTokens: 0, outputTokens: 0, requests: calls.length, sentFiles: [] }),
  };
  const [d02on, d09on] = await generate(sampleIr(), ['D02', 'D09'], { llm: mock });
  // D02 の呼び出しは機能 1 件（fn:submit）と機能一覧の概要 1 件だけ。D01 のモジュール・D03 の画面には送らない
  assert.deepEqual(calls.sort(), ['fn:submit', 'system']);
  assert.ok(texts(d02on as Document).includes('fn:submit の説明'));
  const [, d09off] = await generate(sampleIr(), ['D02', 'D09']);
  const on = d09Table(d09on).rows.map((r) => r.cells);
  const off = d09Table(d09off).rows.map((r) => r.cells);
  // No. 列と各行の対象（事項）は LLM の有効・無効で一致する（番号がずれない）
  assert.deepEqual(on.map((c) => [c[0], c[2]]), off.map((c) => [c[0], c[2]]));
  // 説明文未生成の行だけ、LLM 有効で選んだ文書の説明文がすべて生成できたら内容が「該当なし」に変わる
  const llmRow = (rows: string[][]) => rows.findIndex((c) => c[2] === '説明文（業務上の意味）');
  const i = llmRow(on);
  assert.ok(i >= 0 && i === llmRow(off));
  assert.equal(on[i]?.[3], LLM_ALL_GENERATED_TEXT);
  assert.equal(off[i]?.[3], 'LLM 無効のため説明文を生成していない。業務上の意味は保守者が確認する');
  assert.deepEqual(on.filter((_, j) => j !== i), off.filter((_, j) => j !== i));
});

function vpSection(doc: Document | undefined, suffix: string): string {
  return JSON.stringify(doc?.sections.find((s) => s.heading.endsWith(suffix)) ?? null);
}

test('P3 #1: 既定動作を止めるハンドラが付いたフォーム・送信ボタンは「画面内で処理（遷移なし）」', async () => {
  const base = sampleIr();
  const submit: EventHandler & { preventsDefault: boolean } = {
    id: 'eh:form', source: [{ file: 'app.js', line: 7 }], target: '#f', uiElementId: 'ui:form', event: 'submit', handler: 'onSubmit', preventsDefault: true,
  };
  const ir: IR = {
    ...base,
    uiElements: [
      ...base.uiElements,
      { id: 'ui:form', source: [{ file: 'index.html', line: 5 }], screenId: 'scr:index', domId: 'f', kind: 'form', constraints: {}, navigatesTo: '#' },
      { id: 'ui:send', source: [{ file: 'index.html', line: 6 }], screenId: 'scr:index', domId: 'send', label: '送信', kind: 'button', constraints: {}, navigatesTo: '#' },
    ],
    eventHandlers: [...base.eventHandlers, submit],
  };
  const [d03] = await generate(ir, ['D03']);
  const tbl = d03?.sections.find((s) => s.heading === '2. 画面遷移')?.blocks.find((b) => b.type === 'table');
  assert.ok(tbl && tbl.type === 'table');
  const { part } = (await import('../src/generate/common.ts')).idMaps(ir);
  for (const id of ['ui:form', 'ui:send']) {
    const r: TableRow | undefined = tbl.rows.find((x: TableRow) => x.cells[1] === part.get(id));
    assert.equal(r?.cells[3], '画面内で処理（遷移なし）', id);
    assert.ok(!r?.cells[4]?.includes('#'), id);
    assert.ok(r?.source.some((x) => x.file === 'app.js' && x.line === 7), id);
  }
  // preventsDefault の無い要素は従来どおり遷移先を書く
  const buy = tbl.rows.find((x) => x.cells[1] === part.get('ui:buy'));
  assert.equal(buy?.cells[4], 'error.html');
});

test('P3 #3・#5: 機能の節は呼び出しで到達する関数のルール・境界・エラー・連携だけを漏れなく載せる', async () => {
  const base = sampleIr();
  const ir: IR = {
    ...base,
    functions: [
      ...base.functions.map((f) => (f.id === 'fn:calc' ? { ...f, calls: [...f.calls, "document.getElementById('qty')", 'fn:post'] } : f)),
      { id: 'fn:post', source: [{ file: 'app.js', line: 40, endLine: 45 }], name: 'post', moduleId: 'mod:app', params: [], complexity: 1, calls: [], exported: false, refCount: 1, async: true, throws: [] },
      { id: 'fn:other', source: [{ file: 'app.js', line: 50, endLine: 55 }], name: 'other', moduleId: 'mod:app', params: [], complexity: 1, calls: [], exported: false, refCount: 0, async: false, throws: [] },
    ],
    rules: [...base.rules, { id: 'rule:other', source: [{ file: 'app.js', line: 51 }], functionId: 'fn:other', name: '到達しない判定', kind: 'if', cases: [] }],
    errors: [...base.errors, { id: 'err:other', source: [{ file: 'app.js', line: 52 }], message: '到達しないエラー', condition: 'x', kind: 'throw', functionId: 'fn:other' }],
    integrations: [{ id: 'int:1', source: [{ file: 'app.js', line: 42 }], direction: 'outbound', mechanism: 'fetch', method: 'POST', url: '/api', timing: 'post', failureConditions: [], functionId: 'fn:post' }],
  };
  const [d02] = await generate(ir, ['D02']);
  assert.ok(!vpSection(d02, '業務ルール／計算式').includes('到達しない判定'));
  assert.ok(!vpSection(d02, 'エラー／例外時の振る舞い').includes('到達しないエラー'));
  // 到達する関数（submit→calc→post）が読む入力欄 qty の境界と、post の連携は載る
  assert.ok(vpSection(d02, '入力値の範囲／境界').includes('256 文字は入力可'));
  assert.ok(vpSection(d02, '画面／入出力項目').includes('int:1'));
  assert.ok(vpSection(d02, '業務ルール／計算式').includes('加熱判定'));
});

test('P3 #4: 解析が条件を確定できなかったエラー（unknownId）と条件が空のエラーは「不明（D09-n）」', async () => {
  const base = sampleIr();
  const net = {
    id: 'err:net', source: [{ file: 'app.js', line: 34 }], message: '通信がタイムアウトしました', condition: '発生条件を確定できない（UNK-x）',
    kind: 'throw' as const, functionId: 'fn:calc', unknownId: 'unk:cond',
  };
  const ir: IR = {
    ...base,
    errors: [...base.errors, net, { id: 'err:empty', source: [{ file: 'app.js', line: 35 }], message: '空条件', condition: '', kind: 'throw', functionId: 'fn:calc' }],
    unknowns: [
      ...base.unknowns,
      { id: 'unk:cond', source: [{ file: 'app.js', line: 34 }], topic: 'タイムアウトの発生条件', question: '到達するか', relatedIds: ['err:net'], category: 'unreachable-or-unknown-condition' as unknown as Unknown['category'] },
    ],
  };
  const [d02, d09] = await generate(ir, ['D02', 'D09']);
  assert.ok(!texts(d02 as Document).includes('発生条件を確定できない（UNK-x）'));
  const list = d02?.sections.find((s) => s.heading === '3. エラー一覧')?.blocks[0];
  assert.ok(list && list.type === 'table');
  const rows = d09Table(d09).rows;
  for (const msg of ['通信がタイムアウトしました', '空条件']) {
    const r: TableRow | undefined = list.rows.find((x) => x.cells[1] === msg);
    assert.match(r?.cells[2] ?? '', /^不明（D09-\d+）$/);
    assert.equal(r?.evidence, 'unknown');
    assert.ok(rows.some((x) => x.cells[0] === r?.d09Ref));
  }
  // unknownId の D09 番号は IR の不明事項の番号で、区分は日本語で出る
  const netRow = list.rows.find((x) => x.cells[1] === '通信がタイムアウトしました');
  const d09Row = rows.find((x) => x.cells[0] === netRow?.d09Ref);
  assert.equal(d09Row?.cells[2], 'タイムアウトの発生条件');
  assert.equal(d09Row?.cells[1], '発生条件を確定できない');
});

test('P3 #6・#11: 同じ対象・同じ区分の不明事項は D09 で 1 件にまとめ、参照元を列挙する', async () => {
  const base = sampleIr();
  const ir: IR = {
    ...base,
    boundaries: [
      ...base.boundaries,
      { id: 'b:qmin', source: [{ file: 'index.html', line: 10 }], subject: '数量', uiElementId: 'ui:qty', bound: 'lower', value: '1', inclusive: true, unit: null, insideExample: '1', outsideExample: '0', configurable: 'fixed' },
      { id: 'b:qmax', source: [{ file: 'index.html', line: 10 }], subject: '数量', uiElementId: 'ui:qty', bound: 'upper', value: '10', inclusive: true, unit: null, insideExample: '10', outsideExample: '11', configurable: 'fixed' },
    ],
    unknowns: [...base.unknowns, { id: 'unk:unit', source: [{ file: 'index.html', line: 10 }], topic: '数量の単位', question: 'min/max の単位', relatedIds: ['ui:qty'], category: 'unit-unknown' }],
  };
  const [d09] = await generate(ir, ['D09']);
  const rows = d09Table(d09).rows.filter((r) => r.cells[1] === '単位不明' && r.cells[6]?.includes('index.html:10'));
  assert.equal(rows.length, 1);
  assert.match(rows[0]?.cells[4] ?? '', /解析結果.*D03/);
});

test('解析の readsUiIds があれば読む部品はそれで決め、文字列推定より優先する', async () => {
  const base = sampleIr();
  const withReads = (reads: string[], extraCall?: string): IR => ({
    ...base,
    functions: base.functions.map((f): FunctionInfo =>
      f.id === 'fn:calc' ? ({ ...f, calls: extraCall ? [...f.calls, extraCall] : f.calls, readsUiIds: reads } as FunctionInfo) : f,
    ),
  });
  const [on] = await generate(withReads(['ui:qty']), ['D02']);
  assert.ok(vpSection(on, '入力値の範囲／境界').includes('256 文字は入力可'));
  const [off] = await generate(withReads([], "document.getElementById('qty')"), ['D02']);
  assert.ok(!vpSection(off, '入力値の範囲／境界').includes('256 文字は入力可'));
});

test('境界の appliesWhen を D02 境界表の「適用条件」列に出す', async () => {
  const base = sampleIr();
  const b = { ...(base.boundaries[1] as Boundary), appliesWhen: "mode === 'keep'" };
  const [d02] = await generate({ ...base, boundaries: [base.boundaries[0] as Boundary, b] }, ['D02']);
  const tbl = d02?.sections.find((s) => s.heading.endsWith('入力値の範囲／境界'))?.blocks[0];
  assert.ok(tbl && tbl.type === 'table');
  const col = tbl.columns.indexOf('適用条件');
  assert.ok(col > 0);
  assert.equal(tbl.rows.find((r) => r.cells[1] === 'timeout')?.cells[col], "mode === 'keep'");
});

test('保存域の valueTypeId があれば D04 に対応する型定義の項目を「推測」で載せる', async () => {
  const base = sampleIr();
  const store = { id: 'dt:store', source: [{ file: 'app.js', line: 36 }], kind: 'localStorage' as const, name: 'reservations', fields: [], valueTypeId: 'dt:R' };
  const type: DataItem = { id: 'dt:R', source: [{ file: 'types.ts', line: 2, endLine: 6 }], kind: 'interface', name: 'Reservation', fields: [{ name: 'no', type: 'string' }] };
  const [d04] = await generate({ ...base, dataItems: [store, type] }, ['D04']);
  const rows = d04?.sections.flatMap((s) => s.blocks).flatMap((b) => (b.type === 'table' ? b.rows : [])) ?? [];
  const r = rows.find((x) => x.cells[0] === 'dt:store');
  assert.ok(r?.cells.some((c) => c.startsWith('no（dt:R から推測）')));
  assert.equal(r?.evidence, 'inference');
  assert.equal(r?.origin, 'analysis');
  assert.ok(r?.source.some((x) => x.file === 'types.ts'));
});

test('項目が取れた保存域でも valueTypeId があれば型定義への対応を「推測」の行で添える', async () => {
  const base = sampleIr();
  const store = { id: 'dt:s2', source: [{ file: 'app.js', line: 36 }], kind: 'localStorage' as const, name: 'r2', fields: [{ name: 'no' }], valueTypeId: 'dt:R' };
  const type: DataItem = { id: 'dt:R', source: [{ file: 'types.ts', line: 2 }], kind: 'interface', name: 'Reservation', fields: [{ name: 'no', type: 'string' }] };
  const [d04] = await generate({ ...base, dataItems: [store, type] }, ['D04']);
  const rows = d04?.sections.flatMap((s) => s.blocks).flatMap((b) => (b.type === 'table' ? b.rows : [])) ?? [];
  const typeRow = rows.find((x) => x.cells[0] === 'dt:s2' && x.cells.includes('dt:R に対応（推測）'));
  assert.equal(typeRow?.evidence, 'inference');
  assert.equal(typeRow?.origin, 'analysis');
  assert.equal(rows.find((x) => x.cells[0] === 'dt:s2' && x.cells[3] === 'no')?.evidence, 'fact');
});

test('D02 の「機能一覧」観点は機能の定義を 2 列の短い表にし、冒頭の一覧を再掲しない', async () => {
  const [d02] = await generate(sampleIr(), ['D02']);
  const s = d02?.sections.find((x) => x.heading === 'F-001-1 機能一覧');
  assert.ok(s);
  const t = s.blocks[0];
  assert.ok(t && t.type === 'table');
  assert.deepEqual(t.columns, ['項目', '内容']);
  assert.deepEqual(t.rows.map((r) => r.cells[0]), ['契機', '引数', '戻り値', '定義位置']);
  assert.equal(t.rows[0]?.cells[1], '#buy の click');
  assert.deepEqual(t.rows[0]?.source, [{ file: 'app.js', line: 5 }]);
  assert.equal(t.rows[3]?.cells[1], 'app.js:10-20');
  for (const r of t.rows) assert.equal(r.evidence, 'fact');
  assert.ok(!JSON.stringify(s).includes('F-001"'), '機能 ID の行を再掲しない');
});

test('LLM 無効の旨は文書冒頭に 1 回（D09 番号付き）。機能ごとの「説明:」段落は出さず、表の説明欄には残す', async () => {
  const [d02, d09] = await generate(sampleIr(), ['D02', 'D09']);
  assert.ok(d02);
  const t = texts(d02);
  assert.ok(!t.includes('説明: '));
  assert.ok(t.includes(LLM_DISABLED_TEXT)); // 機能一覧の説明欄（REQ-F-029）
  const notes = provs(d02).filter((p) => 'text' in p && String((p as { text: string }).text).startsWith('説明文の欄は LLM 無効のため未生成'));
  assert.equal(notes.length, 1);
  const first = d02.sections[0]?.blocks[0];
  assert.ok(first && first.type === 'paragraph' && first.text.startsWith('説明文の欄は LLM 無効のため未生成'));
  assert.equal(first.evidence, 'unknown');
  assert.ok(d09Table(d09).rows.some((r) => r.cells[0] === first.d09Ref && r.cells[4]?.includes('D02')));
  // LLM が説明文を返せば、機能の節に説明の段落が載り、冒頭の注記は出ない
  const mock: LlmClient = {
    enabled: true,
    explain: async (req) => ({ text: `${req.targetId} の説明`, evidence: 'inference', source: [{ file: 'app.js', line: 10 }] }),
    usage: () => ({ inputTokens: 0, outputTokens: 0, requests: 0, sentFiles: [] }),
  };
  const [on] = await generate(sampleIr(), ['D02'], { llm: mock });
  assert.ok(vpSection(on, 'F-001-1 機能一覧').includes('説明: fn:submit の説明'));
  assert.ok(!texts(on as Document).includes('説明文の欄は LLM 無効'));
});

test('無名関数は全文書で「無名関数（ファイル:行）」と表示し、ID は変えない', async () => {
  const base = sampleIr();
  const ir: IR = { ...base, functions: base.functions.map((f) => (f.id === 'fn:submit' ? { ...f, name: '<anonymous@app.js:10>' } : f)) };
  const docs = await generate(ir, ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D11', 'D12']);
  const all = docs.map((d) => texts(d)).join('\n');
  assert.ok(!all.includes('<anonymous@'));
  assert.ok(texts(docs[1] as Document).includes('F-001 無名関数（app.js:10）'));
  assert.ok(all.includes('fn:submit') || all.includes('F-001'));
});

test('同じ節に同じ段落・同じ注記が 2 回以上出たら 1 回にする', async () => {
  const { polishDocument } = await import('../src/generate/index.ts');
  const p = { evidence: 'fact' as const, source: [] };
  const doc: Document = {
    id: 'D02', title: 'x', revision: [],
    sections: [
      {
        heading: 's', level: 2,
        blocks: [
          { type: 'paragraph', text: '注記', ...p },
          { type: 'table', caption: '詳細は D04', columns: ['a'], rows: [{ cells: ['1'], ...p }] },
          { type: 'paragraph', text: '注記', ...p },
          { type: 'table', caption: '詳細は D04', columns: ['a'], rows: [{ cells: ['2'], ...p }] },
        ],
      },
      { heading: 't', level: 2, blocks: [{ type: 'paragraph', text: '注記', ...p }] },
    ],
  };
  const out = polishDocument(doc);
  const s = out.sections[0]!;
  assert.equal(s.blocks.filter((b) => b.type === 'paragraph').length, 1);
  assert.deepEqual(s.blocks.flatMap((b) => (b.type === 'table' ? [b.caption ?? null] : [])), ['詳細は D04', null]);
  assert.equal(out.sections[1]?.blocks.length, 1); // 別の節は対象外
  assert.equal(doc.sections[0]?.blocks.length, 4); // 元の文書は変えない
});

test('全文書の見出しの段: 同格の番号付きの章は同じ level、最上位は 1、親子の差は 1 を超えない', async () => {
  const docs = await generate(sampleIr(), ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D11', 'D12']);
  for (const d of docs) {
    const levels = d.sections.map((s) => s.level);
    assert.equal(Math.min(...levels), 1, `${d.id}: 最上位の章が level 1 でない`);
    assert.equal(levels[0], 1, `${d.id}: 最初の節が level 1 でない`);
    levels.forEach((lv, i) => i > 0 && assert.ok(lv <= (levels[i - 1] ?? 0) + 1, `${d.id}: 段が飛んでいる ${levels.join(',')}`));
    const chapters = d.sections.filter((s) => /^\d+\. /.test(s.heading));
    assert.ok(chapters.every((s) => s.level === 1), `${d.id}: 番号付きの章の level が揃っていない`);
    assert.equal(d.sections.at(-1)?.heading, '改版履歴');
    assert.equal(d.sections.at(-1)?.level, 1);
  }
});

test('入力元を全文書の改版履歴に入れる（絶対パスを出さない）', async () => {
  const { describeSource } = await import('../src/core.ts');
  assert.equal(describeSource({ kind: 'folder', path: '/Users/x/dev/sample-app/' }), 'フォルダ: sample-app');
  assert.equal(describeSource({ kind: 'zip', path: 'C:\\work\\src.zip' }), 'zip: src.zip');
  assert.equal(describeSource({ kind: 'github', url: 'https://github.com/owner/repo.git', ref: 'main' }), 'GitHub: owner/repo@main');
  assert.equal(describeSource({ kind: 'files', paths: ['/a/b.js', '/a/c.js'] }), 'ファイル: 2 件');
  const docs = await generate(sampleIr(), ['D01', 'D04', 'D09'], { source: 'フォルダ: sample-app' });
  for (const d of docs) {
    assert.equal(d.revision[0]?.source, 'フォルダ: sample-app', d.id);
    assert.ok(JSON.stringify(d.sections.at(-1)).includes('入力元: フォルダ: sample-app'), d.id);
  }
  const [plain] = await generate(sampleIr(), ['D01']);
  assert.equal(plain?.revision[0]?.source, undefined);
  assert.ok(!JSON.stringify(plain?.sections.at(-1)).includes('入力元'));
});
