// .zip の安全な展開（REQ-F-040/041, REQ-N-016/017/018）
import { chmod, mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';
import { InputError } from './index.ts';

/** 展開後の合計サイズの既定上限（REQ-N-017: 1GB） */
export const DEFAULT_MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
/** ファイル数の既定上限（REQ-N-018: 5 万件） */
export const DEFAULT_MAX_FILES = 50_000;

export interface ZipLimits {
  maxTotalBytes?: number;
  maxFiles?: number;
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

function traversalError(name: string): InputError {
  return new InputError(
    `.zip に展開先の外を指す項目があります（展開拒否・パス走査）: ${name}`,
    '.zip の作り方を見直し、「..」や絶対パスを含まない形で作り直してから再実行してください。',
  );
}

function brokenError(detail: string): InputError {
  return new InputError(
    `.zip を読み取れません（壊れているか .zip 形式ではありません）: ${detail}`,
    '.zip を取得し直すか、フォルダを指定して再実行してください。',
  );
}

function openZip(zipPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true, validateEntrySizes: true, decodeStrings: false }, (err, zf) => {
      if (err || !zf) reject(err ?? new Error('unknown'));
      else resolve(zf);
    });
  });
}

function openEntryStream(zf: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zf.openReadStream(entry, (err, rs) => {
      if (err || !rs) reject(err ?? new Error('unknown'));
      else resolve(rs);
    });
  });
}

/** エントリ名を検査し、展開先の絶対パスを返す（zip slip 対策） */
function resolveTarget(root: string, name: string): string {
  if (name.length === 0 || name.includes('\0')) throw new Rejected(REASON_TRAVERSAL);
  const norm = normalizeName(name);
  if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm)) throw new Rejected(REASON_TRAVERSAL);
  if (norm.split('/').includes('..')) throw new Rejected(REASON_TRAVERSAL);
  const target = path.resolve(root, norm);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Rejected(REASON_TRAVERSAL);
  return target;
}

