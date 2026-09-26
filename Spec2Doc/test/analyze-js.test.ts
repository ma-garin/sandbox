// JS/TS 解析器の受入テスト（REQ-F-006・009〜014・024・033・034・036・037）。入力は fixtures/sample-app。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeJsTs, type JsInputFile } from '../src/analyze/js.ts';
import type { Condition } from '../src/ir/schema.ts';

const root = join(import.meta.dirname, '..', 'fixtures', 'sample-app');
const load = (p: string): JsInputFile => ({ path: p, abs: join(root, p), text: readFileSync(join(root, p), 'utf8') });
const files = [load('app.js'), load('types.ts')];
const ir = analyzeJsTs(files);

test('状態・境界・ルール・エラー・連携・保存域キーが各 1 件以上取れる', () => {
  assert.ok(ir.states.length >= 1);
  assert.ok(ir.boundaries.length >= 1);
  assert.ok(ir.rules.length >= 1);
  assert.ok(ir.errors.length >= 1);
  assert.ok(ir.integrations.length >= 1);
  assert.ok(ir.dataItems.some((d) => d.kind === 'localStorage'));
  assert.equal(ir.failed.length, 0);
});

test('REQ-F-006: 関数・イベント登録・export が根拠位置付きで取れる', () => {
  const names = ir.functions.map((f) => f.name);
  for (const n of ['init', 'setState', 'calcPrice', 'validate', 'postWithRetry', 'onSubmit', 'exportCsv']) assert.ok(names.includes(n), n);
  const events = ir.eventHandlers.map((h) => `${h.target}:${h.event}`);
  for (const e of ['#calc-button:click', '#order-form:submit', '#ticket-type:change', 'document:DOMContentLoaded']) assert.ok(events.includes(e), e);
  const submit = ir.eventHandlers.find((h) => h.event === 'submit');
  assert.equal(submit?.handler, ir.functions.find((f) => f.name === 'onSubmit')?.id);
  const onSubmit = ir.functions.find((f) => f.name === 'onSubmit');
  assert.ok(onSubmit?.calls.includes(ir.functions.find((f) => f.name === 'validate')?.id ?? '?'));
  assert.deepEqual(ir.exports.filter((e) => e.source[0]?.file === 'types.ts').map((e) => e.name).sort(), ['AppConfig', 'AppState', 'Reservation', 'TicketType']);
});

test('REQ-F-024: 未参照関数・複雑度 10 超・大域変数', () => {
  assert.equal(ir.functions.find((f) => f.name === 'exportCsv')?.refCount, 0);
  assert.ok((ir.functions.find((f) => f.name === 'init')?.refCount ?? 0) > 0);
  assert.ok((ir.functions.find((f) => f.name === 'validate')?.complexity ?? 0) > 10);
  const globals = ir.globals.map((g) => `${g.name}:${g.kind}`);
  for (const g of ['retryCount:var', 'state:let', 'STORAGE_KEY:const']) assert.ok(globals.includes(g), g);
  assert.ok(!ir.globals.some((g) => g.source[0]?.file === 'types.ts'));
});

test('REQ-F-009・036: switch の 4 規則と AND/OR の入れ子の条件木・計算式', () => {
  const sw = ir.rules.find((r) => r.kind === 'switch' && r.name.startsWith('calcPrice'));
  assert.equal(sw?.cases.length, 4);
  assert.equal(sw?.cases[3]?.condition, null);
  const iff = ir.rules.find((r) => r.kind === 'if' && r.name.startsWith('calcPrice'));
  const second = iff?.cases[1]?.condition as Condition;
  assert.equal(second.op, 'or');
  const items = (second as { items: Condition[] }).items;
  assert.equal(items[1]?.op, 'and');
  assert.ok(ir.rules.some((r) => r.kind === 'formula' && r.formula === '戻り値 = Math.floor(unit * rate) * qty'));
});

