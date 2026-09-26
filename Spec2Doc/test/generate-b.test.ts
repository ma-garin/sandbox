// 生成層その2（D04〜D08・D11・D12）: 手組みの小さな IR で各 builder が表を作り、全行に Provenance が付くこと。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIr, type IR, type SourceRef } from '../src/ir/schema.ts';
import type { Document, TableBlock, TableRow } from '../src/doc/model.ts';
import { D09Registry, type GenCtx } from '../src/generate/common.ts';
import { disabledLlm } from '../src/llm/index.ts';
import { buildD04 } from '../src/generate/d04.ts';
import { buildD05 } from '../src/generate/d05.ts';
import { buildD06 } from '../src/generate/d06.ts';
import { buildD07 } from '../src/generate/d07.ts';
import { buildD08 } from '../src/generate/d08.ts';
import { buildD11 } from '../src/generate/d11.ts';
import { buildD12, FLOW_HEADING, conditionCell } from '../src/generate/d12.ts';

const at = (file: string, line: number, endLine?: number): SourceRef[] => [{ file, line, ...(endLine ? { endLine } : {}) }];
const fn = (id: string, name: string, line: number, extra: Partial<IR['functions'][number]> = {}): IR['functions'][number] => ({
  id, name, moduleId: 'mod:app', params: [], complexity: 1, calls: [], exported: false, refCount: 1, async: false, throws: [], source: at('app.ts', line, line + 5), ...extra,
});

function sampleIr(): IR {
  const ir = emptyIr({ kind: 'folder', label: 'sample', commit: 'abc123' }, '2026-09-25T00:00:00Z');
  return {
    ...ir,
    files: [
      { id: 'file:app.ts', path: 'app.ts', language: 'typescript', status: 'analyzed', lines: 200, source: at('app.ts', 1), secrets: [{ line: 3, kind: 'api-key' }] },
      { id: 'file:index.html', path: 'index.html', language: 'html', status: 'analyzed', lines: 40, source: at('index.html', 1) },
      { id: 'file:bad.js', path: 'bad.js', language: 'javascript', status: 'failed', lines: 10, reason: '構文エラー', source: at('bad.js', 1) },
      { id: 'file:dist/x.js', path: 'dist/x.js', language: 'javascript', status: 'excluded', lines: 5, reason: '生成物', source: at('dist/x.js', 1) },
      { id: 'file:logo.png', path: 'logo.png', language: 'other', status: 'unsupported', lines: 0, source: at('logo.png', 1) },
    ],
    modules: [
      { id: 'mod:app', name: 'app', file: 'app.ts', kind: 'esmodule', source: at('app.ts', 1) },
      { id: 'mod:util', name: 'util', file: 'util.ts', kind: 'esmodule', source: at('util.ts', 1) },
    ],
    imports: [
      { id: 'imp:1', moduleId: 'mod:app', from: './util.ts', names: ['fmt'], external: false, source: at('app.ts', 2) },
      { id: 'imp:2', moduleId: 'mod:app', from: 'dayjs', names: ['default'], external: true, source: at('app.ts', 1) },
    ],
    functions: [
      fn('fn:main', 'main', 10, { calls: ['fn:load', 'fn:save'], refCount: 1, throws: ['err:net'] }),
      fn('fn:load', 'load', 30, { calls: ['fn:save'], params: [{ name: 'key', type: 'string' }], returns: 'Promise<Item>', async: true }),
      fn('fn:save', 'save', 50, { complexity: 12 }),
      fn('fn:dead1', 'dead1', 70, { refCount: 0 }),
      fn('fn:dead2', 'dead2', 80, { refCount: 0 }),
    ],
    eventHandlers: [{ id: 'ev:1', target: '#go', event: 'click', handler: 'fn:main', source: at('app.ts', 100) }],
    globals: [{ id: 'g:count', name: 'count', kind: 'var', source: at('app.ts', 5) }],
    dataItems: [
      { id: 'data:ls:items', kind: 'localStorage', name: 'items', fields: [], source: at('app.ts', 32) },
      { id: 'data:ls:user', kind: 'localStorage', name: 'user', fields: [], source: at('app.ts', 34) },
      { id: 'data:if:Item', kind: 'interface', name: 'Item', fields: [{ name: 'id', type: 'string' }, { name: 'qty', type: 'number' }, { name: 'price', type: 'number' }, { name: 'note', type: 'string', optional: true }], source: at('app.ts', 20) },
      { id: 'data:layout:code', kind: 'layout', name: 'code', fields: [{ name: 'a', length: 12 }, { name: 'b', length: 3 }], separator: '#', example: '000000000001#001', source: at('app.ts', 52) },
    ],
    states: [{ id: 'st:mode', variable: 'mode', mechanism: 'variable', values: ['idle', 'busy'], initial: 'idle', transitions: [{ from: 'idle', trigger: 'click', to: 'busy', source: at('app.ts', 12) }], source: at('app.ts', 6) }],
    boundaries: [
      { id: 'b:qty', subject: 'qty', bound: 'upper', value: '99', inclusive: true, unit: null, insideExample: '99', outsideExample: '100', configurable: 'fixed', source: at('app.ts', 40) },
      { id: 'b:to', subject: 'int:api', bound: 'timeout', value: '5000', inclusive: null, unit: 'ms', insideExample: '', outsideExample: '', configurable: 'config', configSource: at('config.json', 2)[0], source: at('app.ts', 36) },
      { id: 'b:poll', subject: 'poller', bound: 'interval', value: '30', inclusive: null, unit: 's', insideExample: '', outsideExample: '', configurable: 'fixed', source: at('app.ts', 90) },
    ],
    integrations: [
      { id: 'int:api', direction: 'outbound', mechanism: 'fetch', method: 'GET', url: '/api/items', timing: 'load', response: 'JSON', failureConditions: ['HTTP 5xx', 'タイムアウト'], timeoutMs: 5000, retries: 3, functionId: 'fn:load', source: at('app.ts', 35) },
    ],
    errors: [{ id: 'err:net', message: '通信に失敗しました', condition: 'fetch 失敗', kind: 'network', functionId: 'fn:main', source: at('app.ts', 15) }],
    dependencies: [
      { id: 'dep:dayjs', name: 'dayjs', version: '1.11.0', loadedFrom: 'package.json', source: at('package.json', 5) },
      { id: 'dep:cdn', name: 'chart', version: null, loadedFrom: 'cdn', url: 'https://cdn.example/chart.js', source: at('index.html', 8) },
    ],
    cssRules: [{ id: 'css:1', kind: 'media', media: { feature: 'max-width', value: '600px', inclusive: true }, selector: '.a', declarations: {}, source: at('style.css', 1) }],
  };
}

