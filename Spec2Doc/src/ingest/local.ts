// ローカル入力: フォルダの再帰走査・ファイル指定の確認・作業領域の読み取り専用化（REQ-F-002・003）
import { rmSync } from 'node:fs';
import { chmod, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { InputError } from './index.ts';
import type { ExcludedFile, IngestedFile } from './index.ts';
import type { Excluder } from './exclude.ts';

export interface WalkResult {
  files: IngestedFile[];
  excluded: ExcludedFile[];
}

/** 再帰走査。シンボリックリンクは辿らず除外に積む。除外したディレクトリには降りない */
export async function walkFolder(root: string, excluder: Excluder): Promise<WalkResult> {
  const files: IngestedFile[] = [];
  const excluded: ExcludedFile[] = [];
  const visit = async (dir: string, prefix: string): Promise<void> => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) {
        excluded.push({ path: rel, reason: 'シンボリックリンク（辿らない）' });
      } else if (e.isDirectory()) {
        const reason = excluder.check(rel, true);
        if (reason) excluded.push({ path: `${rel}/`, reason });
        else await visit(abs, rel);
      } else if (e.isFile()) {
        const reason = excluder.check(rel, false);
        if (reason) excluded.push({ path: rel, reason });
        else files.push({ path: rel, abs });
      }
    }
  };
  await visit(root, '');
  return { files, excluded };
}

export async function resolveFolder(path: string): Promise<string> {
  const root = resolve(path);
  const st = await stat(root).catch(() => null);
  if (!st || !st.isDirectory()) {
    throw new InputError(`フォルダが見つかりません: ${path}`, 'フォルダのパスを確かめてください');
  }
  return root;
}

function commonDir(paths: readonly string[]): string {
  const split = paths.map((p) => dirname(p).split(sep));
  const first = split[0] ?? [];
  let n = first.length;
  for (const s of split) {
    let i = 0;
    while (i < n && s[i] === first[i]) i += 1;
    n = i;
  }
  return first.slice(0, n).join(sep) || sep;
}

/** 指定ファイルの存在を確かめ、共通の親を root にする */
export async function resolveFiles(paths: readonly string[]): Promise<{ root: string; files: IngestedFile[] }> {
  if (paths.length === 0) throw new InputError('ファイルが指定されていません', '解析するファイルを 1 つ以上指定してください');
  const abs = paths.map((p) => resolve(p));
  for (const [i, a] of abs.entries()) {
    const st = await stat(a).catch(() => null);
    if (!st || !st.isFile()) {
      throw new InputError(`ファイルが見つかりません: ${paths[i] ?? a}`, 'ファイルのパスを確かめてください');
    }
  }
  const root = commonDir(abs);
  const uniq = [...new Set(abs)];
  return { root, files: uniq.map((a) => ({ path: relative(root, a).split(sep).join('/'), abs: a })) };
}

/** 作業領域のファイルを 0444 にする（シンボリックリンクは触らない） */
export async function makeReadOnly(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (e.isFile()) await chmod(join(e.parentPath, e.name), 0o444);
  }
}

// 強制終了（SIGINT・SIGTERM）でも一時領域を残さない（REQ-F-040）
const liveTemps = new Set<string>();
const SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function onSignal(signal: NodeJS.Signals): void {
  for (const dir of liveTemps) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 片付けの失敗で終了を妨げない
    }
  }
  liveTemps.clear();
  for (const s of SIGNALS) process.removeListener(s, onSignal);
  // 既定の動作（終了）に戻して同じシグナルを送り直す
  process.kill(process.pid, signal);
}

/** 一時領域を登録する。戻り値を呼ぶと登録を外す（cleanup で呼ぶ） */
export function trackTempDir(dir: string): () => void {
  if (liveTemps.size === 0) for (const s of SIGNALS) process.on(s, onSignal);
  liveTemps.add(dir);
  return () => {
    liveTemps.delete(dir);
    if (liveTemps.size === 0) for (const s of SIGNALS) process.removeListener(s, onSignal);
  };
}
