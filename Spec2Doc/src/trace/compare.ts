// ベースライン比較: 基準の実行と今の実行の対応（linkId）を、追加・削除・変更・変化なしに分ける。
import { linkContent } from './review.ts';
import { fileHashesOf, sourceChanged } from './suspect.ts';
import type { TraceCompare, TraceGraph } from './schema.ts';

/** changed=記述の内容（位置を伏せた要約・根拠）または根拠ソースのファイルの内容ハッシュが変わった対応 */
export function compareTrace(base: TraceGraph, cur: TraceGraph): TraceCompare {
  const before = new Map(base.links.map((l) => [l.id, l] as const));
  const curIds = new Set(cur.links.map((l) => l.id));
  const baseHashes = fileHashesOf(base);
  const curHashes = fileHashesOf(cur);
  const added: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;
  for (const l of cur.links) {
    const b = before.get(l.id);
    if (!b) added.push(l.id);
    else if (linkContent(b) !== linkContent(l) || sourceChanged(l, baseHashes, curHashes)) changed.push(l.id);
    else unchanged++;
  }
  const removed = base.links.filter((l) => !curIds.has(l.id)).map((l) => l.id);
  return { baseRunId: base.runId, runId: cur.runId, added, removed, changed, unchanged };
}