test('REQ-F-010・033: 下限（含む）・上限（含まない）・文字数・正規表現の内側/外側の例', () => {
  const age = ir.boundaries.filter((b) => b.subject === 'age' && (b.bound === 'lower' || b.bound === 'upper'));
  const lower = age.find((b) => b.bound === 'lower');
  const upper = age.find((b) => b.bound === 'upper');
  assert.deepEqual([lower?.value, lower?.inclusive, lower?.insideExample, lower?.outsideExample], ['0', true, '0', '-1']);
  assert.deepEqual([upper?.value, upper?.inclusive, upper?.insideExample, upper?.outsideExample], ['120', false, '119', '120']);
  const len = ir.boundaries.find((b) => b.subject === 'name' && b.bound === 'length');
  assert.deepEqual([len?.value, len?.inclusive, len?.unit, len?.insideExample, len?.outsideExample], ['40', true, '文字', '40 文字', '41 文字']);
  const coupon = ir.boundaries.find((b) => b.subject === 'coupon' && b.bound === 'pattern');
  assert.ok(coupon && new RegExp('^[A-Z0-9]{8}$').test(coupon.insideExample) && !/^[A-Z0-9]{8}$/.test(coupon.outsideExample));
  const email = ir.boundaries.find((b) => b.subject === 'email' && b.bound === 'pattern');
  assert.ok(email && email.insideExample.includes('@'));
});

test('REQ-F-034: タイムアウト・再試行の値と単位、単位不明は unknowns へ', () => {
  const t = ir.boundaries.find((b) => b.subject === 'TIMEOUT_MS');
  assert.deepEqual([t?.bound, t?.value, t?.unit, t?.configurable], ['timeout', '5000', 'ms', 'fixed']);
  const r = ir.boundaries.find((b) => b.subject === 'MAX_RETRIES');
  assert.deepEqual([r?.bound, r?.value, r?.unit], ['retry', '3', '回']);
  const units = ir.unknowns.filter((u) => u.category === 'unit-unknown');
  assert.equal(units.length, 1);
  assert.ok(units[0]?.question.includes('age=120（91 行）'));
  const magic = ir.unknowns.filter((u) => u.category === 'magic-number');
  assert.equal(magic.length, 1);
  assert.ok(magic[0]?.question.includes('calcPrice の 2000（57 行）'));
  assert.ok(magic[0]?.source.some((s) => s.line === 57));
  assert.ok(!units[0]?.question.includes('2000'));
});

test('REQ-F-011: 状態変数・合併型・classList と遷移', () => {
  const st = ir.states.find((s) => s.variable === 'state');
  assert.deepEqual([...(st?.values ?? [])].sort(), ['done', 'error', 'idle', 'loading']);
  assert.equal(st?.initial, 'idle');
  assert.ok(st?.transitions.some((t) => t.to === 'loading' && t.trigger.startsWith('onSubmit')));
  assert.ok(ir.states.some((s) => s.mechanism === 'union-type' && s.variable === 'AppState' && s.values.length === 4));
  assert.ok(ir.states.some((s) => s.mechanism === 'classList' && s.variable === '#error-message.classList'));
});

test('REQ-F-012: 例外・検証・通信失敗のエラー文言と発生条件・発生後の状態', () => {
  const bad = ir.errors.find((e) => e.message === '券種が不正です');
  assert.equal(bad?.kind, 'throw');
  assert.equal(bad?.condition, 'type がどの case にも該当しない');
  assert.ok(ir.errors.some((e) => e.kind === 'validation' && e.message === '氏名は 40 文字以内で入力してください' && e.condition === 'name.length > 40'));
  const net = ir.errors.find((e) => e.message.startsWith('予約に失敗しました'));
  assert.deepEqual([net?.kind, net?.afterState], ['network', 'error']);
  assert.ok(ir.errors.some((e) => e.message === 'サーバーでエラーが発生しました（{res.status}）'));
});

test('REQ-F-013: fetch の方式・URL・タイムアウト・再試行・異常条件', () => {
  const f = ir.integrations.find((i) => i.mechanism === 'fetch');
  assert.deepEqual([f?.direction, f?.method, f?.url, f?.timeoutMs, f?.retries], ['outbound', 'POST', '/api{url}', 5000, 3]);
  assert.equal(f?.evidence, 'inference', '引数 url の部分は実行時にしか決まらないので推測');
  assert.ok(f?.failureConditions.includes('res.status === 409'));
  assert.ok(f?.timing.includes('onSubmit'));
});