const newCtx = (): GenCtx => ({ llm: disabledLlm, d09: new D09Registry(), generatedAt: '2026-09-25T00:00:00Z', commit: 'abc123' });

const tables = (d: Document): TableBlock[] => d.sections.filter((s) => s.heading !== '改版履歴').flatMap((s) => s.blocks.filter((b): b is TableBlock => b.type === 'table'));
const sectionTable = (d: Document, heading: string): TableBlock => {
  const s = d.sections.find((x) => x.heading === heading);
  const t = s?.blocks.find((b): b is TableBlock => b.type === 'table');
  assert.ok(t, `${d.id} の「${heading}」に表がある`);
  return t;
};

function assertProvenance(d: Document): void {
  for (const s of d.sections) {
    for (const b of s.blocks) {
      const rows: { evidence: string; source: SourceRef[]; d09Ref?: string; irIds?: string[] }[] =
        b.type === 'table' ? b.rows : b.type === 'list' ? b.items : b.type === 'diagram' ? [b.provenance] : [b];
      for (const r of rows) {
        assert.ok(['fact', 'inference', 'unknown'].includes(r.evidence), `${d.id}/${s.heading}: 根拠ラベルがある`);
        if (r.evidence === 'unknown') assert.match(r.d09Ref ?? '', /^D09-\d+$/, `${d.id}/${s.heading}: 不明には D09 番号`);
        if (r.evidence === 'fact' && (r.irIds ?? []).length > 0) assert.ok(r.source.length > 0, `${d.id}/${s.heading}: 事実にはソース位置`);
      }
    }
  }
  const last = d.sections.at(-1);
  assert.equal(last?.heading, '改版履歴');
  assert.deepEqual(d.revision[0], { generatedAt: '2026-09-25T00:00:00Z', commit: 'abc123', changedSections: [] });
}

const cellsOf = (t: TableBlock): string[] => t.rows.flatMap((r: TableRow) => r.cells);

