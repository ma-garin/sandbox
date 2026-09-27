// トレーサビリティの図のデータ（TraceGraph）を IR と文書から作る。
// folder → file → code（IR の要素）と doc → section を包含でつなぎ、文書の各行を TraceLink にする。
// link の id は差分機能と同じ正規化（ソース位置・行番号を伏せる）で作り、再実行で同じ行なら同じ id になる。

import { createHash } from 'node:crypto';
import type { Block, DocId, Document, ListItem, Provenance, TableBlock } from '../doc/model.ts';
import type { FileStatus, IR, IrNode } from '../ir/schema.ts';
import { maskLineCounts, stripPositions } from '../generate/index.ts';
import { displayName } from '../generate/common.ts';
import { TRACE_VERSION, type TraceEdge, type TraceEdgeKind, type TraceGraph, type TraceLink, type TraceNode } from './schema.ts';

export interface TraceMeta {
  runId: string;
  source?: string;
  generatedAt: string;
}

const REVISION_HEADING = '改版履歴';
const SUMMARY_MAX = 80;

type CodeListKey = { [K in keyof IR]: IR[K] extends readonly IrNode[] ? K : never }[keyof IR];

/** code ノードにする IR の一覧と codeKind。files・modules・imports・exports はファイル単位の情報なので点にしない */
const CODE_KINDS: readonly (readonly [CodeListKey, string])[] = [
  ['functions', 'function'],
  ['classes', 'class'],
  ['screens', 'screen'],
  ['uiElements', 'uiElement'],
  ['eventHandlers', 'eventHandler'],
  ['rules', 'rule'],
  ['boundaries', 'boundary'],
  ['states', 'state'],
  ['errors', 'error'],
  ['integrations', 'integration'],
  ['dataItems', 'dataItem'],
  ['defaults', 'default'],
  ['cssRules', 'cssRule'],
  ['globals', 'global'],
  ['dependencies', 'dependency'],
  ['unknowns', 'unknown'],
];

const LABEL_KEYS = ['name', 'title', 'label', 'subject', 'variable', 'message', 'topic', 'url', 'selector', 'target'] as const;

interface Range {
  id: string;
  start: number;
  end: number;
}

interface Row {
  text: string;
  /** id の計算に使う文字列（行数の列は伏せる） */
  key: string;
  prov: Provenance;
  /** 束ねるときの鍵にする IR の ID。D13 は「導出元」列に現れる ID、それ以外（と導出元が読めない行）は irIds */
  groupIds: readonly string[];
}

/** 行から作った link と、束ねる鍵 */
interface Candidate {
  link: TraceLink;
  groupIds: readonly string[];
}

/** 束ねた link。alsoIn は代表以外の節の見出しの連なり（schema 外の追加欄。T2 が表示に使う） */
export type BundledLink = TraceLink & { alsoIn?: string[] };

/** 入力元からの相対パス（区切りは /）。絶対パスが来たら末尾の名前だけにする */
export function relPath(path: string): string {
  const p = path.replace(/\\/g, '/');
  if (/^([A-Za-z]:)?\//.test(p)) return p.split('/').filter((x) => x !== '').at(-1) ?? p;
  return p.replace(/^\.\//, '');
}

const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 16);
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

function summarize(text: string): string {
  const s = oneLine(text);
  return s.length > SUMMARY_MAX ? `${s.slice(0, SUMMARY_MAX - 1)}…` : s;
}

function labelOf(n: IrNode): string {
  const rec = n as unknown as Record<string, unknown>;
  for (const k of LABEL_KEYS) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim() !== '') return displayName(v);
  }
  return n.id;
}

/** 入力元そのものを表す最上位のフォルダ。フォルダを持たない入力でも folder → file の階層にする */
export const ROOT_FOLDER_ID = 'folder:.';

/** 最上位フォルダの表示名。「フォルダ: sample-app」→「sample-app」 */
function rootLabel(source: string | undefined): string {
  const name = source?.replace(/^[^:：]+[:：]\s*/, '').trim();
  return name && name !== '' ? name : '入力元';
}

/** 解析が schema の外に載せる追加欄（src/analyze/js-data.ts の access、js-structure.ts の readsUiIds） */
interface DataAccess {
  functionId?: string;
  op?: string;
}
type WithAccess = { access?: readonly DataAccess[] };
type WithReads = { readsUiIds?: readonly string[] };

/** uses の線のラベル（C/R/U/D）。schema の TraceEdge には無い追加欄 */
export type LabeledEdge = TraceEdge & { label?: string };

const CRUD = ['C', 'R', 'U', 'D'] as const;

