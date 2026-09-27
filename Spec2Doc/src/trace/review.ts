// 確認状態（TraceReview）の引き継ぎと検証。core が実行ごとに前回から引き継ぎ、Web のサーバが保存前に検証する。

import { InputError } from '../ingest/index.ts';
import { stripPositions } from '../generate/index.ts';
import {
  REVIEW_STATUS_LABEL,
  TRACE_VERSION,
  type ReviewEntry,
  type ReviewStatus,
  type SavedView,
  type TraceGraph,
  type TraceLink,
  type TraceReview,
} from './schema.ts';

export const NOTE_MAX = 2000;
const TEXT_MAX = 100;
export const REVIEWER_MAX = 100;
export const COMMENT_MAX = 2000;
/** 1 行あたりのコメントの件数の上限 */
export const COMMENTS_MAX = 200;
export const SAVED_VIEWS_MAX = 20;
const FILTERS_MAX = 50;
const FILTER_VALUE_MAX = 500;
/** 実行 ID の形式（Web のサーバの RUN_ID_RE と同じ） */
export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const VIEW_TABS: readonly SavedView['tab'][] = ['graph', 'matrix', 'manage', 'gaps', 'compare'];

export function emptyReview(runId: string): TraceReview {
  return { version: TRACE_VERSION, runId, reviews: {} };
}

/** 行の内容の比較キー。ソース位置・行番号は伏せる（位置だけずれた行は同じ内容として引き継ぐ） */
export function linkContent(l: TraceLink): string {
  return JSON.stringify([
    stripPositions(l.summary),
    l.evidence,
    l.origin ?? '',
    l.d09Ref ?? '',
    l.irIds.map(stripPositions).sort(),
    [...new Set(l.sources.map((s) => s.file))].sort(),
  ]);
}

export interface CarryOptions {
  /** 内容が変わった行も引き継ぐ（要確認の印と合わせて使う。core の実行はこれ） */
  keepChanged?: boolean;
}

function carriedEntry(entry: ReviewEntry, from: string): ReviewEntry {
  return {
    status: entry.status,
    ...(entry.note !== undefined ? { note: entry.note } : {}),
    updatedAt: entry.updatedAt,
    carriedFrom: from,
    ...(entry.reviewer !== undefined ? { reviewer: entry.reviewer } : {}),
    ...(entry.reviewedAt !== undefined ? { reviewedAt: entry.reviewedAt } : {}),
    ...(entry.comments !== undefined ? { comments: entry.comments.map((c) => ({ ...c })) } : {}),
  };
}

/**
 * linkId が前回と同じ行の確認状態（status・note・確認者・コメント）を引き継ぐ。消えた行は捨てる。
 * 内容が変わった行は既定で捨て、keepChanged のときは残す（要確認として画面に出す）。保存した絞り込みとベースラインも引き継ぐ
 */
