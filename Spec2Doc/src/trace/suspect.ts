// 要確認（suspect link）: 前回の実行の trace.json と比べ、記述の内容・根拠ソースが変わった対応と新しい対応に印を付ける。
import { createHash } from 'node:crypto';
import { linkContent } from './review.ts';
import type { SuspectReason, TraceGraph, TraceLink, TraceNode, TraceReview } from './schema.ts';

/** file ノードに入力ファイルの内容ハッシュを持たせる（schema 外の追加欄） */
export type HashedNode = TraceNode & { hash?: string };

export function contentHash(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/** file ノード（path が一致するもの）に hash を付けた新しいグラフを返す */
export function withFileHashes(graph: TraceGraph, hashes: ReadonlyMap<string, string>): TraceGraph {
  const nodes = graph.nodes.map((n): HashedNode => {
    const h = n.kind === 'file' && n.path !== undefined ? hashes.get(n.path) : undefined;
    return h ? { ...n, hash: h } : n;
  });
  return { ...graph, nodes };
}

/** path → hash。hash を持たない file ノードは含めない */
export function fileHashesOf(graph: TraceGraph): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of graph.nodes as HashedNode[]) if (n.kind === 'file' && n.path !== undefined && n.hash) out.set(n.path, n.hash);
  return out;
}

/** 根拠のソースのうち、前後どちらにもハッシュがあり内容が変わったファイルがあるか */
export function sourceChanged(link: TraceLink, before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): boolean {
  return link.sources.some((s) => {
    const a = before.get(s.file);
    const b = after.get(s.file);
    return a !== undefined && b !== undefined && a !== b;
  });
}

export function suspectReason(
  prev: TraceLink | undefined,
  cur: TraceLink,
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): SuspectReason | undefined {
  if (!prev) return 'new';
  if (linkContent(prev) !== linkContent(cur)) return 'content-changed';
  if (sourceChanged(cur, before, after)) return 'source-changed';
  return undefined;
}

/** 前回が無い（初回）なら何も付けない。付けるときの since は前回の実行 ID */
export function markSuspects(prev: TraceGraph | undefined, cur: TraceGraph): TraceGraph {
  if (!prev) return cur;
  const prevLinks = new Map(prev.links.map((l) => [l.id, l] as const));
  const before = fileHashesOf(prev);
  const after = fileHashesOf(cur);
  const links = cur.links.map((l): TraceLink => {
    const { suspect: _old, ...rest } = l;
    const reason = suspectReason(prevLinks.get(l.id), l, before, after);
    return reason ? { ...rest, suspect: { since: prev.runId, reason } } : rest;
  });
  return { ...cur, links };
}

/** 前回の要確認の起点（since の実行）の日時。分からなければ undefined（確認済みと扱わず持ち越す） */
export type SinceTime = (runId: string) => string | undefined;

/** 前回の実行で要確認だった対応の since（実行 ID）の一覧。起点の日時を引く対象 */
export function suspectSinceIds(prev: TraceGraph | undefined): string[] {
  return [...new Set((prev?.links ?? []).flatMap((l) => (l.suspect ? [l.suspect.since] : [])))];
}

function confirmedAfter(reviewedAt: string | undefined, since: string | undefined): boolean {
  if (reviewedAt === undefined || since === undefined) return false;
  const r = Date.parse(reviewedAt);
  const s = Date.parse(since);
  return !Number.isNaN(r) && !Number.isNaN(s) && r > s;
}

/**
 * 要確認の持ち越し。前回の実行で要確認だった対応は、その行の確認日時（reviewedAt）が since の実行の日時より新しくなるまで、
 * 元の since と reason のまま次の実行へ持ち越す（今回の比較で変化が無くても消さない。今回も変化があれば元の起点を優先する）
 */
export function carrySuspects<G extends TraceGraph>(prev: TraceGraph | undefined, cur: G, review: TraceReview, sinceTime: SinceTime): G {
  if (!prev) return cur;
  const before = new Map(prev.links.map((l) => [l.id, l.suspect] as const));
  const links = cur.links.map((l): TraceLink => {
    const old = before.get(l.id);
    if (!old) return l;
    const entry = Object.hasOwn(review.reviews, l.id) ? review.reviews[l.id] : undefined;
    return confirmedAfter(entry?.reviewedAt, sinceTime(old.since)) ? l : { ...l, suspect: { since: old.since, reason: old.reason } };
  });
  return { ...cur, links };
}