/** 「R」「C/U」などを合わせて C/R/U/D の順に並べる */
function mergeOps(...ops: (string | undefined)[]): string {
  const letters = new Set(ops.flatMap((o) => (o ?? '').split(/[^A-Za-z]+/)).map((x) => x.toUpperCase()));
  return CRUD.filter((c) => letters.has(c)).join('/');
}

class GraphBuilder {
  readonly nodes = new Map<string, TraceNode>();
  readonly edges = new Map<string, LabeledEdge>();

  constructor(rootName: string) {
    this.nodes.set(ROOT_FOLDER_ID, { id: ROOT_FOLDER_ID, kind: 'folder', label: rootName, path: '.' });
  }

  addNode(node: TraceNode): void {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
  }

  /** 両端が点として存在するときだけ線を足す（解決できない呼び出し先などは捨てる） */
  addEdge(from: string, to: string, kind: TraceEdgeKind, op?: string): void {
    if (from === to || !this.nodes.has(from) || !this.nodes.has(to)) return;
    const key = `${kind}\u0000${from}\u0000${to}`;
    const prev = this.edges.get(key);
    const label = op === undefined && prev?.label === undefined ? '' : mergeOps(prev?.label, op);
    this.edges.set(key, { from, to, kind, ...(label !== '' ? { label } : {}) });
  }

  /** ファイルの点と、そこまでのフォルダの点を作る。返り値はファイルの点の id */
  ensureFile(path: string, status?: FileStatus): string {
    const rel = relPath(path);
    const id = `file:${rel}`;
    if (this.nodes.has(id)) return id;
    const parts = rel.split('/').filter((x) => x !== '');
    let parent = ROOT_FOLDER_ID;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      const folderId = `folder:${folderPath}`;
      this.addNode({ id: folderId, kind: 'folder', label: parts[i] ?? folderPath, path: folderPath, parent });
      this.addEdge(parent, folderId, 'contains');
      parent = folderId;
    }
    this.addNode({ id, kind: 'file', label: parts.at(-1) ?? rel, path: rel, parent, ...(status ? { fileStatus: status } : {}) });
    this.addEdge(parent, id, 'contains');
    return id;
  }
}

/** IR の要素を code の点にし、ファイルごとの定義範囲を返す */
function addCode(b: GraphBuilder, ir: IR): Map<string, Range[]> {
  const byFile = new Map<string, Range[]>();
  for (const [key, codeKind] of CODE_KINDS) {
    const list: readonly IrNode[] = ir[key];
    for (const n of list) {
      const id = `code:${n.id}`;
      if (b.nodes.has(id)) continue;
      const first = n.source[0];
      const parent = first ? b.ensureFile(first.file) : undefined;
      b.addNode({ id, kind: 'code', label: labelOf(n), codeKind, ...(first ? { line: first.line } : {}), ...(parent ? { parent } : {}) });
      if (parent) b.addEdge(parent, id, 'contains');
      for (const s of n.source) {
        const file = relPath(s.file);
        byFile.set(file, [...(byFile.get(file) ?? []), { id, start: s.line, end: s.endLine ?? s.line }]);
      }
    }
  }
  return byFile;
}

const containing = (ranges: readonly Range[] | undefined, line: number): Range[] =>
  (ranges ?? []).filter((r) => r.start <= line && line <= r.end);

/** 関数 → 画面部品: readsUiIds（id 属性・name）を UiElement に対応づける。欄が無ければイベントの登録だけ */
function addUiUses(b: GraphBuilder, ir: IR): void {
  const byKey = new Map<string, string[]>();
  for (const u of ir.uiElements) {
    for (const k of new Set([u.domId, u.name].filter((x): x is string => !!x))) byKey.set(k, [...(byKey.get(k) ?? []), u.id]);
  }
  for (const f of ir.functions) {
    for (const key of (f as WithReads).readsUiIds ?? []) for (const uid of byKey.get(key) ?? []) b.addEdge(`code:${f.id}`, `code:${uid}`, 'uses');
  }
  for (const h of ir.eventHandlers) {
    if (h.uiElementId) b.addEdge(`code:${h.handler}`, `code:${h.uiElementId}`, 'uses');
  }
}