test('REQ-F-014・037: 保存域キー・interface の項目と桁・レイアウト・既定値', () => {
  const keys = ir.dataItems.filter((d) => d.kind === 'localStorage').map((d) => d.name).sort();
  assert.deepEqual(keys, ['lastTicketType', 'reservations']);
  const res = ir.dataItems.find((d) => d.kind === 'interface' && d.name === 'Reservation');
  assert.equal(res?.fields.length, 4);
  assert.equal(res?.fields[0]?.length, 12);
  const lay = ir.dataItems.find((d) => d.kind === 'layout');
  assert.deepEqual([lay?.fields.map((f) => f.length), lay?.separator], [[12, 3], '#']);
  assert.ok(ir.defaults.some((d) => d.subject === 'state' && d.value === 'idle' && d.context === 'variable'));
  assert.ok(ir.defaults.some((d) => d.subject === 'ticketType' && d.value === 'day' && d.context === 'init'));
});

test('全要素に安定した一意の id・根拠位置・evidence=fact（URL に引数の部分が残る連携だけ推測）', () => {
  const again = analyzeJsTs(files);
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(ir)));
  const all = [ir.modules, ir.functions, ir.classes, ir.imports, ir.exports, ir.eventHandlers, ir.rules, ir.boundaries, ir.states, ir.errors, ir.integrations, ir.dataItems, ir.defaults, ir.globals, ir.unknowns].flat();
  assert.equal(new Set(all.map((n) => n.id)).size, all.length);
  for (const n of all) {
    const runtimeUrl = ir.integrations.includes(n as never) && (/\{[^}]+\}/.test((n as { url: string }).url) || 'wrapperOf' in n);
    assert.equal(n.evidence, ir.unknowns.includes(n as never) ? 'unknown' : runtimeUrl ? 'inference' : 'fact', n.id);
    assert.ok(n.source[0] && n.source[0].line >= 1, n.id);
  }
});

test('構文失敗は例外にせず、そのファイルだけ failed と unknowns に積む', () => {
  const r = analyzeJsTs([{ path: 'broken.js', abs: '/x/broken.js', text: 'function (' }, ...files]);
  assert.deepEqual(r.failed.map((f) => f.path), ['broken.js']);
  assert.ok(r.unknowns.some((u) => u.category === 'parse-failure' && u.source[0]?.file === 'broken.js'));
  assert.ok(r.functions.some((f) => f.name === 'calcPrice'));
  assert.ok(r.unknowns.every((u) => u.evidence === 'unknown'));
});

test('大域変数: module の最上位宣言は数えず、スクリプトの let/const は数える', () => {
  const r = analyzeJsTs([
    { path: 'm.js', abs: '/x/m.js', text: "import a from './a.js';\nlet x = 1;\nconst Y = 2;\nexport { x };" },
    { path: 's.js', abs: '/x/s.js', text: 'let x = 1;\nconst Y = 2;\nvar z = 3;' },
  ]);
  assert.deepEqual(r.globals.map((g) => `${g.source[0]?.file}:${g.name}:${g.kind}`), ['s.js:x:let', 's.js:Y:const', 's.js:z:var']);
});

test('単位不明と意味不明の数値を区分ごと・ファイルごとに 1 件へ集約する', () => {
  const r = analyzeJsTs([
    { path: 'a.js', abs: '/x/a.js', text: 'function f(v) {\n  if (v > 50) return v * 7;\n  return 3;\n}' },
    { path: 'b.js', abs: '/x/b.js', text: 'function g(w) {\n  return w < 9 ? 4 : 5;\n}' },
  ]);
  const units = r.unknowns.filter((u) => u.category === 'unit-unknown');
  const magic = r.unknowns.filter((u) => u.category === 'magic-number');
  assert.deepEqual(units.map((u) => u.source[0]?.file), ['a.js', 'b.js']);
  assert.deepEqual(magic.map((u) => u.source[0]?.file), ['a.js', 'b.js']);
  assert.ok(units[0]?.question.includes('v=50（2 行）') && !units[0]?.question.includes('f の 7'));
  assert.ok(magic[0]?.question.includes('f の 7（2 行）') && magic[0]?.question.includes('f の 3（3 行）'));
  assert.ok(magic[1]?.question.includes('g の 4（2 行）') && units[1]?.question.includes('w=9（2 行）'));
});

