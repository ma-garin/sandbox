// IndexedDB 永続化（Dexie）。measuredAt を主キーにして「1 日 1 件」を DB で保証する。
import Dexie, { type Table } from 'dexie';
import type { BodyRecord } from '../types';
import type { RecordDraft } from './csv';
import { calcBmi, sortByDate } from './calc';

export class BodyRecordDB extends Dexie {
  records!: Table<BodyRecord, string>;

  constructor(name = 'body-record') {
    super(name);
    // measuredAt = 主キー（inbound）。updatedAt に副次インデックス。
    this.version(1).stores({ records: 'measuredAt, updatedAt' });
  }
}

export const db = new BodyRecordDB();

const nowIso = () => new Date().toISOString();

export async function allRecords(database: BodyRecordDB = db): Promise<BodyRecord[]> {
  const list = await database.records.toArray();
  return sortByDate(list);
}

export async function getByDate(date: string, database: BodyRecordDB = db): Promise<BodyRecord | undefined> {
  return database.records.get(date);
}

/** 記録を保存（新規/上書き）。BMI は身長から再計算。FR-002/003/005 */
export async function saveRecord(
  draft: RecordDraft & { stamps?: BodyRecord['stamps'] },
  heightCm: number | null,
  database: BodyRecordDB = db,
): Promise<BodyRecord> {
  const existing = await database.records.get(draft.measuredAt);
  const rec: BodyRecord = {
    id: existing?.id ?? draft.measuredAt,
    measuredAt: draft.measuredAt,
    weightKg: draft.weightKg,
    bodyFatPercent: draft.bodyFatPercent,
    muscleMassKg: draft.muscleMassKg,
    waistCm: draft.waistCm,
    bmi: calcBmi(draft.weightKg, heightCm),
    stamps: draft.stamps ?? existing?.stamps ?? [],
    memo: draft.memo,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await database.records.put(rec);
  return rec;
}

export async function deleteByDate(date: string, database: BodyRecordDB = db): Promise<void> {
  await database.records.delete(date);
}

/** CSV 取込などの一括保存。同一日は上書き（呼び出し側で重複解決済み） */
export async function bulkImport(
  drafts: RecordDraft[],
  heightCm: number | null,
  database: BodyRecordDB = db,
): Promise<number> {
  const existing = new Map((await database.records.toArray()).map((r) => [r.measuredAt, r]));
  const recs: BodyRecord[] = drafts.map((d) => {
    const prev = existing.get(d.measuredAt);
    return {
      id: prev?.id ?? d.measuredAt,
      measuredAt: d.measuredAt,
      weightKg: d.weightKg,
      bodyFatPercent: d.bodyFatPercent,
      muscleMassKg: d.muscleMassKg,
      waistCm: d.waistCm,
      bmi: calcBmi(d.weightKg, heightCm),
      stamps: prev?.stamps ?? [],
      memo: d.memo,
      createdAt: prev?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
  });
  await database.records.bulkPut(recs);
  return recs.length;
}

/** JSON 復元: 全置換（AC-05） */
export async function replaceAll(records: BodyRecord[], database: BodyRecordDB = db): Promise<void> {
  await database.transaction('rw', database.records, async () => {
    await database.records.clear();
    await database.records.bulkPut(records);
  });
}

export async function clearAll(database: BodyRecordDB = db): Promise<void> {
  await database.records.clear();
}