/** calls=関数の呼び出し先、uses=関数 → 画面部品・データ項目・外部連携。データは access（C/R/U/D）を優先し、無ければソース位置から推定 */
function addRelations(b: GraphBuilder, ir: IR, byFile: Map<string, Range[]>): void {
  for (const f of ir.functions) for (const c of f.calls) b.addEdge(`code:${f.id}`, `code:${c}`, 'calls');
  addUiUses(b, ir);
  for (const i of [...ir.dataItems, ...ir.integrations]) {
    for (const a of (i as WithAccess).access ?? []) if (a.functionId) b.addEdge(`code:${a.functionId}`, `code:${i.id}`, 'uses', a.op ?? '');
  }
  const isFunction = (r: Range): boolean => b.nodes.get(r.id)?.codeKind === 'function';
  for (const d of ir.dataItems.filter((x) => ((x as WithAccess).access ?? []).length === 0)) {
    for (const s of d.source) {
      const owners = containing(byFile.get(relPath(s.file)), s.line).filter(isFunction);
      const inner = owners.reduce<Range | undefined>((best, r) => (!best || r.end - r.start < best.end - best.start ? r : best), undefined);
      if (inner) b.addEdge(inner.id, `code:${d.id}`, 'uses');
    }
  }
}

function blockRows(block: Block): Row[] {
  if (block.type === 'paragraph') return [{ text: block.text, key: block.text, prov: block, groupIds: block.irIds ?? [] }];
  if (block.type === 'list') {
    const walk = (items: readonly ListItem[]): Row[] =>
      items.flatMap((i) => [{ text: i.text, key: i.text, prov: i, groupIds: i.irIds ?? [] }, ...walk(i.children ?? [])]);
    return walk(block.items);
  }
  if (block.type === 'table') {
    const masked = maskLineCounts(block) as TableBlock;
    const deriveCol = block.columns.findIndex((c) => c.startsWith('導出元'));
    return block.rows.map((r, i) => {
      const irIds = r.irIds ?? [];
      const cell = deriveCol >= 0 ? (r.cells[deriveCol] ?? '') : '';
      const derived = irIds.filter((id) => cell.includes(id));
      return { text: r.cells.join(' / '), key: (masked.rows[i]?.cells ?? r.cells).join(' / '), prov: r, groupIds: derived.length > 0 ? derived : irIds };
    });
  }
  return []; // 図は行を持たない
}

function toLink(docId: DocId, section: string, sectionKey: string, sectionNodeId: string, row: Row, used: Map<string, number>): TraceLink {
  const base = `${docId}\n${sectionKey}\n${summarize(stripPositions(row.key))}`;
  const n = (used.get(base) ?? 0) + 1;
  used.set(base, n);
  return {
    id: sha1(n === 1 ? base : `${base}\n${n}`),
    docId,
    section,
    sectionNodeId,
    summary: summarize(row.text),
    evidence: row.prov.evidence,
    ...(row.prov.origin ? { origin: row.prov.origin } : {}),
    ...(row.prov.d09Ref ? { d09Ref: row.prov.d09Ref } : {}),
    sources: row.prov.source.map((s) => ({ file: relPath(s.file), line: s.line })),
    irIds: [...(row.prov.irIds ?? [])],
  };
}

function linkDocuments(b: GraphBuilder, sectionId: string, link: TraceLink, byFile: Map<string, Range[]>): void {
  for (const irId of link.irIds) b.addEdge(sectionId, `code:${irId}`, 'documents');
  for (const src of link.sources) {
    if (src.line === undefined) continue;
    for (const r of containing(byFile.get(src.file), src.line)) b.addEdge(sectionId, r.id, 'documents');
  }
}

/** 文書と節の点、節の行の link を足す。改版履歴の節は実行ごとに変わるので含めない */
function addDoc(b: GraphBuilder, doc: Document, used: Map<string, number>): Candidate[] {
  const docNode = `doc:${doc.id}`;
  b.addNode({ id: docNode, kind: 'doc', label: `${doc.id} ${doc.title}`, docId: doc.id });
  const stack: { level: number; heading: string }[] = [];
  const seen = new Map<string, number>();
  const links: Candidate[] = [];
  for (const s of doc.sections) {
    if (s.heading === REVISION_HEADING) continue;
    while ((stack.at(-1)?.level ?? 0) >= s.level) stack.pop();
    stack.push({ level: s.level, heading: oneLine(s.heading) });
    const chain = stack.map((x) => x.heading).join(' / ');
    const base = stripPositions(chain);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = n === 1 ? base : `${base}（${n}）`;
    const sectionId = `section:${doc.id}/${key}`;
    b.addNode({ id: sectionId, kind: 'section', label: s.heading, parent: docNode, docId: doc.id });
    b.addEdge(docNode, sectionId, 'contains');
    for (const row of s.blocks.flatMap(blockRows)) {
      links.push({ link: toLink(doc.id, chain, key, sectionId, row, used), groupIds: row.groupIds });
    }
  }
  return links;
}

