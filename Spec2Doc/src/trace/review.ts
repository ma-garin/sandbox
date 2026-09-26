// 確認状態（TraceReview）の引き継ぎと検証。core が実行ごとに前回から引き継ぎ、Web のサーバが保存前に検証する。

import { InputError } from '../ingest/index.ts';
import { stripPositions } from '../generate/index.ts';
import { REVIEW_STATUS_LABEL, TRACE_VERSION, type ReviewEntry, type ReviewStatus, type TraceGraph, type TraceLink, type TraceReview } from './schema.ts';

export const NOTE_MAX = 2000;
const TEXT_MAX = 100;

export function emptyReview(runId: string): TraceReview {
  return { version: TRACE_VERSION, runId, reviews: {} };
}

/** 行の内容の比較キー。ソース位置・行番号は伏せる（位置だけずれた行は同じ内容として引き継ぐ） */
function linkContent(l: TraceLink): string {
  return JSON.stringify([
    stripPositions(l.summary),
    l.evidence,
    l.origin ?? '',
    l.d09Ref ?? '',
    l.irIds.map(stripPositions).sort(),
    [...new Set(l.sources.map((s) => s.file))].sort(),
  ]);
}

/** linkId と内容が前回と同じ行だけ status・note を引き継ぐ。消えた行・内容が変わった行は捨てる */
export function carryOverReview(prevGraph: TraceGraph, prevReview: TraceReview, nextGraph: TraceGraph): TraceReview {
  const before = new Map(prevGraph.links.map((l) => [l.id, linkContent(l)]));
  const reviews = Object.fromEntries(
    nextGraph.links.flatMap((l): [string, ReviewEntry][] => {
      const entry = Object.hasOwn(prevReview.reviews, l.id) ? prevReview.reviews[l.id] : undefined;
      if (!entry || before.get(l.id) !== linkContent(l)) return [];
      return [[l.id, { status: entry.status, ...(entry.note !== undefined ? { note: entry.note } : {}), updatedAt: entry.updatedAt, carriedFrom: prevGraph.runId }]];
    }),
  );
  return { version: TRACE_VERSION, runId: nextGraph.runId, reviews };
}

function fail(message: string): never {
  throw new InputError(message, '画面を開き直してから、もう一度保存してください');
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function optionalText(v: unknown, what: string, max: number): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return fail(`${what}が文字列ではありません`);
  if ([...v].length > max) return fail(`${what}が長すぎます（${max} 文字まで）`);
  return v;
}

function validateEntry(id: string, v: unknown, ids: ReadonlySet<string>): ReviewEntry {
  if (!ids.has(id)) fail(`この実行に無い行の確認状態です: ${id.slice(0, 32)}`);
  if (!isRecord(v)) fail('確認状態の形式が不正です');
  const status = v.status;
  if (typeof status !== 'string' || !Object.hasOwn(REVIEW_STATUS_LABEL, status)) fail(`確認状態の値が不正です: ${String(status).slice(0, 32)}`);
  const note = optionalText(v.note, 'メモ', NOTE_MAX);
  const updatedAt = optionalText(v.updatedAt, '更新日時', TEXT_MAX) ?? new Date().toISOString();
  const carriedFrom = optionalText(v.carriedFrom, '引き継ぎ元の実行 ID', TEXT_MAX);
  return { status: status as ReviewStatus, ...(note !== undefined ? { note } : {}), updatedAt, ...(carriedFrom !== undefined ? { carriedFrom } : {}) };
}

/** 利用者が保存する確認状態の検証。版・実行 ID・状態の列挙・メモの長さ・未知の行を拒否する（InputError） */
export function validateReview(json: unknown, graph: TraceGraph): TraceReview {
  if (!isRecord(json)) fail('確認状態の形式が不正です');
  if (json.version !== TRACE_VERSION) fail(`確認状態の版が不正です: ${String(json.version).slice(0, 16)}`);
  if (json.runId !== graph.runId) fail('確認状態の実行 ID がこの実行と一致しません');
  const raw = json.reviews;
  if (!isRecord(raw)) fail('確認状態の一覧がありません');
  const ids = new Set(graph.links.map((l) => l.id));
  const reviews = Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, validateEntry(id, v, ids)]));
  return { version: TRACE_VERSION, runId: graph.runId, reviews };
}