test('P3 #1: ハンドラが引数の event に preventDefault() を呼ぶかを載せる', () => {
  const pd = (ev: string): boolean | undefined => (ir.eventHandlers.find((h) => h.event === ev) as { preventsDefault?: boolean } | undefined)?.preventsDefault;
  assert.equal(pd('submit'), true);
  assert.equal(pd('click'), false);
  assert.equal(pd('change'), false);
});

test('P3 #4: 到達しないエラーは発生条件を空にせず、理由付きの unknowns を参照する', () => {
  const e = ir.errors.find((x) => x.message === '通信がタイムアウトしました') as { condition: string; unknownId?: string; id: string } | undefined;
  assert.ok(e?.unknownId);
  assert.ok(e.condition !== '' && !e.condition.includes('条件分岐なし'));
  const u = ir.unknowns.find((x) => x.id === e.unknownId);
  assert.equal(u?.category, 'unreachable-or-unknown-condition' as never);
  assert.ok(u?.question.includes('retryCount === MAX_RETRIES') && u.relatedIds.includes(e.id));
  const r = analyzeJsTs([{ path: 'l.js', abs: '/x/l.js', text: "function f(g) {\n  for (let i = 0; i < 3; i++) {\n    if (g()) return 1;\n  }\n  throw new Error('尽きた');\n}" }]);
  const le = r.errors[0] as { condition: string; unknownId?: string } | undefined;
  assert.equal(le?.condition, 'ループ（i < 3）を最後まで回り、条件が偽になったとき');
  assert.equal(le?.unknownId, undefined);
});

test('P3 #8・#9・#10: 境界の適用条件・起動時の遷移元・保存域の値の項目と型', () => {
  const q1 = ir.boundaries.find((b) => b.subject === 'qty' && b.value === '1' && b.source[0]?.line === 94) as { appliesWhen?: string } | undefined;
  assert.equal(q1?.appliesWhen, "ticketType === 'annual'");
  const q10 = ir.boundaries.find((b) => b.subject === 'qty' && b.value === '10') as { appliesWhen?: string } | undefined;
  assert.equal(q10?.appliesWhen, undefined);
  const st = ir.states.find((s) => s.variable === 'state');
  assert.equal(st?.transitions.find((t) => t.to === 'idle')?.from, '（起動時）');
  const res = ir.dataItems.find((d) => d.kind === 'localStorage' && d.name === 'reservations') as { fields: { name: string }[]; valueTypeId?: string } | undefined;
  assert.deepEqual(res?.fields.map((f) => f.name), ['reservationNo', 'ticketType', 'quantity', 'total']);
  assert.equal(res?.valueTypeId, ir.dataItems.find((d) => d.kind === 'interface' && d.name === 'Reservation')?.id);
});

test('readsUiIds: 関数が読む画面部品の id/name を文字列リテラルから集める', () => {
  const reads = (name: string): string[] => (ir.functions.find((f) => f.name === name) as { readsUiIds?: string[] } | undefined)?.readsUiIds ?? [];
  assert.deepEqual(reads('onCalcClick'), ['order-form', 'age', 'qty', 'total']);
  assert.deepEqual(reads('validate'), ['name', 'email', 'age', 'qty', 'coupon']);
  assert.ok(reads('init').includes('ticket-type') && reads('init').includes('order-form'));
  assert.deepEqual(reads('calcPrice'), []);
  const r = analyzeJsTs([{ path: 'u.js', abs: '/x/u.js', text: "function f(e, k) {\n  const f2 = e.target.elements['mail'];\n  const q = document.querySelector('#code');\n  const d = document.getElementById(k);\n  return e.target.pin.checked && e.target.value;\n}" }]);
  assert.deepEqual((r.functions[0] as { readsUiIds?: string[] }).readsUiIds, ['mail', 'code', 'pin']);
});

