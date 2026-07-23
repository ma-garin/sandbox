import { describe, it, expect, beforeEach } from 'vitest';
import { BodyRecordDB, allRecords, saveRecord, deleteByDate, bulkImport, replaceAll, clearAll, getByDate } from '../src/lib/db';
import type { BodyRecord } from '../src/types';

let testDb: BodyRecordDB;

beforeEach(async () => {
  testDb = new BodyRecordDB(`test-${Math.floor(performance.now() * 1000)}`);
  await testDb.open();
});

describe('saveRecord (FR-002/003/005)', () => {
  it('保存時に BMI を計算し、同一日は上書き', async () => {
    const r1 = await saveRecord({ measuredAt: '2026-07-21', weightKg: 65 }, 170, testDb);
    expect(r1.bmi).toBe(22.5);
    expect((await allRecords(testDb)).length).toBe(1);

    // 同じ日を上書き（createdAt は保持、weight 更新）
    const r2 = await saveRecord({ measuredAt: '2026-07-21', weightKg: 64 }, 170, testDb);
    expect(r2.createdAt).toBe(r1.createdAt);
    expect((await allRecords(testDb)).length).toBe(1);
    expect((await getByDate('2026-07-21', testDb))?.weightKg).toBe(64);
  });

  it('身長未設定なら BMI=0', async () => {
    const r = await saveRecord({ measuredAt: '2026-07-21', weightKg: 65 }, null, testDb);
    expect(r.bmi).toBe(0);
  });
});

describe('deleteByDate (FR-013)', () => {
  it('指定日を削除', async () => {
    await saveRecord({ measuredAt: '2026-07-20', weightKg: 66 }, 170, testDb);
    await saveRecord({ measuredAt: '2026-07-21', weightKg: 65 }, 170, testDb);
    await deleteByDate('2026-07-20', testDb);
    const all = await allRecords(testDb);
    expect(all.map((r) => r.measuredAt)).toEqual(['2026-07-21']);
  });
});

describe('bulkImport (FR-014)', () => {
  it('複数件を一括保存し BMI 付与', async () => {
    const n = await bulkImport(
      [
        { measuredAt: '2026-07-18', weightKg: 66 },
        { measuredAt: '2026-07-19', weightKg: 65.5 },
      ],
      170,
      testDb,
    );
    expect(n).toBe(2);
    const all = await allRecords(testDb);
    expect(all.length).toBe(2);
    expect(all[0].bmi).toBeGreaterThan(0);
  });

  it('既存日付を上書きしても既存スタンプ・createdAt を保持', async () => {
    const orig = await saveRecord({ measuredAt: '2026-07-18', weightKg: 66, stamps: ['exercise'] }, 170, testDb);
    await bulkImport([{ measuredAt: '2026-07-18', weightKg: 64 }], 170, testDb);
    const r = await getByDate('2026-07-18', testDb);
    expect(r?.weightKg).toBe(64);
    expect(r?.stamps).toEqual(['exercise']);
    expect(r?.createdAt).toBe(orig.createdAt);
  });
});

describe('replaceAll / clearAll (AC-05 復元)', () => {
  it('全置換で以前のデータは消える', async () => {
    await saveRecord({ measuredAt: '2026-01-01', weightKg: 70 }, 170, testDb);
    const incoming: BodyRecord[] = [
      { id: '2026-07-21', measuredAt: '2026-07-21', weightKg: 64, bmi: 22, stamps: [], createdAt: 'a', updatedAt: 'b' },
    ];
    await replaceAll(incoming, testDb);
    const all = await allRecords(testDb);
    expect(all.map((r) => r.measuredAt)).toEqual(['2026-07-21']);
  });

  it('clearAll で空になる', async () => {
    await saveRecord({ measuredAt: '2026-07-21', weightKg: 64 }, 170, testDb);
    await clearAll(testDb);
    expect((await allRecords(testDb)).length).toBe(0);
  });
});
