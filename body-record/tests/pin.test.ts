// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';

// localStorage シム（node 環境 + Node webcrypto を利用）
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { setPin, verifyPin, hasPin, clearPin, isValidPinFormat } from '../src/lib/pin';

beforeEach(() => store.clear());

describe('pin (FR-105 / NFR-007)', () => {
  it('未設定なら hasPin=false、verify は通過', async () => {
    expect(hasPin()).toBe(false);
    expect(await verifyPin('0000')).toBe(true);
  });

  it('設定後は正しい PIN のみ通過し、平文は保存されない', async () => {
    await setPin('123456');
    expect(hasPin()).toBe(true);
    expect(await verifyPin('123456')).toBe(true);
    expect(await verifyPin('000000')).toBe(false);
    // 保存値に平文 PIN を含まない（ソルト付きハッシュのみ）
    expect(store.get('body-record:pin')).not.toContain('123456');
  });

  it('clearPin で解除', async () => {
    await setPin('4321');
    clearPin();
    expect(hasPin()).toBe(false);
  });

  it('PIN 形式は 4〜6 桁の数字のみ', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('123456')).toBe(true);
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('1234567')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
  });
});