// ---------- CRUD（改修 B） ----------
type Acc = { functionId: string; op: string; evidence: string };
const accOf = (x: object): Acc[] => ((x as { access?: Acc[] }).access ?? []);

test('CRUD: sample-app の保存域キー 2 件に関数ごとの操作（R と C/U）が載る', () => {
  const stores = ir.dataItems.filter((d) => d.kind === 'localStorage');
  assert.equal(stores.length, 2);
  for (const d of stores) {
    const ops = new Set(accOf(d).map((a) => a.op));
    assert.ok(ops.has('R') && ops.has('C/U'), `${d.name}: ${[...ops].join(',')}`);
    for (const a of accOf(d)) {
      assert.ok(ir.functions.some((f) => f.id === a.functionId), `${d.name} の関数 ${a.functionId}`);
      assert.equal(a.evidence, a.op === 'R' ? 'fact' : 'inference');
    }
  }
});

test('CRUD: 未存在確認の中の setItem は C、既定値なしで読んだ後は U、removeItem・clear は D、HTTP メソッドで API の操作', () => {
  const src = [
    "function add() { if (!localStorage.getItem('a')) localStorage.setItem('a', '1'); }",
    "function upd() { const v = localStorage.getItem('b'); localStorage.setItem('b', v + '1'); }",
    "function del() { localStorage.removeItem('a'); }",
    "function wipe() { sessionStorage.setItem('s', '1'); sessionStorage.clear(); }",
    "async function post() { await fetch('/api/items?x=1', { method: 'POST' }); }",
  ].join('\n');
  const r = analyzeJsTs([{ path: 'c.js', abs: '/x/c.js', text: src }]);
  const fnId = (name: string): string => r.functions.find((f) => f.name === name)?.id ?? '';
  const ops = (name: string): string[] => accOf(r.dataItems.find((d) => d.name === name) ?? {}).map((a) => `${a.op}@${a.functionId}`);
  assert.ok(ops('a').includes(`C@${fnId('add')}`), ops('a').join());
  assert.ok(ops('a').includes(`D@${fnId('del')}`), ops('a').join());
  assert.ok(ops('b').includes(`U@${fnId('upd')}`), ops('b').join());
  assert.ok(ops('s').includes(`D@${fnId('wipe')}`), ops('s').join());
  const api = r.integrations.find((i) => i.method.toUpperCase() === 'POST');
  assert.ok(api, 'POST の連携');
  assert.deepEqual(accOf(api).map((a) => `${a.op}@${a.functionId}`), [`C@${fnId('post')}`]);
  assert.equal((api as { resource?: string }).resource, '/api/items');
});

test('URL: 最上位の const 文字列は + 連結・テンプレートとも値に置き換え、引数の部分だけ {引数名} で残して推測にする', () => {
  const src = [
    "const BASE = 'https://ex.com';",
    "const API = BASE + '/v1';",
    "async function list() { await fetch(API + '/items'); }",
    "async function one(id) { await fetch(`${API}/items/${id}`, { method: 'DELETE' }); }",
  ].join('\n');
  const r = analyzeJsTs([{ path: 'u.js', abs: '/x/u.js', text: src }]);
  const get = r.integrations.find((i) => i.method === 'GET');
  const del = r.integrations.find((i) => i.method === 'DELETE');
  assert.deepEqual([get?.url, get?.evidence], ['https://ex.com/v1/items', 'fact']);
  assert.deepEqual([del?.url, del?.evidence], ['https://ex.com/v1/items/{id}', 'inference']);
  assert.equal((del as { resource?: string } | undefined)?.resource, '/v1/items/{id}');
});

