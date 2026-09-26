// D07 移行論点・技術的負債一覧: 未参照の関数・export、循環的複雑度 10 超の関数、大域変数（REQ-F-024）、変更影響分析。

import type { FunctionInfo, IR, SourceRef } from '../ir/schema.ts';
import type { Block, DocId, Document, Provenance, Section, TableRow } from '../doc/model.ts';
import {
  type GenCtx,
  bySource,
  factProv,
  hasFailedFiles,
  idMaps,
  makeDocument,
  para,
  provOf,
  row,
  section,
  srcText,
  table,
  uniqueSources,
  unknownProv,
  zeroResult,
} from './common.ts';

const ORIGIN: DocId = 'D07';
export const COMPLEXITY_LIMIT = 10;

const COLUMNS = ['論点No.', '区分', '対象ID', '名前', '詳細', '根拠位置'];

function isAnonymous(name: string): boolean {
  return name.startsWith('<anonymous');
}

/** 区分ごとの行（番号は後で振る） */
function issueRows(ir: IR, ctx: GenCtx): { kind: string; cells: string[]; row: (no: string) => TableRow }[] {
  const handlerRefs = new Set(ir.eventHandlers.map((h) => h.handler));
  const exportedTargets = new Set(ir.exports.map((e) => e.targetId).filter((x): x is string => x !== undefined));
  const out: { kind: string; cells: string[]; row: (no: string) => TableRow }[] = [];
  const push = (kind: string, id: string, name: string, detail: string, prov: ReturnType<typeof provOf>, source: string): void => {
    const cells = [kind, id, name, detail, source];
    out.push({ kind, cells, row: (no) => row([no, ...cells], prov) });
  };

  for (const f of ir.functions) {
    if (f.refCount !== 0 || isAnonymous(f.name) || handlerRefs.has(f.id) || handlerRefs.has(f.name)) continue;
    if (f.exported && exportedTargets.has(f.id)) continue; // export 側で数える
    push('未参照の関数', f.id, f.name, '参照 0 回', provOf(f, ctx, ORIGIN, `関数 ${f.name}`), srcText(f.source));
  }
  for (const e of ir.exports) {
    if (e.refCount !== 0) continue;
    push('未参照の export', e.id, e.name, '取り込み 0 回', provOf(e, ctx, ORIGIN, `export ${e.name}`), srcText(e.source));
  }
  for (const f of ir.functions) {
    if (f.complexity <= COMPLEXITY_LIMIT) continue;
    push('複雑度 10 超', f.id, f.name, `循環的複雑度 ${f.complexity}（基準 ${COMPLEXITY_LIMIT} 以下）`, provOf(f, ctx, ORIGIN, `関数 ${f.name}`), srcText(f.source));
  }
  for (const g of ir.globals) {
    push('大域変数', g.id, g.name, `宣言 ${g.kind}`, provOf(g, ctx, ORIGIN, `大域変数 ${g.name}`), srcText(g.source));
  }
  return out;
}

// ---------- 変更影響分析（呼び出し関係を逆にたどる） ----------

/** 影響する機能がこの数以上の関数を「影響が広い」とする */
export const WIDE_IMPACT = 5;

export const IMPACT_COLUMNS = [
  '関数ID',
  '関数名',
  '影響の広さ',
  '影響する機能（D02）',
  '影響段数（最大）',
  '影響する画面（D03）',
  '影響するデータ（D04）',
  '影響する連携（D05）',
  '根拠位置（関数と呼び出し元）',
];

export interface ImpactEntry {
  fn: FunctionInfo;
  /** 機能 ID → 段数（0 = 関数自身が機能） */
  features: Map<string, number>;
  screens: string[];
  data: string[];
  integrations: string[];
  /** 影響が及ぶ関数（自身を含む）→ 段数 */
  reached: Map<string, number>;
}

function callerIndex(ir: IR): Map<string, FunctionInfo[]> {
  const byId = new Map(ir.functions.map((f) => [f.id, f]));
  const callers = new Map<string, FunctionInfo[]>();
  for (const g of ir.functions) {
    for (const c of new Set(g.calls)) {
      if (!byId.has(c) || c === g.id) continue;
      callers.set(c, [...(callers.get(c) ?? []), g]);
    }
  }
  return callers;
}

