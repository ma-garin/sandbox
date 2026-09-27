// トレース先の候補: 抜け（どの節からも記述されないコード要素・ファイル）と孤立した文書行（根拠ソースなし）に、
// 同じファイル・呼び出し関係・名前の一致から候補を score 付きで最大 3 件挙げる（推定。確定ではない）。
import type { TraceGraph, TraceLink, TraceNode } from './schema.ts';

export interface TraceCandidate {
  nodeId: string;
  score: number;
  why: string;
}

/** gapCandidates は schema 外の追加欄（抜けの nodeId → 候補の節） */
export type GraphWithCandidates = TraceGraph & { gapCandidates?: Record<string, TraceCandidate[]> };

export const CANDIDATE_MAX = 3;
const NAME_MIN = 3;
const SCORE = { name: 0.9, irId: 0.9, calls: 0.7, fileName: 0.6, sameFile: 0.5, sameFolder: 0.4, sameSection: 0.4 } as const;

function top(cands: readonly TraceCandidate[]): TraceCandidate[] {
  const best = new Map<string, TraceCandidate>();
  for (const c of cands) {
    const p = best.get(c.nodeId);
    if (!p || c.score > p.score) best.set(c.nodeId, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.nodeId.localeCompare(b.nodeId)).slice(0, CANDIDATE_MAX);
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V): void => {
  m.set(k, [...(m.get(k) ?? []), v]);
};
const baseName = (path: string): string => (path.split('/').at(-1) ?? path).replace(/\.[^.]+$/, '');
const usableName = (s: string): boolean => [...s].length >= NAME_MIN;

interface Index {
  nodes: Map<string, TraceNode>;
  /** code → それを記述する節 */
  codeSections: Map<string, Set<string>>;
  /** file の path → その file を根拠に持つ節 */
  fileSections: Map<string, Set<string>>;
  /** code ↔ code（calls・uses の両方向） */
  neighbors: Map<string, string[]>;
  /** 節 → 見出しと行の要約をつないだ本文 */
  sectionText: Map<string, string>;
}

function addTo(m: Map<string, Set<string>>, k: string, v: string): void {
  const s = m.get(k) ?? new Set<string>();
  s.add(v);
  m.set(k, s);
}

function buildIndex(g: TraceGraph): Index {
  const nodes = new Map(g.nodes.map((n) => [n.id, n] as const));
  const codeSections = new Map<string, Set<string>>();
  const fileSections = new Map<string, Set<string>>();
  const neighbors = new Map<string, string[]>();
  for (const e of g.edges) {
    if (e.kind === 'documents') addTo(codeSections, e.to, e.from);
    if (e.kind === 'calls' || e.kind === 'uses') {
      push(neighbors, e.from, e.to);
      push(neighbors, e.to, e.from);
    }
  }
  for (const l of g.links) for (const s of l.sources) addTo(fileSections, s.file, l.sectionNodeId);
  for (const [code, secs] of codeSections) {
    const parent = nodes.get(code)?.parent;
    const path = parent ? nodes.get(parent)?.path : undefined;
    if (path !== undefined) for (const s of secs) addTo(fileSections, path, s);
  }
  const sectionText = new Map<string, string>();
  for (const n of g.nodes) if (n.kind === 'section') sectionText.set(n.id, n.label);
  for (const l of g.links) sectionText.set(l.sectionNodeId, `${sectionText.get(l.sectionNodeId) ?? ''}\n${l.summary}`);
  return { nodes, codeSections, fileSections, neighbors, sectionText };
}

const labelOf = (ix: Index, id: string): string => ix.nodes.get(id)?.label ?? id;

function nameMatches(ix: Index, name: string, score: number): TraceCandidate[] {
  if (!usableName(name)) return [];
  return [...ix.sectionText].filter(([, text]) => text.includes(name)).map(([id]) => ({ nodeId: id, score, why: `節の見出しまたは記述に名前「${name}」が現れる` }));
}

function codeGap(ix: Index, n: TraceNode): TraceCandidate[] {
  const out: TraceCandidate[] = [...nameMatches(ix, n.label, SCORE.name)];
  for (const m of ix.neighbors.get(n.id) ?? []) {
    for (const s of ix.codeSections.get(m) ?? []) out.push({ nodeId: s, score: SCORE.calls, why: `呼び出し関係にある「${labelOf(ix, m)}」を記述している節` });
  }
  const path = n.parent ? ix.nodes.get(n.parent)?.path : undefined;
  if (path !== undefined) {
    for (const s of ix.fileSections.get(path) ?? []) out.push({ nodeId: s, score: SCORE.sameFile, why: `同じファイル「${path}」の要素を記述している節` });
  }
  return top(out);
}

function fileGap(ix: Index, n: TraceNode): TraceCandidate[] {
  const path = n.path ?? '';
  const out: TraceCandidate[] = [...nameMatches(ix, baseName(path), SCORE.fileName)];
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  for (const [p, secs] of ix.fileSections) {
    const pf = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (p !== path && pf === folder) for (const s of secs) out.push({ nodeId: s, score: SCORE.sameFolder, why: `同じフォルダのファイル「${p}」を根拠にしている節` });
  }
  return top(out);
}

function orphanLink(ix: Index, l: TraceLink, siblings: readonly TraceLink[]): TraceCandidate[] {
  const out: TraceCandidate[] = [];
  for (const id of l.irIds) if (ix.nodes.has(`code:${id}`)) out.push({ nodeId: `code:${id}`, score: SCORE.irId, why: `行が参照する要素の ID「${id}」と一致する` });
  for (const n of ix.nodes.values()) {
    if (n.kind === 'code' && usableName(n.label) && l.summary.includes(n.label)) out.push({ nodeId: n.id, score: SCORE.name, why: `記述に名前「${n.label}」が現れる` });
    const bn = n.kind === 'file' ? baseName(n.path ?? '') : '';
    if (usableName(bn) && l.summary.includes(bn)) out.push({ nodeId: n.id, score: SCORE.fileName, why: `記述にファイル名「${bn}」が現れる` });
  }
  for (const s of siblings.filter((x) => x.id !== l.id).flatMap((x) => x.sources)) {
    const id = `file:${s.file}`;
    if (ix.nodes.has(id)) out.push({ nodeId: id, score: SCORE.sameSection, why: `同じ節の他の行が根拠にしているファイル「${s.file}」` });
  }
  return top(out);
}

/** 解析対象のファイル（除外・未対応は抜けに数えない） */
const isTargetFile = (n: TraceNode): boolean => n.kind === 'file' && (n.fileStatus === undefined || n.fileStatus === 'analyzed');

/** 抜けのコード要素・ファイルの候補（gapCandidates）と、孤立した行の候補（TraceLink.candidates）を付けた新しいグラフを返す */
export function addCandidates(graph: TraceGraph): GraphWithCandidates {
  const ix = buildIndex(graph);
  const gapCandidates: Record<string, TraceCandidate[]> = {};
  for (const n of graph.nodes) {
    const cands = n.kind === 'code' && !ix.codeSections.has(n.id) ? codeGap(ix, n) : isTargetFile(n) && !ix.fileSections.has(n.path ?? '') ? fileGap(ix, n) : [];
    if (cands.length > 0) gapCandidates[n.id] = cands;
  }
  const bySection = new Map<string, TraceLink[]>();
  for (const l of graph.links) push(bySection, l.sectionNodeId, l);
  const links = graph.links.map((l): TraceLink => {
    const { candidates: _old, ...rest } = l;
    if (l.sources.length > 0) return rest;
    const cands = orphanLink(ix, l, bySection.get(l.sectionNodeId) ?? []);
    return cands.length > 0 ? { ...rest, candidates: cands } : rest;
  });
  return { ...graph, links, gapCandidates };
}