test('URL: ラッパーの引数に呼び出し箇所で文字列が渡れば、呼び出し箇所ごとに解決済み URL の連携を推測で足し、異常条件は行ごとの位置を持つ', () => {
  const wrapper = ir.integrations.find((i) => i.url === '/api{url}');
  const d = ir.integrations.find((i) => i.url === '/api/reservations');
  assert.ok(wrapper && d, ir.integrations.map((i) => i.url).join());
  const onSubmit = ir.functions.find((f) => f.name === 'onSubmit');
  assert.deepEqual([d.evidence, d.method, (d as { wrapperOf?: string }).wrapperOf, d.functionId, d.source[0]?.line], ['inference', 'POST', wrapper.id, onSubmit?.id, 153]);
  const fs = (wrapper as { failureSources?: { line: number }[] }).failureSources ?? [];
  assert.equal(fs.length, wrapper.failureConditions.length);
  assert.ok(fs.every((s) => s.line > wrapper.source[0]!.line - 10), JSON.stringify(fs));
  const acc = (x: object) => ((x as { access?: { functionId: string }[] }).access ?? []);
  assert.equal(acc(wrapper).length, 0, 'ラッパーの操作は呼び出し箇所側に任せる');
  assert.deepEqual(acc(d).map((a) => a.functionId), [onSubmit?.id]);
  const dyn = analyzeJsTs([{ path: 'w.js', abs: '/x/w.js', text: "async function send(p) { await fetch('/v1' + p); }\nfunction go(x) { send(x); }" }]);
  assert.deepEqual(dyn.integrations.map((i) => [i.url, i.evidence]), [['/v1{p}', 'inference']], '動的な引数なら足さない');
});

test('URL: 共通の送信処理の呼び出し箇所ごとに、渡したオプションの method（const も）と、テンプレートの式を {名前} にした URL を持つ', () => {
  const src = [
    "const API_BASE = 'https://x.example/v1';",
    "const DEL = 'delete';",
    "async function send(url, options = {}) { const res = await fetch(url, { ...options }); if (!res.ok) throw new Error('x'); return res; }",
    "function createLoan(p) { return send(`${API_BASE}/loans`, { method: 'POST', body: JSON.stringify(p) }); }",
    "function deleteLoan(id) { return send(`${API_BASE}/loans/${encodeURIComponent(id)}`, { method: DEL }); }",
    "function getMember(m) { const opts = { method: 'GET' }; return send(`${API_BASE}/members/${m.id}`, opts); }",
    "function list() { return send(API_BASE + '/books'); }",
  ].join('\n');
  const r = analyzeJsTs([{ path: 'api.js', abs: '/x/api.js', text: src }]);
  const got = r.integrations.filter((i) => 'wrapperOf' in i).map((i) => `${i.method} ${i.url} ${i.evidence}`).sort();
  assert.deepEqual(got, [
    'DELETE https://x.example/v1/loans/{id} inference',
    'GET https://x.example/v1/books inference',
    'GET https://x.example/v1/members/{id} inference',
    'POST https://x.example/v1/loans inference',
  ]);
});

test('動的な呼び出し 5 種類を呼び出し箇所ごとに unknowns（区分 dynamic-call・種類・file:line）へ積み、静的に決まるものは積まない', () => {
  const text = [
    'function run(obj, key, name) {',
    '  obj[key]();',
    '  import(name);',
    "  const f = new Function('a', 'return a');",
    "  eval('1 + 1');",
    "  setTimeout('tick()', 10);",
    "  obj['fixed']();",
    "  import('./static.js');",
    '  setTimeout(() => f(1), 10);',
    '}',
  ].join('\n');
  const out = analyzeJsTs([{ path: 'dyn.js', abs: join(root, 'dyn.js'), text }]);
  const dyn = out.unknowns.filter((u) => String(u.category) === 'dynamic-call');
  assert.deepEqual(
    dyn.map((u) => [u.topic, u.source[0]?.file, u.source[0]?.line]),
    [
      ['計算されたメンバ呼び出し（obj[key]()）', 'dyn.js', 2],
      ['動的 import（import(式)）', 'dyn.js', 3],
      ['new Function', 'dyn.js', 4],
      ['eval', 'dyn.js', 5],
      ['文字列を渡した setTimeout・setInterval', 'dyn.js', 6],
    ],
  );
  assert.ok(dyn.every((u) => u.evidence === 'unknown' && u.question.includes('確定できない')));
});
