// D02 要求仕様書: 機能一覧・機能ごとのテストベース 7 観点・エラー一覧・文言一覧・動作環境
// （REQ-F-016・031・032・033・036）

import type { Boundary, FunctionInfo, StateMachine, IR, IrNode, SourceRef, UiElement } from '../ir/schema.ts';
import type { Block, Document, Section, TableRow } from '../doc/model.ts';
import type { ExplainResult } from '../llm/index.ts';
import {
  type Feature,
  type GenCtx,
  conditionItem,
  designIntentNote,
  errorProv,
  explainPara,
  factProv,
  hasFailedFiles,
  idMaps,
  item,
  makeDocument,
  para,
  provOf,
  row,
  rowProvWithLlm,
  section,
  srcText,
  table,
  zeroResult,
} from './common.ts';

/** テストベース 7 観点（要件定義書の用語定義） */
export const VIEWPOINTS = [
  '機能一覧',
  '画面／入出力項目',
  '業務ルール／計算式',
  '入力値の範囲／境界',
  '状態と状態遷移',
  'エラー／例外時の振る舞い',
  '用語定義',
] as const;

// ---------- 機能の範囲 ----------

interface Scope {
  fnIds: Set<string>;
  ranges: SourceRef[];
  elements: UiElement[];
}

function within(ranges: SourceRef[], s: SourceRef): boolean {
  return ranges.some((r) => r.file === s.file && s.line >= r.line && s.line <= (r.endLine ?? r.line));
}

