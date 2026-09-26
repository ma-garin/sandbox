// 検証の工程（DocAgent の Verifier 相当）: 生成した文書の各行の根拠位置（file:line）を元のソースと照合する。
// (a) 位置の実在: file が入力にあり、line（範囲なら両端）がファイルの行数内
// (b) 識別子の一致: irIds が指す IR 要素の名前と本文中のコード識別子のどれかが、根拠行の前後 3 行以内に字句として現れる
// 文書は書き換えず、不一致の行を不明に下げた新しい文書を返す（D09 への登録は apply.ts）。

import type { Block, Document, ListItem, Provenance } from '../doc/model.ts';
import type { IR, SourceRef } from '../ir/schema.ts';

/** 照合の窓（根拠行の前後の行数） */
export const VERIFY_WINDOW = 3;

export type MismatchKind = 'location' | 'identifier';

export interface VerifyMismatch {
  docId: Document['id'];
  section: string;
  /** 行の要約（本文の先頭） */
  summary: string;
  source: SourceRef;
  kind: MismatchKind;
  /** 見当たらなかった識別子（kind='identifier'） */
  identifiers: string[];
  irIds: string[];
}

export interface VerifyCounts {
  /** 照合した行（source を持つ行） */
  checked: number;
  matched: number;
  mismatchLocation: number;
  mismatchIdentifier: number;
  /** 照合対象外（source なし） */
  skipped: number;
}

/** 行（段落・表の行・列挙）を 1 件照合した結果。undefined は一致 */
export type RowVerdict = { kind: MismatchKind; source: SourceRef; identifiers: string[] } | undefined;

const IDENT = /^[A-Za-z_$][\w$-]*$/;

function lineCount(text: string): number {
  if (text === '') return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
}

function identLike(s: string): boolean {
  return s.length >= 2 && IDENT.test(s) && !NOT_NAME.test(s);
}

/** 名前から照合候補を作る（`a.b` は末尾の `b` も候補にする） */
/** ファイル名（モジュール名）は識別子の候補にしない（`api.js` の `js` は字句として意味を持たない） */
const FILE_NAME = /\.(?:[cm]?[jt]sx?|html?|css|json|vue|svelte)$/i;
/** 無名関数の名前の一部（`anonymous`・`L82`）は候補にしない */
const NOT_NAME = /^(?:anonymous|L\d+)$/;

function namesOf(value: string): string[] {
  if (FILE_NAME.test(value)) return [];
  const out = identLike(value) ? [value] : [];
  const tail = value.split('.').at(-1) ?? '';
  if (tail !== value && identLike(tail)) out.push(tail);
  const hash = /#([A-Za-z_][\w-]*)/.exec(value);
  if (hash?.[1] && identLike(hash[1])) out.push(hash[1]);
  return out;
}

/** IR 要素の id → 名前の候補（関数名・部品の id/name・保存域のキー・定数名など） */
export function irNameIndex(ir: IR): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const value of Object.values(ir)) {
    if (!Array.isArray(value)) continue;
    for (const el of value as unknown[]) {
      if (typeof el !== 'object' || el === null) continue;
      const rec = el as Record<string, unknown>;
      if (typeof rec['id'] !== 'string') continue;
      const names: string[] = [];
      for (const field of ['name', 'domId', 'variable', 'subject', 'key', 'target']) {
        const v = rec[field];
        if (typeof v === 'string') names.push(...namesOf(v));
      }
      const list = rec['names'];
      if (Array.isArray(list)) for (const v of list) if (typeof v === 'string') names.push(...namesOf(v));
      index.set(rec['id'], [...new Set(names)]);
    }
  }
  return index;
}