/** f から呼び出し元へ幅優先でたどり、到達した関数と最短段数を返す */
function reachUp(f: FunctionInfo, callers: Map<string, FunctionInfo[]>): Map<string, number> {
  const reached = new Map<string, number>([[f.id, 0]]);
  let frontier = [f.id];
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const g of callers.get(id) ?? []) {
        if (reached.has(g.id)) continue;
        reached.set(g.id, depth);
        next.push(g.id);
      }
    }
    frontier = next;
  }
  return reached;
}

function within(inner: SourceRef, outer: SourceRef): boolean {
  const end = outer.endLine ?? outer.line;
  return inner.file === outer.file && inner.line >= outer.line && inner.line <= end;
}

function inFunction(node: { source: SourceRef[] }, f: FunctionInfo): boolean {
  return node.source.some((s) => f.source.some((o) => within(s, o)));
}

export function impactEntries(ir: IR): ImpactEntry[] {
  const maps = idMaps(ir);
  const callers = callerIndex(ir);
  const byId = new Map(ir.functions.map((f) => [f.id, f]));
  const elementScreen = new Map(ir.uiElements.map((u) => [u.id, u.screenId]));
  return ir.functions.map((fn) => {
    const reached = reachUp(fn, callers);
    const features = new Map<string, number>();
    const screenIds = new Set<string>();
    for (const [id, depth] of reached) {
      const no = maps.feature.get(id);
      if (no !== undefined && !features.has(no)) features.set(no, depth);
      const g = byId.get(id);
      for (const h of ir.eventHandlers) {
        if (h.handler !== id && h.handler !== g?.name) continue;
        const sid = h.uiElementId ? elementScreen.get(h.uiElementId) : undefined;
        const sno = sid ? maps.screen.get(sid) : undefined;
        if (sno) screenIds.add(sno);
      }
    }
    const data = ir.dataItems.filter((d) => inFunction(d, fn)).map((d) => `${d.name}（${d.kind}）`);
    const integrations = ir.integrations
      .filter((i) => i.functionId === fn.id || (i.functionId === undefined && inFunction(i, fn)))
      .map((i) => `${i.method} ${i.url}`);
    return { fn, features, screens: [...screenIds].sort(), data: [...new Set(data)], integrations: [...new Set(integrations)], reached };
  });
}

/** 組み込み・標準の大域関数（呼び出し先を追わないが、不明にもしない） */
const BUILTIN_CALLS = new Set([
  'Number', 'String', 'Boolean', 'Array', 'Object', 'Symbol', 'BigInt', 'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'queueMicrotask', 'structuredClone',
  'fetch', 'alert', 'confirm', 'prompt', 'require', 'import', 'super',
]);

/**
 * 呼び出し先を静的に追えない呼び出し = IR の関数に解決できず、組み込みでもない識別子の呼び出し
 * （変数に入れた関数・引数で受けた関数）と、計算されたプロパティの呼び出し（`obj[key]()`）。
 * `a.b()` 形のメソッド呼び出しは標準 API・外部ライブラリとして扱い、ここには含めない
 */
function isDynamicCall(name: string): boolean {
  if (/^[A-Za-z_$][\w$]*$/.test(name)) return !BUILTIN_CALLS.has(name);
  return /^[A-Za-z_$][\w$.]*\[[^\]]*\]$/.test(name);
}

function unresolvedCalls(ir: IR): { fn: FunctionInfo; name: string }[] {
  const ids = new Set(ir.functions.map((f) => f.id));
  return ir.functions.flatMap((fn) =>
    [...new Set(fn.calls)].filter((c) => !ids.has(c) && isDynamicCall(c)).map((name) => ({ fn, name })),
  );
}

function unknownD09(ctx: GenCtx, fn: FunctionInfo, question: string, key: string): string {
  return ctx.d09.register({ key, topic: `関数 ${fn.name} の変更影響`, question, category: 'other', relatedIds: [fn.id], source: fn.source, origin: ORIGIN });
}

