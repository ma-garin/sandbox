// 表示用の日時書式（出力文書のヘッダ・改版履歴だけ）。データ（ir.json・run-log.json）は ISO のまま。
// 例: 2026-09-26T05:18:02.888Z → 2026-09-26 14:18（JST）。タイムゾーンは環境変数 AIDD_TZ、無ければ Asia/Tokyo。

import type { Document, Section } from '../doc/model.ts';

export const DEFAULT_TZ = 'Asia/Tokyo';
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export function displayTimeZone(): string {
  const tz = process.env['AIDD_TZ']?.trim();
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('ja-JP', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ; // 不正な値は既定に戻す（出力を止めない）
  }
}

/** ISO 日時を「YYYY-MM-DD HH:mm（略称）」にする。ISO でなければそのまま返す */
export function formatDisplayDate(value: string, timeZone = displayTimeZone()): string {
  if (!ISO_DATETIME_RE.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone, timeZoneName: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const p = (t: Intl.DateTimeFormatPartTypes): string => parts.find((x) => x.type === t)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}（${p('timeZoneName')}）`;
}

function displaySection(s: Section, tz: string): Section {
  if (s.heading !== '改版履歴') return s;
  return {
    ...s,
    blocks: s.blocks.map((b) =>
      b.type === 'table' ? { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => formatDisplayDate(c, tz)) })) } : b,
    ),
  };
}

/** 表示用の文書（新しいオブジェクト）。改版履歴の生成日時と「改版履歴」節の表の日時だけを表示形式にする */
export function toDisplayDoc(doc: Document, tz = displayTimeZone()): Document {
  return {
    ...doc,
    revision: doc.revision.map((r) => ({ ...r, generatedAt: formatDisplayDate(r.generatedAt, tz) })),
    sections: doc.sections.map((s) => displaySection(s, tz)),
  };
}