test('D04: キー 2 個・interface の 4 項目・レイアウト「12 桁＋3 桁＋区切り #」・単位不明は D09', () => {
  const ctx = newCtx();
  const d = buildD04(sampleIr(), ctx);
  assertProvenance(d);
  const items = sectionTable(d, 'データ項目定義');
  assert.equal(items.rows.filter((r) => r.cells[1] === 'localStorage のキー').length, 2);
  assert.equal(items.rows.filter((r) => r.cells[0] === 'data:if:Item').length, 4);
  assert.ok(cellsOf(sectionTable(d, 'レコードレイアウト')).includes('12 桁＋3 桁＋区切り `#`'));
  assert.equal(sectionTable(d, 'データの状態と遷移').rows.length, 1);
  const limit = sectionTable(d, '使用制限').rows[0];
  assert.equal(limit?.evidence, 'unknown');
  assert.match(limit?.cells[4] ?? '', /^単位不明（D09-\d+）$/);
  assert.ok(ctx.d09.entries().some((e) => e.category === 'unit-unknown'));
});

test('D05: 連携の組・定期通信・異常条件。数値は単位と固定／設定付き', () => {
  const d = buildD05(sampleIr(), newCtx());
  assertProvenance(d);
  const pair = sectionTable(d, '連携の組').rows[0];
  assert.equal(pair?.cells[0], 'int:api');
  assert.match(pair?.cells[7] ?? '', /^5000 ms・設定で変更可（config\.json:2）$/);
  assert.match(pair?.cells[8] ?? '', /^3 回・固定／設定不明（D09-\d+）$/);
  assert.equal(sectionTable(d, '異常と判断する条件').rows.length, 2);
  assert.equal(sectionTable(d, '定期通信').rows[0]?.cells[3], '30');
});

test('D06: 名前・版・読み込み元。版不明は D09', () => {
  const d = buildD06(sampleIr(), newCtx());
  assertProvenance(d);
  const rows = sectionTable(d, '依存ライブラリ').rows;
  assert.equal(rows.length, 2);
  assert.match(rows.find((r) => r.cells[1] === 'chart')?.cells[2] ?? '', /^版不明（D09-\d+）$/);
});

test('D07: 未参照 2・複雑度 12 の 1・大域変数 1 の 4 件が区分と根拠位置付きで載る', () => {
  const d = buildD07(sampleIr(), newCtx());
  assertProvenance(d);
  const rows = sectionTable(d, '移行論点一覧').rows;
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.cells[1]), ['未参照の関数', '未参照の関数', '複雑度 10 超', '大域変数']);
  for (const r of rows) assert.ok((r.cells[5] ?? '').length > 0 && r.source.length > 0);
});

test('D08: 4 区分の件数の合計が入力ファイル数と一致し、記述 ID からソース位置へたどれる', () => {
  const ir = sampleIr();
  const d = buildD08(ir, newCtx());
  assertProvenance(d);
  const counts = sectionTable(d, 'ファイル別の解析結果').rows;
  const four = counts.slice(0, 4).reduce((n, r) => n + Number(r.cells[1]), 0);
  assert.equal(four, ir.files.length);
  assert.equal(counts[4]?.cells[1], String(ir.files.length));
  const fwd = sectionTable(d, '記述→ソース位置').rows.find((r) => r.cells[0] === 'fn:save');
  assert.equal(fwd?.cells[3], 'app.ts:50-55');
  assert.ok(sectionTable(d, 'ソース→記述').rows.some((r) => r.cells[0] === 'app.ts' && r.cells[2]?.includes('fn:save')));
});

test('D11: 5 章があり、外部 I/F は D05 の ID で参照し D05 と同じ行を持たない', () => {
  const ir = sampleIr();
  const d11 = buildD11(ir, newCtx());
  assertProvenance(d11);
  for (const h of ['システム方式', 'アーキテクチャ', 'モジュール構成', '外部 I/F', '非機能の実装方式']) sectionTable(d11, h);
  assert.deepEqual(sectionTable(d11, '外部 I/F').rows.map((r) => r.cells[1]), ['D05 int:api']);
  assert.equal(sectionTable(d11, 'アーキテクチャ').rows[0]?.cells[2], 'mod:util');
  const d05Rows = new Set(tables(buildD05(ir, newCtx())).flatMap((t) => t.rows.map((r) => r.cells.join('|'))));
  assert.equal(tables(d11).flatMap((t) => t.rows).filter((r) => d05Rows.has(r.cells.join('|'))).length, 0);
});