function escapeRe(x: string): string {
  return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 呼び出し式の文字列に画面部品を読む形があるか（getElementById('x')・querySelector('#x')・form.x.value 等） */
function referencesElement(e: UiElement, callText: string): boolean {
  return [e.domId, e.name]
    .filter((k): k is string => !!k && k.trim() !== '')
    .some((k) => {
      const q = escapeRe(k);
      return new RegExp(
        `getElementById\\(\\s*['"\`]${q}['"\`]|querySelector(?:All)?\\(\\s*['"\`][^'"\`]*[#.\\[]?${q}\\b|\\.${q}\\.(?:value|checked|files|textContent)\\b|elements\\[['"\`]${q}['"\`]`,
      ).test(callText);
    });
}

/**
 * 機能の範囲 = 機能の関数から呼び出し関係（FunctionInfo.calls）で推移的に到達する関数と、
 * その中に定義された関数（コールバック等）。画面部品はハンドラの登録先と、到達する関数が読む部品だけ
 */
function scopeOf(ir: IR, f: Feature): Scope {
  const byKey = new Map<string, FunctionInfo>();
  for (const fn of ir.functions) {
    byKey.set(fn.id, fn);
    if (!byKey.has(fn.name)) byKey.set(fn.name, fn);
  }
  const fnIds = new Set<string>();
  const stack: FunctionInfo[] = [f.fn];
  for (;;) {
    while (stack.length > 0) {
      const fn = stack.pop();
      if (!fn || fnIds.has(fn.id)) continue;
      fnIds.add(fn.id);
      for (const c of fn.calls) {
        const next = byKey.get(c);
        if (next) stack.push(next);
      }
    }
    const reached = ir.functions.filter((fn) => fnIds.has(fn.id)).flatMap((fn) => fn.source);
    const nested = ir.functions.filter((fn) => !fnIds.has(fn.id) && fn.source.some((s) => within(reached, s)));
    if (nested.length === 0) break;
    stack.push(...nested);
  }
  const reachedFns = ir.functions.filter((fn) => fnIds.has(fn.id));
  const ranges = reachedFns.flatMap((fn) => fn.source);
  const handlerElIds = new Set(
    f.handlers.flatMap((h) =>
      ir.uiElements.filter((e) => e.id === h.uiElementId || (e.domId && [e.domId, `#${e.domId}`].includes(h.target))).map((e) => e.id),
    ),
  );
  // 関数が読む画面部品: 解析が readsUiIds を載せていればそれを使い、無ければ呼び出し式の文字列から推定する
  const readers = reachedFns.map((fn): ((e: UiElement) => boolean) => {
    const ids = (fn as FunctionInfo & { readsUiIds?: unknown }).readsUiIds;
    if (Array.isArray(ids)) {
      const set = new Set(ids.filter((x): x is string => typeof x === 'string'));
      return (e) => set.has(e.id);
    }
    const text = fn.calls.join('\n');
    return (e) => referencesElement(e, text);
  });
  const elements = ir.uiElements.filter((e) => handlerElIds.has(e.id) || readers.some((r) => r(e)));
  return { fnIds, ranges, elements };
}

function inScope(sc: Scope, node: IrNode & { functionId?: string }): boolean {
  if (node.functionId && sc.fnIds.has(node.functionId)) return true;
  return node.source.some((s) => within(sc.ranges, s));
}

// ---------- 7 観点 ----------

function orZero(ir: IR, ctx: GenCtx, f: Feature, vp: string, blocks: Block[]): Block[] {
  if (blocks.length > 0) return blocks;
  return [zeroResult(ctx, 'D02', `${f.no} ${f.fn.name} の${vp}`, { uncertain: hasFailedFiles(ir), relatedIds: [f.fn.id], source: f.fn.source })];
}

/** 機能の定義（2 列の短い表）。LLM の説明文は生成できたときだけ段落で添える（無効の旨は文書冒頭に 1 回） */
function vpFeature(ir: IR, ctx: GenCtx, f: Feature, explained: ExplainResult): Block[] {
  const p = provOf(f.fn, ctx, 'D02', `機能 ${f.fn.name}`);
  const params = f.fn.params.map((x) => `${x.name}${x.type ? `: ${x.type}` : ''}${x.defaultValue ? ` = ${x.defaultValue}` : ''}`).join(', ');
  const triggers = f.handlers.map((h) => `${h.target} の ${h.event}`).join('、') || '（イベント登録なし）';
  const handlerSrc = f.handlers.flatMap((h) => h.source);
  return [
    table(
      ['項目', '内容'],
      [
        row(['契機', triggers], handlerSrc.length > 0 ? { ...p, source: [...handlerSrc], irIds: [...(p.irIds ?? []), ...f.handlers.map((h) => h.id)] } : p),
        row(['引数', params || 'なし'], p),
        row(['戻り値', f.fn.returns ?? '（型注釈なし）'], p),
        row(['定義位置', srcText(f.fn.source)], p),
      ],
    ),
    ...(explained.evidence === 'inference' ? [para(`説明: ${explained.text}`, rowProvWithLlm(p, explained))] : []),
  ];
}

function vpIo(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const { part, screen } = idMaps(ir);
  const rows: TableRow[] = [
    ...sc.elements.map((e) =>
      row(
        [part.get(e.id) ?? e.id, screen.get(e.screenId) ?? e.screenId, e.label ?? '', e.kind + (e.inputType ? `（${e.inputType}）` : ''), constraintText(e)],
        provOf(e, ctx, 'D02', `画面部品 ${e.label ?? e.domId ?? e.id}`),
      ),
    ),
    ...f.fn.params.map((x) => row(['（引数）', '—', x.name, x.type ?? '型不明', x.defaultValue ? `既定値 ${x.defaultValue}` : ''], factProv(f.fn.source, [f.fn.id]))),
  ];
  const ints = ir.integrations
    .filter((i) => inScope(sc, i))
    .map((i) => row([i.id, i.direction === 'outbound' ? '送信' : '受信', i.method, i.url, i.timing], provOf(i, ctx, 'D02', `連携 ${i.method} ${i.url}`)));
  const blocks = [
    ...(rows.length > 0 ? [table(['部品ID', '画面ID', '項目', '種類', '制約'], rows)] : []),
    ...(ints.length > 0 ? [table(['連携ID', '方向', 'メソッド', '接続先', '契機'], ints, '外部連携（詳細は D05 の同じ連携ID）')] : []),
  ];
  return orZero(ir, ctx, f, '画面／入出力項目', blocks);
}

export function constraintText(e: UiElement): string {
  return Object.entries(e.constraints)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => (v === '' ? k : `${k}=${v}`))
    .join(' ');
}

function vpRules(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const blocks = ir.rules
    .filter((r) => inScope(sc, r))
    .flatMap((r): Block[] => {
      const p = provOf(r, ctx, 'D02', `業務ルール ${r.name}`);
      const cases = r.cases.map((c, i) => {
        const cp = { ...p, source: c.source.length > 0 ? [...c.source] : p.source };
        const head = `場合 ${i + 1}: ${c.condition ? '次の条件のとき' : '上記以外のとき'} → ${c.result}`;
        return item(head, cp, c.condition ? [conditionItem(c.condition, cp)] : undefined);
      });
      return [
        para(`${r.name}（${r.kind}、${srcText(r.source)}）`, p),
        ...(cases.length > 0 ? [{ type: 'list' as const, ordered: true, items: cases }] : []),
        ...(r.formula ? [para(`計算式: ${r.formula}`, p)] : []),
      ];
    });
  return orZero(ir, ctx, f, '業務ルール／計算式', blocks);
}