/** D08 の横断表（記述→ソース位置の再掲）の節 */
const CROSS_TABLE = /記述→ソース位置|文書横断の対応表/;
/** 他文書の行の再掲を持つ文書（D09 の再掲を判定するとき、参照元に数えない） */
const REPEAT_DOCS: ReadonlySet<DocId> = new Set<DocId>(['D08', 'D09']);

const hasBasis = (l: TraceLink): boolean => l.sources.length > 0 || l.irIds.length > 0 || l.d09Ref !== undefined;

/**
 * 管理の単位にする行を選ぶ。根拠（ソース位置・IR 要素・D09 番号）の無い注記・凡例・集計の行、
 * D08 の横断表の行、他文書の行が同じ D09 番号で指している D09 の行（再掲）は除く
 */
export function selectLinks(links: readonly TraceLink[]): TraceLink[] {
  const based = links.filter((l) => hasBasis(l) && !(l.docId === 'D08' && CROSS_TABLE.test(l.section)));
  const referred = new Set(based.filter((l) => !REPEAT_DOCS.has(l.docId)).flatMap((l) => (l.d09Ref ? [l.d09Ref] : [])));
  return based.filter((l) => !(l.docId === 'D09' && l.d09Ref !== undefined && referred.has(l.d09Ref)));
}

const uniqueBy = <T>(xs: readonly T[], key: (x: T) => string): T[] => [...new Map(xs.map((x) => [key(x), x] as const)).values()];

function mergeGroup(id: string, members: readonly Candidate[]): BundledLink {
  const rep = members[0]?.link;
  if (!rep) throw new Error('空の束');
  const links = members.map((m) => m.link);
  const alsoIn = [...new Set(links.map((l) => l.section))].filter((s) => s !== rep.section);
  const d09Ref = rep.d09Ref ?? links.find((l) => l.d09Ref)?.d09Ref;
  return {
    ...rep,
    id,
    ...(d09Ref ? { d09Ref } : {}),
    sources: uniqueBy(links.flatMap((l) => l.sources), (s) => `${s.file}:${s.line ?? ''}`),
    irIds: [...new Set(links.flatMap((l) => l.irIds))],
    ...(alsoIn.length > 0 ? { alsoIn } : {}),
  };
}

/**
 * 同じ文書の中で束ねる鍵（irIds、D13 は導出元の ID）の集合が同じ行を 1 件にする。代表は最初の行。
 * id は束ねた鍵（位置を伏せた ID の並べ替え）から作るので、束の中の行が増減しても変わらない。鍵の無い行はそのまま
 */
export function bundleLinks(cands: readonly Candidate[]): BundledLink[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of cands) {
    const ids = [...new Set(c.groupIds)].sort();
    const key = ids.length === 0 ? `link\n${c.link.id}` : `bundle\n${c.link.docId}\n${ids.join('\n')}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const used = new Map<string, number>();
  return [...groups.entries()].map(([key, members]) => {
    if (key.startsWith('link\n')) return members[0]?.link as TraceLink;
    const base = stripPositions(key);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return mergeGroup(sha1(n === 1 ? base : `${base}\n${n}`), members);
  });
}

export interface TraceBuild {
  graph: TraceGraph;
  /** selectLinks で除いた行の数 */
  skippedLinks: number;
}

export function buildTraceGraph(ir: IR, docs: readonly Document[], meta: TraceMeta): TraceGraph {
  return buildTrace(ir, docs, meta).graph;
}

export function buildTrace(ir: IR, docs: readonly Document[], meta: TraceMeta): TraceBuild {
  const b = new GraphBuilder(rootLabel(meta.source));
  for (const f of ir.files) b.ensureFile(f.path, f.status);
  const byFile = addCode(b, ir);
  addRelations(b, ir, byFile);
  const used = new Map<string, number>();
  const all = docs.flatMap((doc) => addDoc(b, doc, used));
  const kept = new Set(selectLinks(all.map((c) => c.link)).map((l) => l.id));
  const selected = all.filter((c) => kept.has(c.link.id));
  for (const c of selected) linkDocuments(b, c.link.sectionNodeId, c.link, byFile);
  const links = bundleLinks(selected);
  const graph: TraceGraph = {
    version: TRACE_VERSION,
    runId: meta.runId,
    ...(meta.source ? { source: meta.source } : {}),
    generatedAt: meta.generatedAt,
    nodes: [...b.nodes.values()],
    edges: [...b.edges.values()],
    links,
  };
  return { graph, skippedLinks: all.length - selected.length };
}