export function carryOverReview(prevGraph: TraceGraph, prevReview: TraceReview, nextGraph: TraceGraph, options: CarryOptions = {}): TraceReview {
  const before = new Map(prevGraph.links.map((l) => [l.id, linkContent(l)]));
  const reviews = Object.fromEntries(
    nextGraph.links.flatMap((l): [string, ReviewEntry][] => {
      const entry = Object.hasOwn(prevReview.reviews, l.id) ? prevReview.reviews[l.id] : undefined;
      if (!entry || !before.has(l.id)) return [];
      if (!options.keepChanged && before.get(l.id) !== linkContent(l)) return [];
      return [[l.id, carriedEntry(entry, prevGraph.runId)]];
    }),
  );
  return {
    version: TRACE_VERSION,
    runId: nextGraph.runId,
    reviews,
    ...(prevReview.savedViews !== undefined ? { savedViews: prevReview.savedViews.map((v) => ({ ...v, filters: { ...v.filters } })) } : {}),
    ...(prevReview.baselineRunId !== undefined ? { baselineRunId: prevReview.baselineRunId } : {}),
  };
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

function requiredText(v: unknown, what: string, max: number): string {
  const s = optionalText(v, what, max);
  if (s === undefined || s.trim() === '') return fail(`${what}がありません`);
  return s;
}

function validateComments(v: unknown): ReviewEntry['comments'] {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return fail('コメントの形式が不正です');
  if (v.length > COMMENTS_MAX) return fail(`コメントが多すぎます（1 行に ${COMMENTS_MAX} 件まで）`);
  return v.map((c: unknown) => {
    if (!isRecord(c)) return fail('コメントの形式が不正です');
    const at = requiredText(c.at, 'コメントの日時', TEXT_MAX);
    const by = optionalText(c.by, 'コメントの記入者', REVIEWER_MAX);
    const text = requiredText(c.text, 'コメント', COMMENT_MAX);
    return { at, ...(by !== undefined ? { by } : {}), text };
  });
}

function validateEntry(id: string, v: unknown, ids: ReadonlySet<string>): ReviewEntry {
  if (!ids.has(id)) fail(`この実行に無い行の確認状態です: ${id.slice(0, 32)}`);
  if (!isRecord(v)) fail('確認状態の形式が不正です');
  const status = v.status;
  if (typeof status !== 'string' || !Object.hasOwn(REVIEW_STATUS_LABEL, status)) fail(`確認状態の値が不正です: ${String(status).slice(0, 32)}`);
  const note = optionalText(v.note, 'メモ', NOTE_MAX);
  const updatedAt = optionalText(v.updatedAt, '更新日時', TEXT_MAX) ?? new Date().toISOString();
  const carriedFrom = optionalText(v.carriedFrom, '引き継ぎ元の実行 ID', TEXT_MAX);
  const reviewer = optionalText(v.reviewer, '確認者', REVIEWER_MAX);
  const reviewedAt = optionalText(v.reviewedAt, '確認日時', TEXT_MAX);
  const comments = validateComments(v.comments);
  return {
    status: status as ReviewStatus,
    ...(note !== undefined ? { note } : {}),
    updatedAt,
    ...(carriedFrom !== undefined ? { carriedFrom } : {}),
    ...(reviewer !== undefined ? { reviewer } : {}),
    ...(reviewedAt !== undefined ? { reviewedAt } : {}),
    ...(comments !== undefined ? { comments } : {}),
  };
}

function validateView(v: unknown): SavedView {
  if (!isRecord(v)) return fail('保存した絞り込みの形式が不正です');
  const name = requiredText(v.name, '絞り込みの名前', TEXT_MAX);
  const tab = v.tab;
  if (typeof tab !== 'string' || !VIEW_TABS.includes(tab as SavedView['tab'])) return fail(`絞り込みの画面が不正です: ${String(tab).slice(0, 16)}`);
  if (!isRecord(v.filters)) return fail('絞り込みの条件の形式が不正です');
  const entries = Object.entries(v.filters);
  if (entries.length > FILTERS_MAX) return fail(`絞り込みの条件が多すぎます（${FILTERS_MAX} 件まで）`);
  const filters = Object.fromEntries(entries.map(([k, x]) => [requiredText(k, '絞り込みの条件名', TEXT_MAX), optionalText(x, '絞り込みの条件', FILTER_VALUE_MAX) ?? '']));
  return { name, tab: tab as SavedView['tab'], filters };
}

function validateViews(v: unknown): SavedView[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return fail('保存した絞り込みの形式が不正です');
  if (v.length > SAVED_VIEWS_MAX) return fail(`保存した絞り込みが多すぎます（${SAVED_VIEWS_MAX} 件まで）`);
  const views = v.map(validateView);
  if (new Set(views.map((x) => x.name)).size !== views.length) return fail('保存した絞り込みの名前が重複しています');
  return views;
}

function validateBaseline(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !RUN_ID_RE.test(v)) return fail('ベースラインの実行 ID の形式が不正です');
  return v;
}

/** 利用者が保存する確認状態の検証。版・実行 ID・状態の列挙・文字数・件数・未知の行を拒否する（InputError） */
export function validateReview(json: unknown, graph: TraceGraph): TraceReview {
  if (!isRecord(json)) fail('確認状態の形式が不正です');
  if (json.version !== TRACE_VERSION) fail(`確認状態の版が不正です: ${String(json.version).slice(0, 16)}`);
  if (json.runId !== graph.runId) fail('確認状態の実行 ID がこの実行と一致しません');
  const raw = json.reviews;
  if (!isRecord(raw)) fail('確認状態の一覧がありません');
  const ids = new Set(graph.links.map((l) => l.id));
  const reviews = Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, validateEntry(id, v, ids)]));
  const savedViews = validateViews(json.savedViews);
  const baselineRunId = validateBaseline(json.baselineRunId);
  return {
    version: TRACE_VERSION,
    runId: graph.runId,
    reviews,
    ...(savedViews !== undefined ? { savedViews } : {}),
    ...(baselineRunId !== undefined ? { baselineRunId } : {}),
  };
}