/** 単位不明の D09 番号。解析結果に同じ境界の単位不明があればその番号、無ければ部品（対象）ごとに 1 件 */
function unitD09(ir: IR, ctx: GenCtx, b: Boundary, origin: 'D02' | 'D03'): string {
  const u = ir.unknowns.find(
    (x) => x.category === 'unit-unknown' && (x.relatedIds.includes(b.id) || (b.uiElementId !== undefined && x.relatedIds.includes(b.uiElementId))),
  );
  if (u) return ctx.d09.registerUnknown(u, origin);
  return ctx.d09.register({
    key: `unit:${b.uiElementId ?? b.subject}`,
    topic: `境界 ${b.subject} の単位`,
    question: `${b.subject} の境界値の単位がソースから確定できない`,
    category: 'unit-unknown',
    relatedIds: [b.id],
    source: b.source,
    origin,
  });
}

/** 境界の 1 行（内側の例・外側の例を併記。REQ-F-033）。D03 の入力項目の境界でも使う */
export function boundaryRow(ir: IR, ctx: GenCtx, b: Boundary, origin: 'D02' | 'D03') {
  const { part } = idMaps(ir);
  let p = provOf(b, ctx, origin, `境界 ${b.subject}`);
  let unit = b.unit ?? '';
  if (b.unit === null && b.bound !== 'pattern') {
    const d09Ref = unitD09(ir, ctx, b, origin);
    p = { ...p, evidence: 'unknown', d09Ref };
    unit = `不明（${d09Ref}）`;
  }
  const examples = [b.insideExample, b.outsideExample].map((ex, i) => {
    if (ex.trim() !== '') return ex;
    const d09Ref = ctx.d09.register({
      key: `example:${b.id}:${i}`,
      topic: `境界 ${b.subject} の${i === 0 ? '内側' : '外側'}の例`,
      question: `${b.subject}（${b.bound} ${b.value}）の${i === 0 ? '内側' : '外側'}の具体例を作れない`,
      relatedIds: [b.id],
      source: b.source,
      origin,
    });
    p = { ...p, evidence: 'unknown', d09Ref: p.d09Ref ?? d09Ref };
    return `不明（${d09Ref}）`;
  });
  const valueOrigin = b.configurable === 'config' ? `設定値${b.configSource ? `（${srcText([b.configSource])}）` : ''}` : '固定値';
  const incl = b.inclusive === null ? '該当しない' : b.inclusive ? '含む' : '含まない';
  return row(
    [b.uiElementId ? (part.get(b.uiElementId) ?? b.subject) : b.subject, b.subject, b.bound, b.value, appliesWhenOf(b), incl, unit, examples[0] ?? '', examples[1] ?? '', valueOrigin],
    p,
  );
}

/** 境界が効く条件（解析の appliesWhen。例: ticketType === 'annual' のときだけの上限）。無ければ「—」 */
function appliesWhenOf(b: Boundary): string {
  const w = (b as Boundary & { appliesWhen?: unknown }).appliesWhen;
  return typeof w === 'string' && w.trim() !== '' ? w : '—';
}

export const BOUNDARY_COLUMNS = ['部品ID', '対象', '種類', '値', '適用条件', '境界を含むか', '単位', '内側の例', '外側の例', '値の出所'];

/** 機能から到達する関数内の境界と、到達する関数が読む（またはハンドラの登録先の）部品の境界だけ */
function vpBoundaries(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const elIds = new Set(sc.elements.map((e) => e.id));
  const rows = ir.boundaries
    .filter((b) => (b.uiElementId !== undefined && elIds.has(b.uiElementId)) || inScope(sc, b))
    .map((b) => boundaryRow(ir, ctx, b, 'D02'));
  return orZero(ir, ctx, f, '入力値の範囲／境界', rows.length > 0 ? [table(BOUNDARY_COLUMNS, rows)] : []);
}

