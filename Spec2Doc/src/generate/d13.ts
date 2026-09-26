// D13 テスト観点表: D02 の 7 観点（IR）を入力に、ISTQB Foundation Level のテスト技法でテスト条件を導く。
// ブラックボックステスト技法（同値分割法・境界値分析・デシジョンテーブルテスト・状態遷移テスト）と
// 経験ベースのテスト技法（エラー推測）。期待結果をソースから確定できない行は「不明（D09-n）」。
import type { Boundary, Condition, FunctionInfo, IR, IrNode, Rule, SourceRef, StateMachine, StateTransition, UiElement } from '../ir/schema.ts';
import type { Block, Document, Provenance, Section, TableRow } from '../doc/model.ts';
import { type Feature, type GenCtx, errorProv, factProv, idMaps, makeDocument, para, provOf, row, section, srcText, table } from './common.ts';

/** デシジョンテーブルを全組合せで出す上限（超えたら縮約表） */
export const MAX_COMBINATIONS = 16;
const ACCEPT = '受理';
const REJECT = '拒否';

// ---------- 機能との対応（D02 と同じ範囲の決め方） ----------

interface Scope {
  f: Feature;
  fnIds: Set<string>;
  names: Set<string>;
  ranges: SourceRef[];
  elIds: Set<string>;
  throws: Set<string>;
}

function within(ranges: SourceRef[], s: SourceRef): boolean {
  return ranges.some((r) => r.file === s.file && s.line >= r.line && s.line <= (r.endLine ?? r.line));
}

