// 監査記録: 確認状態の変更を trace-audit.jsonl に 1 行ずつ追記する（追記のみ。書き換え・削除はしない）。
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReviewEntry, SavedView, TraceAuditEvent, TraceReview } from './schema.ts';

export const AUDIT_FILE = 'trace-audit.jsonl';
/** 行に属さない変更（ベースライン・保存した絞り込み）の linkId */
export const RUN_SCOPE = '*';

export async function appendAudit(dir: string, events: readonly TraceAuditEvent[]): Promise<void> {
  if (events.length === 0) return;
  await appendFile(join(dir, AUDIT_FILE), events.map((e) => `${JSON.stringify(e)}\n`).join(''), 'utf8');
}

type Field = TraceAuditEvent['field'];

function event(at: string, runId: string, linkId: string, field: Field, from: string | undefined, to: string | undefined, by: string | undefined): TraceAuditEvent {
  return { at, runId, linkId, field, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}), ...(by !== undefined ? { by } : {}) };
}

function entryEvents(id: string, p: ReviewEntry | undefined, n: ReviewEntry | undefined, runId: string, by: string | undefined, at: string): TraceAuditEvent[] {
  const out: TraceAuditEvent[] = [];
  const who = n?.reviewer ?? by;
  const before = p?.status ?? 'unreviewed';
  const after = n?.status ?? 'unreviewed';
  if (before !== after) out.push(event(at, runId, id, 'status', before, after, who));
  if ((p?.note ?? '') !== (n?.note ?? '')) out.push(event(at, runId, id, 'note', p?.note, n?.note, who));
  if ((p?.reviewer ?? '') !== (n?.reviewer ?? '')) out.push(event(at, runId, id, 'reviewer', p?.reviewer, n?.reviewer, by));
  const known = p?.comments?.length ?? 0;
  for (const c of (n?.comments ?? []).slice(known)) out.push(event(at, runId, id, 'comment', undefined, c.text, c.by ?? by));
  return out;
}

const viewText = (v: SavedView | undefined): string | undefined => (v ? JSON.stringify(v) : undefined);

function viewEvents(prev: readonly SavedView[], next: readonly SavedView[], runId: string, by: string | undefined, at: string): TraceAuditEvent[] {
  const a = new Map(prev.map((v) => [v.name, v] as const));
  const b = new Map(next.map((v) => [v.name, v] as const));
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  return names
    .filter((name) => viewText(a.get(name)) !== viewText(b.get(name)))
    .map((name) => event(at, runId, RUN_SCOPE, 'savedView', viewText(a.get(name)), viewText(b.get(name)), by));
}

/** 保存前後の確認状態の差を監査記録にする。status・note・reviewer の変化、コメントの追加、ベースライン、保存した絞り込み */
export function diffReviewToAudit(prev: TraceReview, next: TraceReview, runId: string, by?: string, at: string = new Date().toISOString()): TraceAuditEvent[] {
  const ids = [...new Set([...Object.keys(prev.reviews), ...Object.keys(next.reviews)])].sort();
  const get = (r: TraceReview, id: string): ReviewEntry | undefined => (Object.hasOwn(r.reviews, id) ? r.reviews[id] : undefined);
  const rows = ids.flatMap((id) => entryEvents(id, get(prev, id), get(next, id), runId, by, at));
  const baseline = prev.baselineRunId !== next.baselineRunId ? [event(at, runId, RUN_SCOPE, 'baseline', prev.baselineRunId, next.baselineRunId, by)] : [];
  return [...rows, ...baseline, ...viewEvents(prev.savedViews ?? [], next.savedViews ?? [], runId, by, at)];
}
