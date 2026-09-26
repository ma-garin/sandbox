// D12 詳細設計書（IEEE 1016-2009）: モジュール／クラス／関数の一覧・入出力・処理フロー・呼び出しシーケンス・例外処理（REQ-F-039）。
// データ（D04）・連携（D05）は ID で参照する。例外は D02 のエラー ID（IR の ErrorInfo.id）で参照する。

import type { ErrorInfo, FunctionInfo, IR } from '../ir/schema.ts';
import type { DiagramBlock, DiagramEdge, DiagramNode, DocId, Document, Provenance, TableRow } from '../doc/model.ts';
import { type GenCtx, designIntentNote, dynamicCallNote, factProv, hasFailedFiles, isStandardApiCall, makeDocument, mergeProv, para, provOf, row, section, srcText, table, unknownProv, zeroResult } from './common.ts';
import { staticLimitCounts } from './d08.ts';

export { isStandardApiCall } from './common.ts';

const ORIGIN: DocId = 'D12';
const MAX_DEPTH = 8;
export const FLOW_HEADING = '処理フロー（区分順。ソースの実行順ではない）';
export const FLOW_NOTE = '区分順（分岐→データ→連携→呼び出し→例外）。ソースの実行順ではない。';

function paramsText(f: FunctionInfo): string {
  if (f.params.length === 0) return 'なし';
  return f.params.map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}${p.defaultValue ? ` = ${p.defaultValue}` : ''}`).join(', ');
}

function fnProv(f: FunctionInfo, ctx: GenCtx) {
  return provOf(f, ctx, ORIGIN, `関数 ${f.name}`);
}

function moduleRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.modules.map((m) => row([m.id, m.name, m.file, m.kind, srcText(m.source)], provOf(m, ctx, ORIGIN, `モジュール ${m.name}`)));
}

function classRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.classes.map((c) =>
    row(
      [c.id, c.name, c.moduleId, c.extends ?? '—', c.methods.join(', ') || 'なし', c.properties.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ') || 'なし', srcText(c.source)],
      provOf(c, ctx, ORIGIN, `クラス ${c.name}`),
    ),
  );
}

function functionRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.functions.map((f) =>
    row(
      [f.id, f.name, f.moduleId, f.classId ?? '—', paramsText(f), f.returns ?? '型注釈なし', f.async ? '非同期' : '同期', f.exported ? '公開' : '内部', String(f.complexity), srcText(f.source)],
      fnProv(f, ctx),
    ),
  );
}

/** 呼び出し先の表示。自前の関数に解決できれば名前と ID、標準 API なら「標準 API」、どちらでもなければ「未解決」 */
function calleeName(ir: IR, call: string): string {
  const f = ir.functions.find((x) => x.id === call);
  if (f) return `${f.name}（${f.id}）`;
  return isStandardApiCall(call, new Set(ir.functions.map((x) => x.name))) ? `${call}（標準 API）` : `${call}（未解決）`;
}

/** 関数内に位置するデータ項目（D04 参照用） */
function dataInFunction(ir: IR, f: FunctionInfo): string[] {
  const within = (file: string, line: number): boolean =>
    f.source.some((s) => s.file === file && line >= s.line && line <= (s.endLine ?? s.line));
  return ir.dataItems.filter((d) => d.source.some((s) => within(s.file, s.line))).map((d) => d.id);
}

function flowRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.functions.map((f) => {
    const rules = ir.rules.filter((r) => r.functionId === f.id);
    const ints = ir.integrations.filter((i) => i.functionId === f.id);
    const data = dataInFunction(ir, f);
    const steps = [
      ...rules.map((r) => `分岐 ${r.id}（${r.name}・${r.cases.length} 通り）`),
      ...data.map((id) => `データ D04 ${id}`),
      ...ints.map((i) => `連携 D05 ${i.id}`),
      ...f.calls.map((c) => `呼び出し ${calleeName(ir, c)}`),
      ...f.throws.map((e) => `例外 ${e}`),
    ];
    const text = steps.length > 0 ? steps.map((s, n) => `${n + 1}. ${s}`).join(' / ') : '分岐・呼び出し・連携なし';
    return row([f.id, f.name, text], mergeProv([fnProv(f, ctx), ...rules.map((r) => provOf(r, ctx, ORIGIN, `業務ルール ${r.name}`))]));
  });
}

function sequenceRows(ir: IR, ctx: GenCtx): { rows: TableRow[]; omitted: number } {
  const byId = new Map(ir.functions.map((f) => [f.id, f] as const));
  const byName = new Map(ir.functions.map((f) => [f.name, f] as const));
  const called = new Set(ir.functions.flatMap((f) => f.calls));
  const roots: { seqId: string; origin: string; fn: FunctionInfo }[] = [];
  for (const h of ir.eventHandlers) {
    const fn = byId.get(h.handler) ?? byName.get(h.handler);
    if (fn) roots.push({ seqId: `SEQ-${h.id}`, origin: `${h.target} の ${h.event}`, fn });
  }
  const ownNames = new Set(byName.keys());
  const isStandard = (c: string): boolean => !byId.has(c) && isStandardApiCall(c, ownNames);
  const rooted = new Set(roots.map((r) => r.fn.id));
  for (const f of ir.functions) {
    if (f.calls.length > 0 && !called.has(f.id) && !rooted.has(f.id)) roots.push({ seqId: `SEQ-${f.id}`, origin: `${f.name} の呼び出し`, fn: f });
  }
  const perRoot = roots.map(({ seqId, origin, fn }) => {
    const out: TableRow[] = [];
    const skipped: string[] = [];
    const visit = (f: FunctionInfo, depth: number, seen: ReadonlySet<string>): void => {
      if (depth >= MAX_DEPTH) return;
      for (const c of f.calls) {
        if (isStandard(c)) {
          skipped.push(c);
          continue;
        }
        out.push(row([seqId, origin, String(out.length + 1), `${f.name}（${f.id}）`, calleeName(ir, c)], fnProv(f, ctx)));
        const next = byId.get(c);
        if (next && !seen.has(next.id)) visit(next, depth + 1, new Set([...seen, next.id]));
      }
    };
    visit(fn, 0, new Set([fn.id]));
    return { out, skipped: skipped.length };
  });
  return { rows: perRoot.flatMap((p) => p.out), omitted: perRoot.reduce((n, p) => n + p.skipped, 0) };
}

/**
 * 呼び出し関係図: 機能の起点（イベントハンドラ、または誰からも呼ばれず他を呼ぶ関数）から、呼び出しで到達する関数をたどる。
 * 未解決の呼び出し先は描かない（表の「呼び出しのシーケンス」に残る）
 */
function callDiagram(ir: IR): DiagramBlock | undefined {
  const byId = new Map(ir.functions.map((f) => [f.id, f] as const));
  const byName = new Map(ir.functions.map((f) => [f.name, f] as const));
  const called = new Set(ir.functions.flatMap((f) => f.calls));
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const edgeKeys = new Set<string>();
  const reached = new Set<string>();
  const addEdge = (from: string, to: string): void => {
    if (edgeKeys.has(`${from}|${to}`)) return;
    edgeKeys.add(`${from}|${to}`);
    edges.push({ from, to });
  };
  const visit = (f: FunctionInfo): void => {
    if (reached.has(f.id)) return;
    reached.add(f.id);
    nodes.push({ id: f.id, label: f.name, group: f.moduleId });
    for (const c of f.calls) {
      const next = byId.get(c);
      if (!next) continue;
      addEdge(f.id, next.id);
      visit(next);
    }
  };
  const handlers = ir.eventHandlers.flatMap((h) => {
    const fn = byId.get(h.handler) ?? byName.get(h.handler);
    return fn ? [{ h, fn }] : [];
  });
  for (const { h, fn } of handlers) {
    const rootId = `root:${h.id}`;
    nodes.push({ id: rootId, label: `${h.target} の ${h.event}`, group: '機能の起点' });
    addEdge(rootId, fn.id);
    visit(fn);
  }
  for (const f of ir.functions) {
    if (f.calls.length > 0 && !called.has(f.id) && !reached.has(f.id)) visit(f);
  }
  if (nodes.length === 0) return undefined;
  const fns = ir.functions.filter((f) => reached.has(f.id));
  return {
    type: 'diagram',
    title: '呼び出し関係図',
    diagramType: 'flow',
    nodes,
    edges,
    provenance: factProv([...handlers.flatMap(({ h }) => h.source), ...fns.flatMap((f) => f.source)], [...handlers.map(({ h }) => h.id), ...fns.map((f) => f.id)]),
  };
}

/** 発生条件が無い・「条件分岐なし」のときは断定せず D09 に送る（到達可能性を解析していないため） */
export function conditionCell(e: ErrorInfo, ctx: GenCtx): { text: string; prov?: Provenance } {
  const c = e.condition.trim();
  if (c !== '' && !c.includes('条件分岐なし')) return { text: c };
  const d09Ref = ctx.d09.register({
    key: `error-condition:${e.id}`,
    topic: `エラー ${e.message} の発生条件`,
    question: `エラー「${e.message}」の発生条件をソースから確定できない（到達するかを含めて確認してください）`,
    category: 'unknown-value',
    relatedIds: [e.id],
    source: e.source,
    origin: ORIGIN,
  });
  return { text: `不明（${d09Ref}）`, prov: unknownProv(d09Ref, [e.id], e.source) };
}

function exceptionRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.functions.flatMap((f) => {
    const ids = [...new Set([...f.throws, ...ir.errors.filter((e) => e.functionId === f.id).map((e) => e.id)])];
    return ids.map((id) => {
      const e = ir.errors.find((x) => x.id === id);
      if (!e) return row([f.id, `D02 ${id}`, '—', '—', '—', srcText(f.source)], fnProv(f, ctx));
      const cond = conditionCell(e, ctx);
      return row(
        [f.id, `D02 ${e.id}`, e.kind, cond.text, e.afterState ?? '—', srcText(e.source)],
        mergeProv([fnProv(f, ctx), provOf(e, ctx, ORIGIN, `エラー ${e.message}`), ...(cond.prov ? [cond.prov] : [])]),
      );
    });
  });
}

export function buildD12(ir: IR, ctx: GenCtx): Document {
  const uncertain = hasFailedFiles(ir);
  const zero = (topic: string) => zeroResult(ctx, ORIGIN, topic, { uncertain });
  const mods = moduleRows(ir, ctx);
  const cls = classRows(ir, ctx);
  const fns = functionRows(ir, ctx);
  const flows = flowRows(ir, ctx);
  const seqs = sequenceRows(ir, ctx);
  const calls = callDiagram(ir);
  const excs = exceptionRows(ir, ctx);
  return makeDocument(ORIGIN, ctx, [
    section('モジュール一覧', 2, [designIntentNote(), mods.length > 0 ? table(['モジュールID', '名前', 'ファイル', '種類', '根拠位置'], mods) : zero('モジュール')]),
    section('クラス一覧', 2, [cls.length > 0 ? table(['クラスID', '名前', 'モジュールID', '継承', 'メソッド', 'プロパティ', '根拠位置'], cls) : zero('クラス')]),
    section('関数一覧と入出力', 2, [fns.length > 0 ? table(['関数ID', '名前', 'モジュールID', 'クラスID', '入力', '出力', '同期', '公開', '複雑度', '根拠位置'], fns) : zero('関数')]),
    section(FLOW_HEADING, 2, [para(FLOW_NOTE, factProv([])), flows.length > 0 ? table(['関数ID', '名前', '処理フロー'], flows, 'データは D04、連携は D05、例外は D02 の ID') : zero('処理フロー')]),
    section('呼び出しのシーケンス', 2, [
      ...(calls ? [calls, dynamicCallNote(staticLimitCounts(ir))] : []),
      seqs.rows.length > 0 ? table(['シーケンスID', '起点', '順', '呼び出し元', '呼び出し先'], seqs.rows) : zero('呼び出しのシーケンス'),
      ...(seqs.omitted > 0 ? [para(`標準 API の呼び出し ${seqs.omitted} 件は省略`, factProv([]))] : []),
    ]),
    section('例外処理', 2, [excs.length > 0 ? table(['関数ID', 'エラーID', '種別', '発生条件', '発生後の状態', '根拠位置'], excs) : zero('例外処理')]),
  ]);
}