/** 本文中のコード識別子: `xxx` の中の識別子と FN-…-name の末尾 */
export function textIdentifiers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const inner = m[1] ?? '';
    if (FILE_NAME.test(inner)) continue;
    if (identLike(inner)) out.push(inner);
    for (const t of inner.matchAll(/[A-Za-z_$][\w$-]*/g)) if (identLike(t[0])) out.push(t[0]);
  }
  for (const m of text.matchAll(/\bFN-[^\s`、。，,）)]*-([A-Za-z_$][\w$]*)(?![\w$-])/g)) {
    if (m[1] && identLike(m[1])) out.push(m[1]);
  }
  return [...new Set(out)];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appearsIn(lines: readonly string[], name: string): boolean {
  const re = new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`);
  return lines.some((l) => re.test(l));
}

/** 関数の定義範囲（IR の FunctionInfo） */
export interface FnRange {
  line: number;
  end: number;
}

/** 照合に使う入力（文書全体で共有。行分割・宣言の抽出はファイルごとに 1 回） */
export interface VerifyContext {
  names: ReadonlyMap<string, string[]>;
  files: ReadonlyMap<string, string>;
  /** ファイル → 関数の定義範囲 */
  fnRanges: ReadonlyMap<string, FnRange[]>;
  lines: Map<string, string[]>;
  decls: Map<string, [string, string][]>;
}

export function makeContext(ir: IR, files: ReadonlyMap<string, string>): VerifyContext {
  const fnRanges = new Map<string, FnRange[]>();
  for (const f of ir.functions) {
    const s = f.source[0];
    if (!s) continue;
    fnRanges.set(s.file, [...(fnRanges.get(s.file) ?? []), { line: s.line, end: Math.max(s.line, s.endLine ?? s.line) }]);
  }
  return { names: irNameIndex(ir), files, fnRanges, lines: new Map(), decls: new Map() };
}

function linesOf(ctx: VerifyContext, file: string): string[] | undefined {
  const cached = ctx.lines.get(file);
  if (cached) return cached;
  const body = ctx.files.get(file);
  if (body === undefined) return undefined;
  const split = body.split('\n').slice(0, lineCount(body));
  ctx.lines.set(file, split);
  return split;
}

/** 単純な代入の宣言（`const X = ...`）: [変数名, 右辺] */
const DECL = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/;

function declsOf(ctx: VerifyContext, file: string): [string, string][] {
  const cached = ctx.decls.get(file);
  if (cached) return cached;
  const out: [string, string][] = [];
  for (const l of linesOf(ctx, file) ?? []) {
    const m = DECL.exec(l);
    if (m?.[1] && m[2]) out.push([m[1], m[2]]);
  }
  ctx.decls.set(file, out);
  return out;
}

/** 同じファイルで、候補（キー名・部品 id・関数名）を右辺に持つ変数名（別名） */
export function aliasesOf(decls: readonly [string, string][], candidates: readonly string[]): string[] {
  const out = decls.filter(([name, rhs]) => !candidates.includes(name) && candidates.some((c) => appearsIn([rhs], c))).map(([name]) => name);
  return [...new Set(out)];
}

/** [line, end] を含む最も内側の関数の範囲 */
function enclosingFunction(ranges: readonly FnRange[], line: number, end: number): FnRange | undefined {
  return ranges.filter((r) => r.line <= line && r.end >= end).sort((x, y) => x.end - x.line - (y.end - y.line))[0];
}

/** 1 行を照合する。窓は根拠行の前後 3 行と、その行を含む関数の定義範囲の和 */
export function verifyRow(prov: Provenance, text: string, ctx: VerifyContext): RowVerdict {
  for (const s of prov.source) {
    const ls = linesOf(ctx, s.file);
    const end = s.endLine ?? s.line;
    const inRange = (n: number): boolean => Number.isInteger(n) && n >= 1 && ls !== undefined && n <= ls.length;
    if (!ls || !inRange(s.line) || !inRange(end)) return { kind: 'location', source: s, identifiers: [] };
  }
  const candidates = [...new Set([...(prov.irIds ?? []).flatMap((id) => ctx.names.get(id) ?? []), ...textIdentifiers(text)])];
  if (candidates.length === 0) return undefined;
  for (const s of prov.source) {
    const ls = linesOf(ctx, s.file) ?? [];
    const end = Math.max(s.line, s.endLine ?? s.line);
    const fn = enclosingFunction(ctx.fnRanges.get(s.file) ?? [], s.line, end);
    const from = Math.max(1, Math.min(s.line - VERIFY_WINDOW, fn?.line ?? s.line));
    const to = Math.min(ls.length, Math.max(end + VERIFY_WINDOW, fn?.end ?? end));
    const window = ls.slice(from - 1, to);
    const names = [...candidates, ...aliasesOf(declsOf(ctx, s.file), candidates)];
    if (names.some((c) => appearsIn(window, c))) return undefined;
  }
  const first = prov.source[0] as SourceRef;
  return { kind: 'identifier', source: first, identifiers: candidates };
}

/** 照合で不一致の行に付ける D09 番号を返す関数 */
export type MismatchRegistrar = (m: VerifyMismatch) => string;

function summarize(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
}

interface Walker {
  ctx: VerifyContext;
  /** 照合の対象外の文書（D09 は質問であって主張ではない） */
  skip: boolean;
  register: MismatchRegistrar;
  counts: VerifyCounts;
  mismatches: VerifyMismatch[];
  docId: Document['id'];
  section: string;
}

function visit<T extends Provenance>(w: Walker, row: T, text: string): T {
  if (w.skip || row.source.length === 0) {
    w.counts.skipped += 1;
    return row;
  }
  w.counts.checked += 1;
  const verdict = verifyRow(row, text, w.ctx);
  if (!verdict) {
    w.counts.matched += 1;
    return row;
  }
  if (verdict.kind === 'location') w.counts.mismatchLocation += 1;
  else w.counts.mismatchIdentifier += 1;
  const m: VerifyMismatch = {
    docId: w.docId,
    section: w.section,
    summary: summarize(text),
    source: verdict.source,
    kind: verdict.kind,
    identifiers: verdict.identifiers,
    irIds: [...(row.irIds ?? [])],
  };
  w.mismatches.push(m);
  return { ...row, evidence: 'unknown', d09Ref: w.register(m) };
}

function visitItem(w: Walker, it: ListItem): ListItem {
  const self = visit(w, it, it.text);
  return it.children ? { ...self, children: it.children.map((c) => visitItem(w, c)) } : self;
}

function visitBlock(w: Walker, b: Block): Block {
  switch (b.type) {
    case 'paragraph':
      return visit(w, b, b.text);
    case 'table':
      return { ...b, rows: b.rows.map((r) => visit(w, r, r.cells.join(' | '))) };
    case 'list':
      return { ...b, items: b.items.map((it) => visitItem(w, it)) };
    default:
      return b; // 図は照合しない（行ではない）
  }
}

export interface CheckResult {
  docs: Document[];
  counts: VerifyCounts;
  mismatches: VerifyMismatch[];
}

/** 全文書の全行を照合する（D09 は対象外）。不一致の行は evidence='unknown' と d09Ref を付けた新しい行に置き換える */
export function checkDocuments(
  docs: readonly Document[],
  ir: IR,
  files: ReadonlyMap<string, string>,
  register: MismatchRegistrar,
): CheckResult {
  const counts: VerifyCounts = { checked: 0, matched: 0, mismatchLocation: 0, mismatchIdentifier: 0, skipped: 0 };
  const mismatches: VerifyMismatch[] = [];
  const ctx = makeContext(ir, files);
  const out = docs.map((doc) => ({
    ...doc,
    sections: doc.sections.map((sec) => {
      const w: Walker = { ctx, skip: doc.id === 'D09', register, counts, mismatches, docId: doc.id, section: sec.heading };
      return { ...sec, blocks: sec.blocks.map((b) => visitBlock(w, b)) };
    }),
  }));
  return { docs: out, counts, mismatches };
}
