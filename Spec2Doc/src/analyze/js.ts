// JS/TS 解析器（REQ-F-006・009〜014・024・033・034・036・037）。
// typescript の Compiler API で構文木だけを作り（型検査はしない）、構文パターンで IR の配列フィールドを埋める。
// 1 ファイルの構文失敗は例外にせず、unknowns（parse-failure）と failed に積む。
import ts from 'typescript';
import type { FunctionInfo, IR } from '../ir/schema.ts';
import { collectData, collectDefaults } from './js-data.ts';
import { collectErrors, collectIntegrations, collectStates } from './js-flow.ts';
import { collectRules } from './js-rules.ts';
import { collectDeclarations, collectModuleItems, moduleKind } from './js-structure.ts';
import { type FileCtx, type JsOut, OUT_KEYS, fileKey, newOut } from './js-util.ts';

export interface JsInputFile {
  path: string; // 入力ルートからの相対パス
  abs: string;
  text: string;
}

export type JsAnalysis = Partial<IR> & JsOut & { failed: { path: string; reason: string }[] };

const JS_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|mts|cts)$/i;

function scriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(file)) return ts.ScriptKind.JSX;
  if (/\.(ts|mts|cts)$/i.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parseError(sf: ts.SourceFile): string | undefined {
  const diags = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  const d = diags[0];
  if (!d) return undefined;
  const line = d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
  return `構文エラー（${line} 行）: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
}

function analyzeFile(file: string, sf: ts.SourceFile, ids: Set<string>): { out: JsOut; refs: Map<string, number> } {
  const out = newOut();
  const moduleId = `MOD-${fileKey(file)}`;
  ids.add(moduleId);
  const ctx: FileCtx = {
    file,
    sf,
    moduleId,
    out,
    ids,
    fnIds: new Map(),
    fnNames: new Map(),
    classIds: new Map(),
    consts: new Map(),
    refs: new Map(),
    netFns: new Set(),
    stateAfterFn: new Map(),
    numbers: [],
  };
  const kind = moduleKind(file, sf);
  out.modules.push({ id: moduleId, source: [{ file, line: 1 }], evidence: 'fact', name: file.split('/').pop() ?? file, file, kind });
  collectDeclarations(ctx);
  collectModuleItems(ctx, kind);
  collectRules(ctx);
  collectStates(ctx);
  collectIntegrations(ctx);
  collectErrors(ctx);
  collectData(ctx);
  collectDefaults(ctx);
  return { out, refs: ctx.refs };
}

function merge(target: JsOut, src: JsOut): void {
  for (const k of OUT_KEYS) (target[k] as unknown[]).push(...(src[k] as unknown[]));
}

function resolver(fns: readonly FunctionInfo[]): (name: string, moduleId: string) => string | undefined {
  const byName = new Map<string, FunctionInfo[]>();
  for (const f of fns) byName.set(f.name, [...(byName.get(f.name) ?? []), f]);
  return (name, moduleId) => {
    const list = byName.get(name) ?? [];
    return (list.find((f) => f.moduleId === moduleId) ?? (list.length === 1 ? list[0] : undefined))?.id;
  };
}

/** ファイルをまたぐ後処理: 参照回数・呼び出し先・ハンドラ・契機の解決 */
function link(out: JsOut, refs: Map<string, number>): void {
  const resolve = resolver(out.functions);
  for (const f of out.functions) {
    if (!f.name.startsWith('<')) f.refCount = refs.get(f.name.split('.').pop() ?? f.name) ?? 0;
    f.calls = f.calls.map((c) => resolve(c, f.moduleId) ?? c);
  }
  for (const c of out.classes) c.refCount = refs.get(c.name) ?? 0;
  for (const e of out.exports) {
    e.refCount = out.imports.filter((i) => i.moduleId !== e.moduleId && (i.names.includes(e.name) || i.names.includes('*'))).length;
  }
  const modOf = new Map(out.eventHandlers.map((h) => [h.id, h.source[0]?.file ?? '']));
  const label = new Map<string, string>();
  for (const h of out.eventHandlers) {
    const fid = h.handler.startsWith('FN-') ? h.handler : resolve(h.handler, `MOD-${fileKey(modOf.get(h.id) ?? '')}`);
    if (fid) h.handler = fid;
    const fn = out.functions.find((f) => f.id === fid);
    if (fn) label.set(fn.name, `${fn.name}（${h.target} の ${h.event}）`);
  }
  for (const s of out.states) for (const t of s.transitions) t.trigger = label.get(t.trigger) ?? t.trigger;
  // 追加欄（schema 外）: 保存域の値の項目名が型定義の項目名と一致すれば、その型の ID を推測として載せる
  for (const d of out.dataItems) {
    if ((d.kind !== 'localStorage' && d.kind !== 'sessionStorage') || d.fields.length === 0) continue;
    const names = d.fields.map((f) => f.name).sort().join(',');
    const t = out.dataItems.find((x) => (x.kind === 'interface' || x.kind === 'typeAlias') && x.fields.map((f) => f.name).sort().join(',') === names);
    if (t) Object.assign(d, { valueTypeId: t.id, valueTypeEvidence: 'inference' });
  }
  for (const i of out.integrations) {
    if (!i.functionId) continue;
    const callers = out.functions.filter((f) => f.calls.includes(i.functionId ?? '')).map((f) => label.get(f.name) ?? f.name);
    if (callers.length > 0) i.timing = `${i.timing}（呼び出し元: ${callers.join('、')}）`;
  }
}

export function analyzeJsTs(files: readonly JsInputFile[]): JsAnalysis {
  const out = newOut();
  const failed: { path: string; reason: string }[] = [];
  const ids = new Set<string>();
  const refs = new Map<string, number>();
  for (const f of files) {
    const file = f.path.replace(/\\/g, '/');
    if (!JS_EXT.test(file)) continue;
    let reason: string | undefined;
    try {
      const sf = ts.createSourceFile(file, f.text, ts.ScriptTarget.Latest, true, scriptKind(file));
      reason = parseError(sf);
      if (reason === undefined) {
        const r = analyzeFile(file, sf, ids);
        merge(out, r.out);
        for (const [k, v] of r.refs) refs.set(k, (refs.get(k) ?? 0) + v);
      }
    } catch (e) {
      reason = `解析中の例外: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (reason !== undefined) {
      failed.push({ path: file, reason });
      out.unknowns.push({
        id: `UNK-${fileKey(file)}-parse-failure`,
        source: [{ file, line: 1 }],
        evidence: 'unknown',
        topic: `${file} の解析失敗`,
        question: `${reason}。このファイルの内容は文書に反映されていない`,
        relatedIds: [],
        category: 'parse-failure',
      });
    }
  }
  link(out, refs);
  return { ...out, failed };
}