function vpStates(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const names = new Set(ir.functions.filter((fn) => sc.fnIds.has(fn.id)).map((fn) => fn.name));
  const reachable = (t: StateMachine['transitions'][number]): boolean =>
    t.source.some((x) => within(sc.ranges, x)) || names.has(t.trigger) || [...names].some((n) => t.trigger.startsWith(`${n}（`));
  const blocks = ir.states
    .map((s) => ({ ...s, transitions: s.transitions.filter(reachable) }))
    .filter((s) => inScope(sc, s) || s.transitions.length > 0)
    .flatMap((s): Block[] => {
      const p = provOf(s, ctx, 'D02', `状態 ${s.variable}`);
      return [
        para(`状態変数 ${s.variable}（${s.mechanism}）: 値 ${s.values.join(' / ') || 'なし'}、初期値 ${s.initial ?? '（不明）'}`, p),
        s.transitions.length > 0
          ? table(
              ['遷移元', '契機', '条件', '遷移先', '処理'],
              s.transitions.map((t) => row([t.from, t.trigger, t.condition ?? '', t.to, t.action ?? ''], { ...p, source: t.source.length > 0 ? [...t.source] : p.source })),
              `${s.variable} の遷移のうちこの機能から到達するもの（全体は D04 の同じ状態変数を参照）`,
            )
          : zeroResult(ctx, 'D02', `状態 ${s.variable} の遷移`, { uncertain: hasFailedFiles(ir), relatedIds: [s.id], source: s.source }),
      ];
    });
  return orZero(ir, ctx, f, '状態と状態遷移', blocks);
}

function vpErrors(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const { error } = idMaps(ir);
  const thrown = new Set(ir.functions.filter((fn) => sc.fnIds.has(fn.id)).flatMap((fn) => fn.throws));
  const rows = ir.errors
    .filter((e) => thrown.has(e.id) || inScope(sc, e))
    .map((e) => {
      const { cond, prov } = errorProv(e, ctx, 'D02', ir);
      return row([error.get(e.id) ?? e.id, e.message, cond, e.afterState ?? '', e.kind], prov);
    });
  return orZero(ir, ctx, f, 'エラー／例外時の振る舞い', rows.length > 0 ? [table(['エラーID', '文言', '発生条件', '発生後の状態', '種類'], rows)] : []);
}

function vpTerms(ir: IR, ctx: GenCtx, f: Feature, sc: Scope): Block[] {
  const rows = sc.elements
    .filter((e) => e.label && e.label.trim() !== '')
    .map((e) => row([e.label ?? '', [e.domId, e.name].filter(Boolean).join(', ') || '（識別子なし）'], provOf(e, ctx, 'D02', `用語 ${e.label}`)));
  return orZero(ir, ctx, f, '用語定義', rows.length > 0 ? [table(['用語', '対応する識別子'], rows, '全体の用語集は D01 を参照')] : []);
}

async function featureSections(ir: IR, ctx: GenCtx, f: Feature, explained: ExplainResult): Promise<Section[]> {
  const sc = scopeOf(ir, f);
  const bodies: Block[][] = [
    vpFeature(ir, ctx, f, explained),
    vpIo(ir, ctx, f, sc),
    vpRules(ir, ctx, f, sc),
    vpBoundaries(ir, ctx, f, sc),
    vpStates(ir, ctx, f, sc),
    vpErrors(ir, ctx, f, sc),
    vpTerms(ir, ctx, f, sc),
  ];
  return [
    section(`${f.no} ${f.fn.name}`, 3, []),
    ...VIEWPOINTS.map((vp, i) => section(`${f.no}-${i + 1} ${vp}`, 4, bodies[i] ?? [])),
  ];
}

// ---------- 全体 ----------

function errorList(ir: IR, ctx: GenCtx): Section {
  const { error } = idMaps(ir);
  const rows = [...ir.errors]
    .sort((a, b) => ((error.get(a.id) ?? '') < (error.get(b.id) ?? '') ? -1 : 1))
    .map((e) => {
      const { cond, prov } = errorProv(e, ctx, 'D02', ir);
      return row([error.get(e.id) ?? e.id, e.message, cond, e.kind, srcText(e.source)], prov);
    });
  return section('3. エラー一覧', 2, [
    rows.length > 0
      ? table(['エラーID', '文言', 'エラー条件', '種類', '位置'], rows)
      : zeroResult(ctx, 'D02', 'エラー', { uncertain: hasFailedFiles(ir) }),
  ]);
}