function isSymlink(entry: Entry): boolean {
  return ((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK;
}

/** yauzl が出す名前検査のエラーをパス走査として扱う */
function mapYauzlError(err: unknown): InputError {
  if (err instanceof InputError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const m = /^(?:absolute path|invalid relative path): (.*)$/.exec(msg);
  if (m) return traversalError(m[1] ?? '');
  // fs のエラー（code を持つ）は一時領域の絶対パスを含むため、利用者には固定文だけを返す
  if (typeof (err as { code?: unknown })?.code === 'string') {
    console.error('[extractZip]', msg);
    return new InputError(
      '.zip の展開中に書き込みに失敗しました',
      '空き容量を確かめてから再実行してください。続く場合は .zip を作り直してください。',
    );
  }
  return brokenError(msg);
}

class LimitExceeded extends Error {}

class Rejected extends Error {}

export interface RejectedEntry {
  path: string;
  reason: string;
}

export interface ExtractResult {
  rejected: RejectedEntry[];
}

/** yauzl の名前検査（エラーで全体が止まる）を避けるため、名前は自前で復号する */
function decodeName(entry: Entry): string {
  const raw = entry.fileName as unknown;
  if (typeof raw === 'string') return raw;
  const buf = raw as Buffer;
  // 汎用ビット 11（UTF-8 フラグ）が立っていれば UTF-8
  if ((entry.generalPurposeBitFlag & 0x800) !== 0) return buf.toString('utf8');
  // フラグ無し: UTF-8 として厳密に復号 → Shift_JIS（日本語版 Windows の zip）→ latin1
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // UTF-8 ではない
  }
  try {
    return new TextDecoder('shift_jis', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

const REASON_TRAVERSAL = '展開拒否（パス走査）';
const REASON_CONFLICT = '展開拒否（名前の重複・衝突）';
const MSDOS_DIR = 0x10;

/** Windows 区切り（\）を / にそろえる */
function normalizeName(name: string): string {
  return name.replace(/\\/g, '/');
}

function isDirEntry(entry: Entry, norm: string): boolean {
  return norm.endsWith('/') || (entry.externalFileAttributes & MSDOS_DIR) !== 0;
}

function isConflict(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 'EEXIST' || code === 'ENOTDIR' || code === 'EISDIR';
}

function formatBytes(n: number): string {
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  if (n >= GB) return `${Math.round((n / GB) * 10) / 10}GB`;
  if (n >= MB) return `${Math.round((n / MB) * 10) / 10}MB`;
  return `${n} バイト`;
}

/** 展開を始める前に、ディレクトリを除いたファイル数を数える（REQ-N-018） */
async function countFiles(zipPath: string): Promise<number> {
  const zf = await openZip(zipPath);
  return new Promise<number>((resolve, reject) => {
    let count = 0;
    zf.on('error', (err) => {
      zf.close();
      reject(err);
    });
    zf.on('entry', (entry: Entry) => {
      if (!isDirEntry(entry, normalizeName(decodeName(entry)))) count += 1;
      zf.readEntry();
    });
    zf.on('end', () => resolve(count));
    zf.readEntry();
  });
}
const REASON_SYMLINK = '展開拒否（パス走査・シンボリックリンク）';

export async function extractZip(zipPath: string, destDir: string, limits?: ZipLimits): Promise<ExtractResult> {
  const maxTotalBytes = limits?.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const maxFiles = limits?.maxFiles ?? DEFAULT_MAX_FILES;
  const root = path.resolve(destDir);

  let zf: ZipFile;
  let total: number;
  try {
    total = await countFiles(zipPath);
    zf = total > maxFiles ? (undefined as unknown as ZipFile) : await openZip(zipPath);
  } catch (err) {
    throw mapYauzlError(err);
  }

  // REQ-N-018: 展開を始める前に件数を判定する
  if (total > maxFiles) {
    throw new InputError(
      `.zip 内のファイル数が上限 ${maxFiles} 件を超えています（${total} 件）`,
      '解析対象のフォルダを絞って .zip を作り直し、再実行してください。',
    );
  }

  await mkdir(root, { recursive: true });
  const created: string[] = [];
  const files: string[] = [];
  let totalBytes = 0;
  let fileCount = 0;
  const rejected: RejectedEntry[] = [];

  const handleEntry = async (entry: Entry): Promise<void> => {
    const name = decodeName(entry);
    const norm = normalizeName(name);
    if (isSymlink(entry)) {
      rejected.push({ path: name, reason: REASON_SYMLINK });
      return;
    }
    let target: string;
    try {
      target = resolveTarget(root, name);
    } catch (err) {
      if (!(err instanceof Rejected)) throw err;
      rejected.push({ path: name, reason: err.message });
      return;
    }
    if (target === root) {
      rejected.push({ path: name, reason: REASON_CONFLICT });
      return;
    }
    const reject = (err: unknown): void => {
      if (!isConflict(err)) throw err;
      rejected.push({ path: name, reason: REASON_CONFLICT });
    };
    if (isDirEntry(entry, norm)) {
      try {
        const made = await mkdir(target, { recursive: true });
        if (made) created.push(made);
      } catch (err) {
        reject(err);
      }
      return;
    }
    fileCount += 1;
    if (fileCount > maxFiles) throw new LimitExceeded('files');
    let fh;
    try {
      const made = await mkdir(path.dirname(target), { recursive: true });
      if (made) created.push(made);
      fh = await open(target, 'wx', 0o600);
    } catch (err) {
      reject(err);
      return;
    }
    created.push(target);
    files.push(target);
    const rs = await openEntryStream(zf, entry);
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        totalBytes += chunk.length;
        if (totalBytes > maxTotalBytes) cb(new LimitExceeded('bytes'));
        else cb(null, chunk);
      },
    });
    await pipeline(rs, counter, fh.createWriteStream());
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let done = false;
      const fail = (err: unknown): void => {
        if (done) return;
        done = true;
        zf.close();
        reject(err);
      };
      zf.on('error', fail);
      zf.on('end', () => {
        if (done) return;
        done = true;
        resolve();
      });
      zf.on('entry', (entry: Entry) => {
        handleEntry(entry).then(() => zf.readEntry(), fail);
      });
      zf.readEntry();
    });
  } catch (err) {
    for (const p of created.reverse()) await rm(p, { recursive: true, force: true });
    if (err instanceof LimitExceeded) {
      if (err.message === 'files') {
        throw new InputError(
          `.zip 内のファイル数が上限 ${maxFiles} 件を超えています`,
          '解析対象のフォルダを絞って .zip を作り直し、再実行してください。',
        );
      }
      throw new InputError(
        `展開後のサイズが上限 ${formatBytes(maxTotalBytes)} を超えました`,
        '解析対象のフォルダを絞って .zip を作り直し、再実行してください。',
      );
    }
    throw mapYauzlError(err);
  }

  for (const f of files) await chmod(f, 0o444);
  return { rejected };
}
