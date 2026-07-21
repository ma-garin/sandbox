// CSV 取込・出力（純粋ロジック → Vitest 対象）
// RecStyle 等のエクスポート CSV を柔軟に取り込む。UI/DB 非依存。
import type { BodyRecord, StampType } from '../types';
import { STAMP_DEFS } from '../types';

/** 取込で組み立てる 1 レコード分の下書き（id / bmi / 監査列は保存時に付与） */
export interface RecordDraft {
  measuredAt: string;
  weightKg: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  waistCm?: number;
  memo?: string;
}

export type RowStatus = 'valid' | 'duplicate' | 'invalid';

export interface PreviewRow {
  lineNo: number;
  status: RowStatus;
  draft?: RecordDraft;
  error?: string;
  rawDate?: string;
}

export interface ImportPreview {
  rows: PreviewRow[];
  validCount: number; // 新規に取込可能
  duplicateCount: number; // 既存日付と重複
  invalidCount: number; // 取込不可
  delimiter: string;
  hasHeader: boolean;
  columns: ColumnMap;
}

interface ColumnMap {
  date: number;
  weight: number;
  fat: number;
  muscle: number;
  waist: number;
  memo: number;
}

/** 区切り文字を推定（カンマ / タブ / セミコロン） */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r\n?|\n/)[0] ?? '';
  const counts: Record<string, number> = {
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

/** 1 行を区切り文字で分割（ダブルクォート・エスケープ対応） */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** 各種日付表記 → YYYY-MM-DD（不正なら null） */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}
const pad = (n: number) => String(n).padStart(2, '0');

function toNum(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^\d.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** ヘッダ行から列位置を自動判定 */
export function detectColumns(header: string[]): { map: ColumnMap; hasHeader: boolean } {
  const h = header.map((c) => c.trim().toLowerCase());
  const find = (aliases: string[]) => h.findIndex((x) => aliases.some((a) => x.includes(a)));
  const date = find(['日付', '年月日', '記録日', 'date']);
  const weight = find(['体重', 'weight', 'kg']);
  const hasHeader = date >= 0 && weight >= 0;
  if (hasHeader) {
    // 体脂肪率は "kg" を含む体重列と衝突しないよう体脂肪/fat/% で判定
    const fat = h.findIndex((x) => x.includes('体脂肪') || x.includes('fat') || (x.includes('%') && !x.includes('kg')));
    return {
      hasHeader: true,
      map: {
        date,
        weight,
        fat,
        muscle: find(['筋肉', 'muscle']),
        waist: find(['ウエスト', 'ウェスト', 'waist', '腹囲']),
        memo: find(['メモ', 'memo', 'note', 'コメント']),
      },
    };
  }
  // ヘッダ無し: 位置で推定（日付, 体重, 体脂肪率, 筋肉量, ウエスト, メモ）
  return { hasHeader: false, map: { date: 0, weight: 1, fat: 2, muscle: 3, waist: 4, memo: 5 } };
}

/** CSV テキスト + 既存日付集合 → プレビュー（AC-06） */
export function buildImportPreview(text: string, existingDates: Set<string>): ImportPreview {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const delimiter = detectDelimiter(clean);
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  const rows: PreviewRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  if (!lines.length) {
    return { rows, validCount, duplicateCount, invalidCount, delimiter, hasHeader: false, columns: { date: 0, weight: 1, fat: 2, muscle: 3, waist: 4, memo: 5 } };
  }

  const allCells = lines.map((l) => splitLine(l, delimiter));
  const { map, hasHeader } = detectColumns(allCells[0]);
  const dataStart = hasHeader ? 1 : 0;
  const seen = new Set<string>(); // 同一 CSV 内の重複も検出

  for (let i = dataStart; i < allCells.length; i++) {
    const cells = allCells[i];
    const lineNo = i + 1;
    const rawDate = cells[map.date];
    const date = parseDate(rawDate);
    const weight = toNum(cells[map.weight]);

    if (!date) {
      rows.push({ lineNo, status: 'invalid', error: '日付を解釈できません', rawDate });
      invalidCount++;
      continue;
    }
    if (weight == null || weight <= 0 || weight > 500) {
      rows.push({ lineNo, status: 'invalid', error: '体重が不正です', rawDate });
      invalidCount++;
      continue;
    }
    const draft: RecordDraft = {
      measuredAt: date,
      weightKg: round1(weight),
      bodyFatPercent: map.fat >= 0 ? optNum(cells[map.fat]) : undefined,
      muscleMassKg: map.muscle >= 0 ? optNum(cells[map.muscle]) : undefined,
      waistCm: map.waist >= 0 ? optNum(cells[map.waist]) : undefined,
      memo: map.memo >= 0 ? (cells[map.memo] || '').trim() || undefined : undefined,
    };
    const isDup = existingDates.has(date) || seen.has(date);
    seen.add(date);
    if (isDup) {
      rows.push({ lineNo, status: 'duplicate', draft, rawDate });
      duplicateCount++;
    } else {
      rows.push({ lineNo, status: 'valid', draft, rawDate });
      validCount++;
    }
  }
  return { rows, validCount, duplicateCount, invalidCount, delimiter, hasHeader, columns: map };
}

function optNum(raw: string | undefined): number | undefined {
  const n = toNum(raw);
  return n == null ? undefined : round1(n);
}
const round1 = (n: number) => Math.round(n * 10) / 10;

/** プレビューから実際に取り込む下書きを抽出。overwriteDuplicates=false なら重複を除外 */
export function draftsToImport(preview: ImportPreview, overwriteDuplicates: boolean): RecordDraft[] {
  return preview.rows
    .filter((r) => r.draft && (r.status === 'valid' || (r.status === 'duplicate' && overwriteDuplicates)))
    .map((r) => r.draft as RecordDraft);
}

/* ----------------------- CSV 出力（FR-015） ----------------------- */
const EXPORT_HEADER = ['日付', '体重(kg)', '体脂肪率(%)', '筋肉量(kg)', 'ウエスト(cm)', 'BMI', 'スタンプ', 'メモ'];

function stampsToLabels(stamps: StampType[]): string {
  return stamps.map((s) => STAMP_DEFS.find((d) => d.type === s)?.label ?? s).join('/');
}

function csvCell(v: string | number | undefined | null): string {
  if (v == null || v === '') return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 全記録を CSV 文字列に（BOM 付き。Excel での文字化け回避） */
export function recordsToCsv(records: BodyRecord[]): string {
  const lines = [EXPORT_HEADER.join(',')];
  for (const r of records) {
    lines.push(
      [
        r.measuredAt,
        r.weightKg,
        r.bodyFatPercent ?? '',
        r.muscleMassKg ?? '',
        r.waistCm ?? '',
        r.bmi || '',
        stampsToLabels(r.stamps),
        r.memo ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n');
}