test('D12: 全関数の入出力・処理フロー、呼び出しシーケンス、例外は D02 のエラー ID で参照', () => {
  const ir = sampleIr();
  const d = buildD12(ir, newCtx());
  assertProvenance(d);
  assert.equal(sectionTable(d, '関数一覧と入出力').rows.length, ir.functions.length);
  assert.equal(sectionTable(d, FLOW_HEADING).rows.length, ir.functions.length);
  const loadFlow = sectionTable(d, FLOW_HEADING).rows.find((r) => r.cells[0] === 'fn:load')?.cells[2] ?? '';
  assert.match(loadFlow, /連携 D05 int:api/);
  assert.match(loadFlow, /データ D04 data:ls:items/);
  const seq = sectionTable(d, '呼び出しのシーケンス').rows.filter((r) => r.cells[0] === 'SEQ-ev:1');
  assert.ok(seq.length >= 3);
  assert.deepEqual(sectionTable(d, '例外処理').rows.map((r) => r.cells[1]), ['D02 err:net']);
});

test('同じ IR で 2 回生成しても D09 番号と表が変わらない', () => {
  const a = buildD05(sampleIr(), newCtx());
  const b = buildD05(sampleIr(), newCtx());
  assert.deepEqual(a, b);
});

test('D12: 処理フローの見出しと冒頭段落に「区分順・ソースの実行順ではない」と明記する', () => {
  const s = buildD12(sampleIr(), newCtx()).sections.find((x) => x.heading.startsWith('処理フロー'));
  assert.match(s?.heading ?? '', /区分順.*ソースの実行順ではない/);
  const first = s?.blocks[0];
  assert.equal(first?.type, 'paragraph');
  assert.match(first?.type === 'paragraph' ? first.text : '', /^区分順（分岐→データ→連携→呼び出し→例外）。ソースの実行順ではない/);
});

test('固定／設定の判定は 1 か所: 同じ const リテラルを D05 と D11 が同じく「コード固定」とし、D09 に送らない', () => {
  const base = sampleIr();
  const ir: IR = {
    ...base,
    boundaries: base.boundaries.map((b) => (b.id === 'b:to' ? { ...b, configurable: 'fixed' as const, source: at('app.ts', 5) } : b)),
    defaults: [{ id: 'def:retries', subject: 'MAX_RETRIES', value: '3', context: 'variable', source: at('app.ts', 6) }],
  };
  const ctx = newCtx();
  const pair = sectionTable(buildD05(ir, ctx), '連携の組').rows[0];
  assert.equal(pair?.cells[7], '5000 ms・コード固定（app.ts:5）');
  assert.equal(pair?.cells[8], '3 回・コード固定（app.ts:6）');
  assert.equal(pair?.evidence, 'fact');
  const nfr = sectionTable(buildD11(ir, ctx), '非機能の実装方式').rows.find((r) => r.cells[0] === 'タイムアウト');
  assert.equal(nfr?.cells[3], 'コード固定（app.ts:5）');
  assert.equal(ctx.d09.entries().filter((e) => e.question.includes('コード固定か設定で変更可か')).length, 0);
});

test('D12: エラーの発生条件が無い・「条件分岐なし」のときは断定せず「不明（D09-n）」', () => {
  const base = sampleIr();
  const ir: IR = { ...base, errors: base.errors.map((e) => ({ ...e, condition: 'postWithRetry の実行時（条件分岐なし）' })) };
  const ctx = newCtx();
  const r = sectionTable(buildD12(ir, ctx), '例外処理').rows[0];
  assert.match(r?.cells[3] ?? '', /^不明（D09-\d+）$/);
  assert.equal(r?.evidence, 'unknown');
  assert.doesNotMatch(JSON.stringify(buildD12(ir, newCtx())), /条件分岐なし/);
  assert.match(conditionCell({ ...base.errors[0]!, condition: '' }, newCtx()).text, /^不明（D09-\d+）$/);
});

test('D04: 保存域のキーで値の構造が読めないときは「—」でなく D09 へ', () => {
  const r = sectionTable(buildD04(sampleIr(), newCtx()), 'データ項目定義').rows.find((x) => x.cells[0] === 'data:ls:items');
  assert.match(r?.cells[3] ?? '', /^値の構造不明（D09-\d+）$/);
  assert.equal(r?.evidence, 'unknown');
});