function messageList(ir: IR, ctx: GenCtx): Section {
  const { error, part, screen } = idMaps(ir);
  const entries: { ref: string; text: string; kind: string; node: IrNode; topic: string }[] = [
    ...ir.screens.filter((s) => s.title.trim() !== '').map((s) => ({ ref: screen.get(s.id) ?? s.id, text: s.title, kind: '画面題名', node: s, topic: `画面 ${s.title}` })),
    ...ir.uiElements.filter((e) => e.label && e.label.trim() !== '').map((e) => ({ ref: part.get(e.id) ?? e.id, text: e.label ?? '', kind: `部品（${e.kind}）`, node: e, topic: `部品 ${e.label}` })),
    ...ir.errors.map((e) => ({ ref: error.get(e.id) ?? e.id, text: e.message, kind: 'エラー文言', node: e, topic: `エラー ${e.message}` })),
  ].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const rows = entries.map((m, i) => row([`M-${String(i + 1).padStart(3, '0')}`, m.text, m.kind, m.ref], provOf(m.node, ctx, 'D02', m.topic)));
  return section('4. システム文言一覧', 2, [
    rows.length > 0 ? table(['文言ID', '文言', '種別', '参照ID'], rows) : zeroResult(ctx, 'D02', 'システム文言', { uncertain: hasFailedFiles(ir) }),
  ]);
}

function environment(ir: IR, ctx: GenCtx): Section {
  const progFiles = ir.files.filter((f) => f.status === 'analyzed' && f.language !== 'json' && f.language !== 'other');
  const langs = [...new Set(progFiles.map((f) => f.language))].sort();
  const rows = [...ir.dependencies]
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((d) => row([d.name, d.version ?? '（版不明）', d.loadedFrom], provOf(d, ctx, 'D02', `依存 ${d.name}`)));
  return section('5. 動作環境', 2, [
    para(`解析したプログラム言語: ${langs.join('、') || 'なし'}（package.json 等の設定ファイルは含めない）`, factProv(progFiles.map((f) => ({ file: f.path, line: 1 })))),
    rows.length > 0
      ? table(['ライブラリ', '版', '読み込み元'], rows, '詳細は D06 を参照')
      : zeroResult(ctx, 'D02', '依存ライブラリ（動作環境）', { uncertain: hasFailedFiles(ir) }),
  ]);
}

export async function buildD02(ir: IR, ctx: GenCtx): Promise<Document> {
  const { features } = idMaps(ir);
  const explained = new Map<string, ExplainResult>();
  for (const f of features) {
    explained.set(
      f.fn.id,
      await ctx.llm.explain({
        targetId: f.fn.id,
        kind: 'function',
        summary: `機能 ${f.no} ${f.fn.name}（${f.category}）。引数 ${f.fn.params.map((p) => p.name).join(', ') || 'なし'}。呼び出し ${f.fn.calls.join(', ') || 'なし'}`,
        snippets: [],
      }),
    );
  }
  const listRows = features.map((f) => {
    const r = explained.get(f.fn.id);
    const base = provOf(f.fn, ctx, 'D02', `機能 ${f.fn.name}`);
    return row([f.no, f.category, f.fn.name, r?.text ?? ''], r ? rowProvWithLlm(base, r) : base);
  });
  const perFeature: Section[] = [];
  for (const f of features) {
    const r = explained.get(f.fn.id);
    if (r) perFeature.push(...(await featureSections(ir, ctx, f, r)));
  }
  const intro = features.length > 0 ? [] : [zeroResult(ctx, 'D02', '機能', { uncertain: hasFailedFiles(ir) })];
  // 概要の説明文は生成できたときだけ載せる（LLM 無効の旨は文書冒頭の注記 1 回に集約）
  const overviewPara = features.length > 0 ? await explainPara(ctx, 'D02', { targetId: 'system', kind: 'module', summary: `機能 ${features.length} 件: ${features.map((f) => f.fn.name).join(', ')}`, snippets: [] }) : undefined;
  const overview = overviewPara && overviewPara.evidence === 'inference' ? [overviewPara] : [];
  return makeDocument('D02', ctx, [
    section('1. 機能一覧', 2, [designIntentNote(), ...overview, ...(listRows.length > 0 ? [table(['機能ID', '分類', '機能名', '説明'], listRows)] : intro)]),
    section('2. 機能ごとの仕様（テストベース 7 観点）', 2, []),
    ...perFeature,
    errorList(ir, ctx),
    messageList(ir, ctx),
    environment(ir, ctx),
  ]);
}
