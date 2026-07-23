import { describe, it, expect } from 'vitest';
import {
  parseDate,
  splitLine,
  detectDelimiter,
  detectColumns,
  buildImportPreview,
  draftsToImport,
  recordsToCsv,
} from '../src/lib/csv';
import type { BodyRecord } from '../src/types';

describe('parseDate', () => {
  it('各種表記を YYYY-MM-DD へ', () => {
    expect(parseDate('2026/07/21')).toBe('2026-07-21');
    expect(parseDate('2026-7-1')).toBe('2026-07-01');
    expect(parseDate('2026.07.21')).toBe('2026-07-21');
    expect(parseDate('2026年7月21日')).toBe('2026-07-21');
    expect(parseDate('20260721')).toBe('2026-07-21');
  });
  it('不正は null', () => {
    expect(parseDate('あ')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('splitLine', () => {
  it('引用符内のカンマを保持', () => {
    expect(splitLine('2026-07-21,"65.4","dinner, heavy"', ',')).toEqual(['2026-07-21', '65.4', 'dinner, heavy']);
  });
  it('二重引用符のエスケープ', () => {
    expect(splitLine('a,"he said ""hi"""', ',')).toEqual(['a', 'he said "hi"']);
  });
});

describe('detectDelimiter / detectColumns', () => {
  it('タブ区切りを検出', () => {
    expect(detectDelimiter('日付\t体重\tメモ')).toBe('\t');
  });
  it('ヘッダから列を判定（体脂肪率が体重kgと衝突しない）', () => {
    const { map, hasHeader } = detectColumns(['日付', '体重(kg)', '体脂肪率(%)', '筋肉量', 'ウエスト', 'メモ']);
    expect(hasHeader).toBe(true);
    expect(map.date).toBe(0);
    expect(map.weight).toBe(1);
    expect(map.fat).toBe(2);
    expect(map.muscle).toBe(3);
    expect(map.waist).toBe(4);
    expect(map.memo).toBe(5);
  });
  it('ヘッダ無しは位置推定', () => {
    const { hasHeader } = detectColumns(['2026-07-21', '65.4']);
    expect(hasHeader).toBe(false);
  });
});

describe('buildImportPreview (AC-06)', () => {
  const csv = `日付,体重(kg),体脂肪率(%),メモ
2026/07/18,65.4,18.2,朝
2026/07/19,65.1,,
2026/07/20,,,欠測
bad,70,,
2026/07/21,64.8,17.9,`;

  it('新規・不正を分類し件数を返す', () => {
    const p = buildImportPreview(csv, new Set());
    // 有効: 18,19,21 の3件、不正: 20(体重なし), bad(日付不正) の2件
    expect(p.validCount).toBe(3);
    expect(p.invalidCount).toBe(2);
    expect(p.duplicateCount).toBe(0);
    expect(p.hasHeader).toBe(true);
  });

  it('既存日付は重複として分類', () => {
    const p = buildImportPreview(csv, new Set(['2026-07-18']));
    expect(p.duplicateCount).toBe(1);
    expect(p.validCount).toBe(2);
  });

  it('draftsToImport: 既定は重複を除外、上書き選択で含む', () => {
    const p = buildImportPreview(csv, new Set(['2026-07-18']));
    expect(draftsToImport(p, false).length).toBe(2); // 重複除外
    expect(draftsToImport(p, true).length).toBe(3); // 重複含む
  });

  it('ヘッダ無し CSV も取り込める', () => {
    const p = buildImportPreview('2026.07.18,65.4\n2026.07.19,65.1', new Set());
    expect(p.validCount).toBe(2);
    expect(p.hasHeader).toBe(false);
  });
});

describe('recordsToCsv', () => {
  it('BOM + ヘッダ + データ行を出力', () => {
    const recs: BodyRecord[] = [
      {
        id: '2026-07-21',
        measuredAt: '2026-07-21',
        weightKg: 64.8,
        bodyFatPercent: 17.9,
        bmi: 22.4,
        stamps: ['exercise'],
        memo: 'ジム, 夜',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ];
    const csv = recordsToCsv(recs);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('日付,体重(kg)');
    expect(csv).toContain('2026-07-21,64.8,17.9');
    expect(csv).toContain('運動');
    expect(csv).toContain('"ジム, 夜"'); // カンマを含むメモは引用符で囲む
  });
});