// ---------- D04 CRUD 表（改修 B） ----------
test('D04: CRUD 表は機能ごとに推移的に到達する操作を集約し、どの機能からも使われないデータを D09 に登録する', () => {
  const base = sampleIr();
  const acc = (functionId: string, op: string, line: number, evidence = 'fact') => ({ functionId, op, source: at('app.ts', line)[0], evidence });
  const ir: IR = {
    ...base,
    dataItems: base.dataItems.map((d) =>
      d.id === 'data:ls:items' ? { ...d, access: [acc('fn:load', 'R', 32), acc('fn:save', 'C/U', 55, 'inference')] }
        : d.id === 'data:ls:user' ? { ...d, access: [acc('fn:dead1', 'R', 72)] } : d),
    integrations: base.integrations.map((i) => ({ ...i, resource: '/api/items', access: [acc('fn:load', 'R', 35)] })),
  };
  const ctx = newCtx();
  const d = buildD04(ir, ctx);
  const t = sectionTable(d, 'CRUD 表');
  assert.deepEqual(t.columns, ['機能ID', '機能名', 'items（localStorage）', 'user（localStorage）', 'API /api/items']);
  assert.equal(t.rows.length, 1);
  assert.deepEqual(t.rows[0]?.cells, ['F-001', 'main', 'C/U R', '—', 'R']);
  assert.equal(t.rows[0]?.evidence, 'inference');
  const unused = tables(d).find((x) => x.caption === 'どの機能からも使われないデータ');
  assert.ok(unused, '未使用データの表');
  assert.equal(unused.rows[0]?.cells[0], 'data:ls:user');
  assert.match(unused.rows[0]?.cells[3] ?? '', /D09/);
  assertProvenance(d);
});

test('D05: 異常条件の行は解析が残した行ごとの位置で事実になり、連携の確度（推測）を引き継がない', () => {
  const base = sampleIr();
  const ir: IR = {
    ...base,
    integrations: base.integrations.map((i) => ({ ...i, evidence: 'inference' as const, failureSources: [at('app.ts', 40)[0], at('app.ts', 44)[0]] })),
  };
  const t = sectionTable(buildD05(ir, newCtx()), '異常と判断する条件');
  assert.deepEqual(t.rows.map((r) => [r.cells[3], r.evidence]), [['app.ts:40', 'fact'], ['app.ts:44', 'fact']]);
  const plain = sectionTable(buildD05({ ...base, integrations: base.integrations.map((i) => ({ ...i, evidence: 'inference' as const })) }, newCtx()), '異常と判断する条件');
  assert.ok(plain.rows.every((r) => r.evidence === 'inference'), '位置が無ければ従来どおり連携の確度');
});

test('D05: 呼び出し箇所ごとの連携は異常条件を共通の送信処理の行に任せ、2 重に載せない。共通の送信処理は名前で区別し、別ファイルの呼び出しを D09 に 1 件', () => {
  const base = sampleIr();
  const w = { ...base.integrations[0]!, id: 'int:wrap', url: '/api{url}', functionId: 'fn:save', failureConditions: ['!res.ok', 'タイムアウト'] };
  const d = { ...w, id: 'int:call', url: '/api/items', functionId: 'fn:main', evidence: 'inference' as const, source: [...at('app.ts', 12), ...w.source], wrapperOf: 'int:wrap' };
  const ir: IR = { ...base, functions: base.functions.map((f) => (f.id === 'fn:save' ? { ...f, params: [{ name: 'url' }] } : f)), integrations: [w, d] };
  const ctx = newCtx();
  const doc = buildD05(ir, ctx);
  const fail = sectionTable(doc, '異常と判断する条件');
  assert.deepEqual(fail.rows.map((r) => [r.cells[0], r.cells[2]]), [
    ['int:wrap', '!res.ok'],
    ['int:wrap', 'タイムアウト'],
    ['int:call', '異常条件: 共通の送信処理（int:wrap）に同じ'],
  ]);
  const pairs = sectionTable(doc, '連携の組');
  assert.deepEqual(pairs.rows.map((r) => r.cells[3]), ['共通の送信処理 save（/api{url}）', '/api/items']);
  assert.equal(ctx.d09.entries().filter((e) => e.question.includes('別ファイルからの呼び出しの URL は未解決')).length, 1, 'D09 に 1 件');
});