function impactRow(e: ImpactEntry, ir: IR, ctx: GenCtx): TableRow {
  const { fn } = e;
  const callerSrc = [...e.reached.keys()].filter((id) => id !== fn.id).flatMap((id) => ir.functions.find((g) => g.id === id)?.source ?? []);
  const source = uniqueSources([...fn.source, ...callerSrc]);
  const irIds = [...e.reached.keys()];
  const depth = e.features.size > 0 ? Math.max(...e.features.values()) : undefined;
  let featureCell = [...e.features].map(([no, d]) => `${no}（${d}段）`).join('、');
  let prov: Provenance = factProv(source, irIds);
  if (e.features.size === 0) {
    if (fn.refCount > 0 || isAnonymous(fn.name)) {
      const ref = unknownD09(ctx, fn, `関数 ${fn.name} は参照されているが、呼び出し元を静的にたどれない（動的呼び出し・コールバック等）`, `impact:${fn.id}`);
      featureCell = `不明（${ref}）`;
      prov = unknownProv(ref, irIds, source);
    } else {
      featureCell = 'なし（未参照）';
    }
  }
  const wide = e.features.size >= WIDE_IMPACT ? `影響が広い（${e.features.size} 機能）` : `${e.features.size} 機能`;
  const list = (xs: string[]): string => (xs.length > 0 ? xs.join('、') : 'なし');
  return row(
    [fn.id, fn.name, wide, featureCell, depth === undefined ? '-' : String(depth), list(e.screens), list(e.data), list(e.integrations), srcText(source)],
    prov,
  );
}

/** 影響が広い関数を上位に、次に影響する機能の数の多い順、同数はソース順 */
function byImpact(a: ImpactEntry, b: ImpactEntry): number {
  const wa = a.features.size >= WIDE_IMPACT ? 1 : 0;
  const wb = b.features.size >= WIDE_IMPACT ? 1 : 0;
  if (wa !== wb) return wb - wa;
  if (a.features.size !== b.features.size) return b.features.size - a.features.size;
  return bySource(a.fn, b.fn);
}

export function impactSection(ir: IR, ctx: GenCtx): Section {
  const entries = [...impactEntries(ir)].sort(byImpact);
  const rows = entries.map((e) => impactRow(e, ir, ctx));
  const unresolved = unresolvedCalls(ir).map(({ fn, name }) => {
    const ref = unknownD09(ctx, fn, `関数 ${fn.name} の呼び出し ${name} の呼び出し先を静的に解決できない`, `impact-call:${fn.id}:${name}`);
    return row([fn.id, fn.name, name, `不明（${ref}）`, srcText(fn.source)], unknownProv(ref, [fn.id], fn.source));
  });
  const blocks: Block[] = [
    para(
      `関数ごとに、呼び出し関係を逆にたどって影響を受ける機能・画面・データ・連携を示す。段数は変更した関数から機能までの呼び出しの段数（0 = 関数自身が機能）。${WIDE_IMPACT} 機能以上に影響する関数を「影響が広い」として上位に置く。`,
      factProv(uniqueSources(ir.functions.flatMap((f) => f.source)), ir.functions.map((f) => f.id)),
    ),
    rows.length > 0 ? table(IMPACT_COLUMNS, rows) : zeroResult(ctx, ORIGIN, '変更影響分析の対象関数', { uncertain: hasFailedFiles(ir) }),
  ];
  if (unresolved.length > 0) blocks.push(table(['関数ID', '関数名', '呼び出し名', '呼び出し先', '根拠位置'], unresolved, '呼び出し先を追えない呼び出し'));
  return section('変更影響分析', 2, blocks);
}

export function buildD07(ir: IR, ctx: GenCtx): Document {
  const issues = issueRows(ir, ctx);
  const rows = issues.map((x, n) => x.row(`D07-${n + 1}`));
  const kinds = ['未参照の関数', '未参照の export', '複雑度 10 超', '大域変数'];
  const countRows = kinds.map((k) => {
    const hit = rows.filter((r) => r.cells[1] === k);
    return row([k, String(hit.length)], { evidence: 'fact', source: hit.flatMap((r) => r.source), irIds: hit.flatMap((r) => r.irIds ?? []) });
  });
  return makeDocument(ORIGIN, ctx, [
    section('区分別の件数', 2, [table(['区分', '件数'], countRows)]),
    section('移行論点一覧', 2, [
      rows.length > 0 ? table(COLUMNS, rows) : zeroResult(ctx, ORIGIN, '移行論点', { uncertain: hasFailedFiles(ir) }),
    ]),
    impactSection(ir, ctx),
  ]);
}
