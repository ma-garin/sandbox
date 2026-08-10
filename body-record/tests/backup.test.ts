import { describe, it, expect } from 'vitest';
import { serializeBackup, parseBackup, BackupError } from '../src/lib/backup';
import { DEFAULT_SETTINGS, type BodyRecord } from '../src/types';

const recs: BodyRecord[] = [
  { id: '2026-07-20', measuredAt: '2026-07-20', weightKg: 65, bmi: 22.5, stamps: [], createdAt: 'a', updatedAt: 'b' },
  { id: '2026-07-21', measuredAt: '2026-07-21', weightKg: 64.8, bodyFatPercent: 18, bmi: 22.4, stamps: ['alcohol'], memo: 'test', createdAt: 'a', updatedAt: 'b' },
];

describe('backup round-trip (AC-05)', () => {
  it('出力→復元で記録が一致', () => {
    const json = serializeBackup(recs, DEFAULT_SETTINGS, '2026-07-21T00:00:00Z');
    const parsed = parseBackup(json);
    expect(parsed.records.length).toBe(2);
    expect(parsed.records[1].weightKg).toBe(64.8);
    expect(parsed.records[1].memo).toBe('test');
    expect(parsed.settings?.enabledFields).toEqual(DEFAULT_SETTINGS.enabledFields);
  });

  it('不正 JSON は BackupError', () => {
    expect(() => parseBackup('{not json')).toThrow(BackupError);
  });

  it('records が無ければ BackupError', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'body-record', foo: 1 }))).toThrow(BackupError);
  });

  it('別アプリのバックアップは拒否', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', records: [] }))).toThrow(BackupError);
  });

  it('有効な記録が0件なら BackupError（既存データ保護）', () => {
    const bad = JSON.stringify({ app: 'body-record', records: [{ measuredAt: 'x', weightKg: 'nan' }] });
    expect(() => parseBackup(bad)).toThrow(BackupError);
  });

  it('壊れた行はスキップし有効行のみ復元', () => {
    const mixed = JSON.stringify({
      app: 'body-record',
      records: [{ measuredAt: '2026-07-21', weightKg: 64 }, { measuredAt: 'bad' }, { weightKg: 60 }],
    });
    const parsed = parseBackup(mixed);
    expect(parsed.records.length).toBe(1);
    expect(parsed.records[0].measuredAt).toBe('2026-07-21');
  });
});