function escapeRe(x: string): string {
  return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 呼び出し式の文字列に画面部品を読む形があるか（D02 と同じ判定: getElementById('x')・querySelector('#x')・form.x.value 等） */
function mentions(e: UiElement, callText: string): boolean {
  return [e.domId, e.name]
    .filter((k): k is string => !!k && k.trim() !== '')
    .some((k) => {
      const q = escapeRe(k);
      return new RegExp(
        `getElementById\\(\\s*['"\`]${q}['"\`]|querySelector(?:All)?\\(\\s*['"\`][^'"\`]*[#.\\[]?${q}\\b|\\.${q}\\.(?:value|checked|files|textContent)\\b|elements\\[['"\`]${q}['"\`]`,
      ).test(callText);
    });
}

function reachedFunctions(ir: IR, f: Feature): FunctionInfo[] {
  const byKey = new Map<string, FunctionInfo>();
  for (const fn of ir.functions) {
    byKey.set(fn.id, fn);
    if (!byKey.has(fn.name)) byKey.set(fn.name, fn);
  }
  const ids = new Set<string>();
  const stack: FunctionInfo[] = [f.fn];
  for (;;) {
    while (stack.length > 0) {
      const fn = stack.pop();
      if (!fn || ids.has(fn.id)) continue;
      ids.add(fn.id);
      for (const c of fn.calls) {
        const next = byKey.get(c);
        if (next) stack.push(next);
      }
    }
    const reached = ir.functions.filter((fn) => ids.has(fn.id)).flatMap((fn) => fn.source);
    const nested = ir.functions.filter((fn) => !ids.has(fn.id) && fn.source.some((s) => within(reached, s)));
    if (nested.length === 0) break;
    stack.push(...nested);
  }
  return ir.functions.filter((fn) => ids.has(fn.id));
}

const linkCache = new WeakMap<IR, Map<string, Feature[]>>();

function uiReads(fn: FunctionInfo): string[] {
  const ids = (fn as FunctionInfo & { readsUiIds?: unknown }).readsUiIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * 画面部品（UiElement.id）→ その部品を扱う D02 の機能（ハンドラ・export 関数）。複数なら登録順に列挙。
 * ①部品の id/name を readsUiIds に含む関数から、呼び出し関係を逆にたどって機能に至るもの
 *   （= 機能から呼び出し関係で到達する関数のどれかがその部品を読む）
 * ②フォームの submit ハンドラである機能は、そのフォーム内（同じファイルの行範囲）の部品を扱う
 * どちらにも当たらない部品は対応表に載らない。D02 の境界の機能列からも使えるよう export する
 */
export function featuresByUiElement(ir: IR): Map<string, Feature[]> {
  const cached = linkCache.get(ir);
  if (cached) return cached;
  const links = new Map<string, Feature[]>();
  const add = (elId: string, f: Feature): void => {
    const cur = links.get(elId) ?? [];
    if (!cur.includes(f)) links.set(elId, [...cur, f]);
  };
  for (const f of idMaps(ir).features) {
    const reads = new Set(reachedFunctions(ir, f).flatMap(uiReads));
    for (const e of ir.uiElements) {
      if ([e.domId, e.name].some((k) => k !== undefined && k !== '' && reads.has(k))) add(e.id, f);
    }
    const forms = ir.uiElements.filter(
      (e) => e.kind === 'form' && f.handlers.some((h) => h.event === 'submit' && (h.uiElementId === e.id || (e.domId !== undefined && [e.domId, `#${e.domId}`].includes(h.target)))),
    );
    for (const form of forms) {
      for (const e of ir.uiElements) {
        if (e.id === form.id || e.source.some((s) => within(form.source, s))) add(e.id, f);
      }
    }
  }
  linkCache.set(ir, links);
  return links;
}

function scopeOf(ir: IR, f: Feature): Scope {
  const fns = reachedFunctions(ir, f);
  const callText = fns.flatMap((fn) => fn.calls).join('\n');
  const links = featuresByUiElement(ir);
  const handled = (e: UiElement): boolean =>
    f.handlers.some((h) => h.uiElementId === e.id || (e.domId !== undefined && [e.domId, `#${e.domId}`].includes(h.target)));
  return {
    f,
    fnIds: new Set(fns.map((fn) => fn.id)),
    names: new Set(fns.map((fn) => fn.name)),
    ranges: fns.flatMap((fn) => fn.source),
    elIds: new Set(ir.uiElements.filter((e) => (links.get(e.id) ?? []).includes(f) || handled(e) || mentions(e, callText)).map((e) => e.id)),
    throws: new Set(fns.flatMap((fn) => fn.throws)),
  };
}

type Scoped = IrNode & { functionId?: string; uiElementId?: string };

function inScope(sc: Scope, node: Scoped): boolean {
  if (node.functionId && sc.fnIds.has(node.functionId)) return true;
  if (node.uiElementId && sc.elIds.has(node.uiElementId)) return true;
  return node.source.some((s) => within(sc.ranges, s));
}

/** 機能 ID の欄と導出元の欄（D02 の節番号 `F-nnn-観点番号` と IR の ID） */
function origin(fs: Feature[], vpNo: number, id: string, label: string): [string, string] {
  const feats = fs.map((f) => f.no).join('、') || '—（機能に結び付かない）';
  const d02 = fs.length > 0 ? `D02 ${fs.map((f) => `${f.no}-${vpNo}`).join('、')} ` : '';
  return [feats, `${d02}${label}（${id}）`];
}

function unknownExpect(ctx: GenCtx, key: string, topic: string, question: string, node: IrNode): string {
  return ctx.d09.register({ key, topic, question, relatedIds: [node.id], source: node.source, origin: 'D13' });
}

function asUnknown(p: Provenance, d09Ref: string): Provenance {
  return { ...p, evidence: 'unknown', d09Ref: p.d09Ref ?? d09Ref };
}

function asInferred(p: Provenance): Provenance {
  return p.evidence === 'fact' ? { ...p, evidence: 'inference', origin: 'analysis' } : p;
}

// ---------- 1. 同値分割法・境界値分析 ----------

interface Probe {
  technique: string;
  position: string;
  value: string;
  expect: string;
  prov: Provenance;
}

function fmt(n: number): string {
  return String(Number(n.toFixed(10)));
}

type Step = { step: number; inferred: boolean } | { d09Ref: string };

/** 直前・直後の値を決める刻み幅。step 属性があれば事実、整数・長さ・回数は 1（整数は推測）、それ以外は不明 */
function stepOf(ir: IR, ctx: GenCtx, b: Boundary, v: number): Step {
  const el = b.uiElementId ? ir.uiElements.find((e) => e.id === b.uiElementId) : undefined;
  const raw = el?.constraints.step;
  const s = Number(raw);
  if (raw !== undefined && Number.isFinite(s) && s > 0) return { step: s, inferred: false };
  if (b.bound === 'length' || b.bound === 'retry') return { step: 1, inferred: false };
  if (Number.isInteger(v)) return { step: 1, inferred: true };
  return {
    d09Ref: unknownExpect(ctx, `d13-step:${b.id}`, `境界 ${b.subject} の刻み幅`, `${b.subject}（${b.bound} ${b.value}）の直前・直後の値を決める刻み幅（step）がソースから確定できない`, b),
  };
}

function valueText(b: Boundary, n: number): string {
  return b.bound === 'length' ? `長さ ${fmt(n)} の文字列` : fmt(n);
}

/** 2 値境界値分析: 境界値と、隣の同値クラスで最も近い値 */
function bvaProbes(ir: IR, ctx: GenCtx, b: Boundary, p: Provenance): Probe[] {
  const v = Number(b.value);
  if (b.bound === 'pattern' || b.value.trim() === '' || !Number.isFinite(v)) return [];
  const st = stepOf(ir, ctx, b, v);
  if ('d09Ref' in st) {
    const u = asUnknown(p, st.d09Ref);
    return [{ technique: '境界値分析（2 値）', position: '境界値', value: valueText(b, v), expect: `不明（${st.d09Ref}）`, prov: u }];
  }
  const bp = st.inferred ? asInferred(p) : p;
  const side = b.bound === 'lower' ? 'lower' : b.bound === 'upper' || b.bound === 'length' ? 'upper' : undefined;
  const pos = (n: number): string => (n < v ? '直前' : n > v ? '直後' : '境界値');
  const probe = (n: number, expect: string, prov: Provenance): Probe => ({ technique: '境界値分析（2 値）', position: pos(n), value: valueText(b, n), expect, prov });
  if (side === undefined || b.inclusive === null) {
    const no = unknownExpect(
      ctx,
      `d13-expect:${b.id}`,
      `境界 ${b.subject} の期待結果`,
      `${b.subject}（${b.bound} ${b.value}）の境界の前後で何が起きるか（受理・拒否・動作の切り替え）がソースから確定できない`,
      b,
    );
    const u = asUnknown(bp, no);
    return [v - st.step, v, v + st.step].map((n) => probe(n, `不明（${no}）`, u));
  }
  const lp = b.bound === 'length' ? asInferred(bp) : bp;
  if (side === 'lower') {
    return b.inclusive ? [probe(v - st.step, REJECT, lp), probe(v, ACCEPT, lp)] : [probe(v, REJECT, lp), probe(v + st.step, ACCEPT, lp)];
  }
  return b.inclusive ? [probe(v, ACCEPT, lp), probe(v + st.step, REJECT, lp)] : [probe(v - st.step, ACCEPT, lp), probe(v, REJECT, lp)];
}

/** 同値分割法: 内側の例＝有効同値クラスの代表値、外側の例＝無効同値クラスの代表値 */
function epProbes(ctx: GenCtx, b: Boundary, p: Provenance): Probe[] {
  const judged = ['lower', 'upper', 'length', 'pattern'].includes(b.bound);
  return [b.insideExample, b.outsideExample].map((ex, i): Probe => {
    const cls = i === 0 ? '有効同値クラスの代表値' : '無効同値クラスの代表値';
    if (ex.trim() === '') {
      const no = ctx.d09.register({
        key: `example:${b.id}:${i}`,
        topic: `境界 ${b.subject} の${i === 0 ? '内側' : '外側'}の例`,
        question: `${b.subject}（${b.bound} ${b.value}）の${i === 0 ? '内側' : '外側'}の具体例を作れない`,
        relatedIds: [b.id],
        source: b.source,
        origin: 'D13',
      });
      return { technique: '同値分割法', position: cls, value: `不明（${no}）`, expect: `不明（${no}）`, prov: asUnknown(p, no) };
    }
    if (judged) return { technique: '同値分割法', position: cls, value: ex, expect: i === 0 ? ACCEPT : REJECT, prov: p };
    const no = unknownExpect(ctx, `d13-expect:${b.id}`, `境界 ${b.subject} の期待結果`, `${b.subject}（${b.bound} ${b.value}）の境界の前後で何が起きるか（受理・拒否・動作の切り替え）がソースから確定できない`, b);
    return { technique: '同値分割法', position: cls, value: ex, expect: `不明（${no}）`, prov: asUnknown(p, no) };
  });
}

function boundaryLabel(b: Boundary): string {
  const incl = b.inclusive === null ? '' : b.inclusive ? '（含む）' : '（含まない）';
  return `${b.bound} ${b.value}${b.unit ? ` ${b.unit}` : ''}${incl}`;
}

function boundarySection(ir: IR, ctx: GenCtx, scopes: Scope[]): Section {
  const rows: TableRow[] = [];
  for (const b of ir.boundaries) {
    const [feats, from] = origin(scopes.filter((sc) => inScope(sc, b)).map((sc) => sc.f), 4, b.id, `境界 ${b.subject}`);
    const p = provOf(b, ctx, 'D13', `境界 ${b.subject}`);
    for (const pr of [...epProbes(ctx, b, p), ...bvaProbes(ir, ctx, b, p)]) {
      rows.push(row([`BV-${rows.length + 1}`, feats, from, b.subject, boundaryLabel(b), pr.technique, pr.position, pr.value, pr.expect, srcText(b.source)], pr.prov));
    }
  }
  const blocks: Block[] =
    rows.length > 0
      ? [
          para('2 値境界値分析: 境界ごとに境界値と、隣の同値クラスで最も近い値（直前または直後）を取る。刻み幅は step 属性、無ければ整数は 1 と推測する。長さの境界は上限として扱う（推測）', factProv([])),
          table(['No', '機能ID', '導出元（D02 境界）', '対象', '境界', '技法', 'テスト値の位置', 'テスト値', '期待結果', 'ソース位置'], rows),
        ]
      : [para('導出元なし（D02 の「入力値の範囲／境界」が 0 件）', factProv([]))];
  return section('2. 同値分割法・境界値分析', 2, blocks);
}

// ---------- 2. デシジョンテーブルテスト ----------

function leavesOf(c: Condition | null, out: string[] = []): string[] {
  if (!c) return out;
  if (c.op === 'leaf') return out.includes(c.text) ? out : [...out, c.text];
  if (c.op === 'not') return leavesOf(c.item, out);
  return c.items.reduce((acc, x) => leavesOf(x, acc), out);
}

function evalCond(c: Condition, env: Map<string, boolean>): boolean {
  if (c.op === 'leaf') return env.get(c.text) ?? false;
  if (c.op === 'not') return !evalCond(c.item, env);
  return c.op === 'and' ? c.items.every((x) => evalCond(x, env)) : c.items.some((x) => evalCond(x, env));
}

function condText(c: Condition): string {
  if (c.op === 'leaf') return c.text;
  if (c.op === 'not') return `NOT（${condText(c.item)}）`;
  const inner = c.items.map((x) => (x.op === 'leaf' ? condText(x) : `（${condText(x)}）`));
  return inner.join(c.op === 'and' ? ' かつ ' : ' または ');
}

const NO_BRANCH = '該当する分岐なし（この規則では処理しない）';

function resultOf(r: Rule, env: Map<string, boolean>): string {
  const hit = r.cases.find((c) => c.condition === null || evalCond(c.condition, env));
  return hit ? hit.result : NO_BRANCH;
}

function ruleBlocks(r: Rule, feats: string, from: string, p: Provenance): Block[] {
  const leaves = r.cases.reduce<string[]>((acc, c) => leavesOf(c.condition, acc), []);
  if (leaves.length === 0) return [];
  const condIds = leaves.map((_, i) => `C${i + 1}`);
  const combos = 2 ** leaves.length;
  const head = para(`${r.name}（${r.kind}、${srcText(r.source)}）: 条件 ${leaves.length} 個、組合せ ${combos} 通り`, p);
  const condTable = table(['条件ID', '条件'], leaves.map((l, i) => row([condIds[i] ?? '', l], p)));
  if (r.kind === 'switch' || combos > MAX_COMBINATIONS) {
    const why = r.kind === 'switch' ? 'switch の各分岐は互いに排他のため' : `組合せ ${combos} 通りが ${MAX_COMBINATIONS} を超えるため`;
    const rows = r.cases.map((c, i) => {
      const earlier = i === 0 ? '' : i === 1 ? '（規則 R1 の条件が不成立）' : `（規則 R1〜R${i} の条件が不成立）`;
      const cond = c.condition ? condText(c.condition) : '上記のいずれにも当たらない';
      return row([`R${i + 1}`, feats, from, `${cond}${c.condition ? earlier : ''}`, c.result], { ...p, source: c.source.length > 0 ? [...c.source] : p.source });
    });
    return [head, para(`${why}、分岐ごとの縮約表とする（縮約したデシジョンテーブル）`, p), condTable, table(['規則', '機能ID', '導出元（D02 ルール）', '成り立つ条件', '結果（アクション）'], rows)];
  }
  const rows = Array.from({ length: combos }, (_, m) => {
    const env = new Map(leaves.map((l, i) => [l, ((m >> (leaves.length - 1 - i)) & 1) === 0] as const));
    return row([`R${m + 1}`, feats, from, ...leaves.map((l) => (env.get(l) ? 'T' : 'F')), resultOf(r, env)], p);
  });
  return [
    head,
    condTable,
    table(['規則', '機能ID', '導出元（D02 ルール）', ...condIds, '結果（アクション）'], rows),
    para('条件間の依存（同時に成り立たない組合せ）は解析していない。実行できない規則はテスト条件から外す', asInferred(p)),
  ];
}

function decisionSection(ir: IR, ctx: GenCtx, scopes: Scope[]): Section {
  const blocks = ir.rules.flatMap((r) => {
    const [feats, from] = origin(scopes.filter((sc) => inScope(sc, r)).map((sc) => sc.f), 3, r.id, `業務ルール ${r.name}`);
    return ruleBlocks(r, feats, from, provOf(r, ctx, 'D13', `業務ルール ${r.name}`));
  });
  return section('3. デシジョンテーブルテスト', 2, blocks.length > 0 ? blocks : [para('導出元なし（D02 の「業務ルール／計算式」に条件付きの規則が 0 件）', factProv([]))]);
}

// ---------- 3. 状態遷移テスト ----------

function transitionScopes(scopes: Scope[], t: StateTransition): Feature[] {
  return scopes
    .filter((sc) => t.source.some((x) => within(sc.ranges, x)) || sc.names.has(t.trigger) || [...sc.names].some((n) => t.trigger.startsWith(`${n}（`)))
    .map((sc) => sc.f);
}

function stateBlocks(ctx: GenCtx, sm: StateMachine, scopes: Scope[]): Block[] {
  const p = provOf(sm, ctx, 'D13', `状態 ${sm.variable}`);
  const smFeats = scopes.filter((sc) => inScope(sc, sm)).map((sc) => sc.f);
  const valid = sm.transitions.map((t, i) => {
    const [feats, from] = origin(transitionScopes(scopes, t), 5, sm.id, `状態 ${sm.variable}`);
    return row([`ST-${i + 1}`, feats, from, t.from, t.trigger, t.condition ?? '—', t.to, t.action ?? '—', srcText(t.source)], { ...p, source: t.source.length > 0 ? [...t.source] : p.source });
  });
  const allFeats = [...new Set([...smFeats, ...sm.transitions.flatMap((t) => transitionScopes(scopes, t))])];
  const [feats, from] = origin(allFeats, 5, sm.id, `状態 ${sm.variable}`);
  const states = sm.values.length > 0 ? sm.values : [...new Set(sm.transitions.flatMap((t) => [t.from, t.to]))];
  const triggers = [...new Set(sm.transitions.map((t) => t.trigger))];
  const defined = new Set(sm.transitions.map((t) => `${t.from}\u0000${t.trigger}`));
  const pairs = states.flatMap((s) => triggers.filter((t) => !defined.has(`${s}\u0000${t}`) && !defined.has(`*\u0000${t}`)).map((t) => [s, t] as const));
  const blocks: Block[] = [
    para(`状態変数 ${sm.variable}（${sm.mechanism}）: 状態 ${states.join(' / ') || 'なし'}、初期状態 ${sm.initial ?? '（不明）'}`, p),
    valid.length > 0
      ? table(['No', '機能ID', '導出元（D02 状態）', '遷移元', 'イベント（契機）', 'ガード条件', '遷移先', 'アクション', 'ソース位置'], valid, `${sm.variable}: 0 スイッチカバレッジ（有効な遷移を 1 回ずつ通す）`)
      : para('有効な遷移の抽出 0 件（D02 の同じ状態変数を参照）', p),
  ];
  if (pairs.length === 0) return blocks;
  const no = unknownExpect(
    ctx,
    `d13-invalid:${sm.id}`,
    `状態 ${sm.variable} の無効遷移`,
    `${sm.variable} で定義されていない（状態, イベント）の組で何が起きるか（無視・エラー・遷移）がソースから確定できない`,
    sm,
  );
  const up = asUnknown(p, no);
  const invalid = pairs.map(([s, t], i) => row([`SI-${i + 1}`, feats, from, s, t, `不明（${no}）`], up));
  return [...blocks, table(['No', '機能ID', '導出元（D02 状態）', '状態', 'イベント（契機）', '期待結果'], invalid, `${sm.variable}: 無効遷移の候補（状態遷移表で定義されていない組）`)];
}

function stateSection(ir: IR, ctx: GenCtx, scopes: Scope[]): Section {
  const blocks = ir.states.flatMap((sm) => stateBlocks(ctx, sm, scopes));
  return section('4. 状態遷移テスト', 2, blocks.length > 0 ? blocks : [para('導出元なし（D02 の「状態と状態遷移」が 0 件）', factProv([]))]);
}

// ---------- 4. エラー推測 ----------

const GUESS: Readonly<Record<string, string>> = {
  validation: '範囲外・空値・型違い・桁あふれの入力',
  network: '通信断・タイムアウト・4xx/5xx 応答・不正な応答本文',
  throw: '例外を投げる前提（引数・状態）を崩す呼び出し',
  display: '表示条件を満たす操作と、満たさない直前の操作',
};

function errorSection(ir: IR, ctx: GenCtx, scopes: Scope[]): Section {
  const { error } = idMaps(ir);
  const rows = ir.errors.map((e, i) => {
    const fs = scopes.filter((sc) => sc.throws.has(e.id) || inScope(sc, e)).map((sc) => sc.f);
    const [feats, from] = origin(fs, 6, e.id, `エラー ${error.get(e.id) ?? e.id}`);
    const { cond, prov } = errorProv(e, ctx, 'D13', ir);
    return row([`EG-${i + 1}`, feats, from, cond, e.message, e.kind, e.afterState ?? '—', GUESS[e.kind] ?? '—'], prov);
  });
  return section('5. エラー推測の起点', 2, [
    rows.length > 0
      ? table(['No', '機能ID', '導出元（D02 エラー）', '発生条件', '表示文言', '種類', '発生後の状態', 'エラー推測の起点'], rows)
      : para('導出元なし（D02 の「エラー／例外時の振る舞い」が 0 件）', factProv([])),
  ]);
}

// ---------- 文書 ----------

function countRows(s: Section): number {
  return s.blocks.reduce((n, b) => (b.type === 'table' && b.columns[0] !== '条件ID' ? n + b.rows.length : n), 0);
}

export function buildD13(ir: IR, ctx: GenCtx): Document {
  const scopes = idMaps(ir).features.map((f) => scopeOf(ir, f));
  const body = [boundarySection(ir, ctx, scopes), decisionSection(ir, ctx, scopes), stateSection(ir, ctx, scopes), errorSection(ir, ctx, scopes)];
  const summary = body.map((s) => row([s.heading.replace(/^\d+\.\s*/, ''), String(countRows(s))], factProv([])));
  return makeDocument('D13', ctx, [
    section('1. この文書の位置付け', 2, [
      para(
        'D02 のテストベース 7 観点のうち「入力値の範囲／境界」「業務ルール／計算式」「状態と状態遷移」「エラー／例外時の振る舞い」を入力に、ISTQB Foundation Level のブラックボックステスト技法（同値分割法・境界値分析・デシジョンテーブルテスト・状態遷移テスト）と経験ベースのテスト技法（エラー推測）でテスト条件を導く。導出元の欄は D02 の節（機能ID-観点番号）と解析結果の ID。期待結果をソースから確定できない行は「不明（D09-n）」とする',
        factProv([]),
      ),
      table(['技法', 'テスト条件の行数'], summary),
    ]),
    ...body,
  ]);
}
