// PIN ロック（FR-105 / NFR-007）。PIN は平文保存せず、ソルト付き SHA-256 ハッシュのみ localStorage に保存する。
const KEY = 'body-record:pin';

interface PinRecord {
  salt: string;
  hash: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

export function hasPin(): boolean {
  return !!localStorage.getItem(KEY);
}

/** 4〜6桁の数字 PIN を設定 */
export async function setPin(pin: string): Promise<void> {
  const salt = randomSalt();
  const hash = await sha256Hex(salt + pin);
  const rec: PinRecord = { salt, hash };
  localStorage.setItem(KEY, JSON.stringify(rec));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return true; // 未設定なら常に通過
  try {
    const rec = JSON.parse(raw) as PinRecord;
    const hash = await sha256Hex(rec.salt + pin);
    return hash === rec.hash;
  } catch {
    return false;
  }
}

export function clearPin(): void {
  localStorage.removeItem(KEY);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
