// JSON バックアップ / 復元（純粋ロジック → Vitest 対象）
import type { BodyRecord, UserSettings } from '../types';

export const BACKUP_SCHEMA_VERSION = 1;
export const APP_ID = 'body-record';

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  settings: UserSettings;
  records: BodyRecord[];
}

export function buildBackup(records: BodyRecord[], settings: UserSettings, exportedAt: string): BackupFile {
  return { app: APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, settings, records };
}

export function serializeBackup(records: BodyRecord[], settings: UserSettings, exportedAt: string): string {
  return JSON.stringify(buildBackup(records, settings, exportedAt), null, 2);
}

export class BackupError extends Error {}

/**
 * バックアップ JSON を検証して復元用データを返す（AC-05）。
 * 不正な場合は BackupError を投げ、呼び出し側は既存データを変更しない。
 */
export function parseBackup(text: string): { records: BodyRecord[]; settings?: UserSettings } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('JSON として読み込めませんでした');
  }
  if (typeof data !== 'object' || data === null) throw new BackupError('バックアップ形式ではありません');
  const obj = data as Record<string, unknown>;
  if (obj.app !== undefined && obj.app !== APP_ID) {
    throw new BackupError('別アプリのバックアップの可能性があります');
  }
  if (!Array.isArray(obj.records)) throw new BackupError('records 配列がありません');

  const records: BodyRecord[] = [];
  for (const raw of obj.records as unknown[]) {
    const rec = validateRecord(raw);
    if (rec) records.push(rec);
  }
  if (!records.length) throw new BackupError('有効な記録が 1 件もありません');

  const settings = obj.settings && typeof obj.settings === 'object' ? (obj.settings as UserSettings) : undefined;
  return { records, settings };
}

function validateRecord(raw: unknown): BodyRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const measuredAt = typeof r.measuredAt === 'string' ? r.measuredAt.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) return null;
  const weightKg = typeof r.weightKg === 'number' ? r.weightKg : Number(r.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const now = new Date(0).toISOString();
  return {
    id: typeof r.id === 'string' && r.id ? r.id : measuredAt,
    measuredAt,
    weightKg,
    bodyFatPercent: optNum(r.bodyFatPercent),
    muscleMassKg: optNum(r.muscleMassKg),
    waistCm: optNum(r.waistCm),
    bmi: typeof r.bmi === 'number' ? r.bmi : 0,
    stamps: Array.isArray(r.stamps) ? (r.stamps.filter((s) => typeof s === 'string') as BodyRecord['stamps']) : [],
    memo: typeof r.memo === 'string' ? r.memo : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}
