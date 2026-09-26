// 取得層: github・folder・files・zip → 読み取り専用の作業ディレクトリ ＋ 除外一覧
// REQ-F-001〜005・040・041、REQ-N-016〜018。
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadExcluder } from './exclude.ts';
import { fetchGithub } from './github.ts';
import { makeReadOnly, resolveFiles, resolveFolder, trackTempDir, walkFolder } from './local.ts';

export type IngestInput =
  | { kind: 'github'; url: string; ref?: string; token?: string }
  | { kind: 'folder'; path: string }
  | { kind: 'files'; paths: string[] }
  | { kind: 'zip'; path: string };

export interface IngestOptions {
  /** 利用者指定の除外パターン（glob。`legacy/**` 等）。既定の除外と .gitignore は ingest が足す */
  exclude?: string[];
}

export interface IngestedFile {
  /** root からの相対パス（区切りは `/`） */
  path: string;
  /** 絶対パス */
  abs: string;
}

export interface ExcludedFile {
  path: string;
  /** 例: `node_modules`・`.gitignore: dist/`・`利用者指定: legacy/**` */
  reason: string;
}

export interface IngestResult {
  root: string;
  files: IngestedFile[];
  excluded: ExcludedFile[];
  /** github のとき取得したコミットの 40 桁ハッシュ */
  commit?: string;
  /** 一時領域を消す。folder・files では何もしない */
  cleanup(): Promise<void>;
}

/** 入力の誤り（CLI は終了コード 2 に対応づける） */
export class InputError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = 'InputError';
    this.hint = hint;
  }
}

/** zip.ts の公開関数（別担当。存在しない段階でも型検査を通すため動的に読む） */
type ExtractZip = (zipPath: string, destDir: string) => Promise<{ rejected: { path: string; reason: string }[] }>;
const ZIP_MODULE = './zip.ts';

const noop = async (): Promise<void> => {};

async function scan(root: string, opts: IngestOptions): Promise<{ files: IngestedFile[]; excluded: ExcludedFile[] }> {
  const excluder = await loadExcluder(root, opts.exclude ?? []);
  const walked = await walkFolder(root, excluder);
  return { files: walked.files, excluded: [...excluder.notices, ...walked.excluded] };
}

async function ingestZip(zipPath: string, opts: IngestOptions): Promise<IngestResult> {
  const work = await mkdtemp(join(tmpdir(), 'spec2doc-zip-'));
  const untrack = trackTempDir(work);
  const root = join(work, 'root');
  const cleanup = async (): Promise<void> => {
    untrack();
    await rm(work, { recursive: true, force: true });
  };
  try {
    await mkdir(root);
    const mod = (await import(ZIP_MODULE)) as { extractZip: ExtractZip };
    const { rejected } = await mod.extractZip(resolve(zipPath), root);
    await makeReadOnly(root);
    const scanned = await scan(root, opts);
    const unsafe = rejected.map((r) => ({ path: r.path, reason: `zip 内の危険なパスのため拒否: ${r.reason}` }));
    return { root, files: scanned.files, excluded: [...unsafe, ...scanned.excluded], cleanup };
  } catch (err) {
    await cleanup();
    throw withActionableHint(err);
  }
}

/**
 * zip の上限は設定で変えられないため、「設定で引き上げ」を案内するヒントを取れる行動に置き換える。
 * 本来は zip.ts の文言を直すべき（別担当）。直った後は何もしない。
 */
function withActionableHint(err: unknown): unknown {
  if (!(err instanceof InputError) || !err.hint.includes('設定')) return err;
  const fixed = new InputError(
    err.message,
    '不要なフォルダ（依存ライブラリ・生成物・画像など）を外して .zip を作り直すか、フォルダを直接指定して再実行してください。',
  );
  fixed.stack = err.stack;
  return fixed;
}

export async function ingest(input: IngestInput, opts: IngestOptions = {}): Promise<IngestResult> {
  switch (input.kind) {
    case 'folder': {
      const root = await resolveFolder(input.path);
      return { root, ...(await scan(root, opts)), cleanup: noop };
    }
    case 'files': {
      const { root, files } = await resolveFiles(input.paths);
      return { root, files, excluded: [], cleanup: noop };
    }
    case 'github': {
      const got = await fetchGithub(input);
      try {
        await makeReadOnly(got.root);
        return { root: got.root, ...(await scan(got.root, opts)), commit: got.commit, cleanup: got.cleanup };
      } catch (err) {
        await got.cleanup();
        throw err;
      }
    }
    case 'zip':
      return ingestZip(input.path, opts);
  }
}
