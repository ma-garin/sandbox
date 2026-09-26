// GitHub 入力: 浅い clone と参照の固定（REQ-F-001）。シェルを通さず execFile で git を呼ぶ
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InputError } from './index.ts';
import { trackTempDir } from './local.ts';

/** extraEnv は子プロセスの環境変数に足す分（トークンは引数でなくここで渡す） */
export type GitRunner = (args: readonly string[], cwd: string, extraEnv: Readonly<Record<string, string>>) => Promise<string>;

export const execGit: GitRunner = (args, cwd, extraEnv) =>
  new Promise((res, rej) => {
    execFile(
      'git',
      [...args],
      { cwd, env: { ...process.env, ...extraEnv, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => (err ? rej(err) : res(String(stdout))),
    );
  });

const URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;
const REF_RE = /^[A-Za-z0-9._/-]{1,255}$/;

export function parseGithubUrl(url: string): { owner: string; repo: string; cloneUrl: string } {
  const m = URL_RE.exec(url);
  const owner = m?.[1];
  const repo = m?.[2];
  if (!owner || !repo || repo === '.' || repo === '..') {
    throw new InputError(`GitHub の URL として扱えません: ${url}`, 'https://github.com/<所有者>/<リポジトリ> の形で指定してください');
  }
  return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git` };
}

export function isCommitSha(ref: string): boolean {
  return /^[0-9a-f]{40}$/i.test(ref);
}

export function validateRef(ref: string): void {
  if (!REF_RE.test(ref) || ref.startsWith('-') || ref.includes('..')) {
    throw new InputError(`参照として扱えません: ${ref}`, 'ブランチ名・タグ名・40 桁のコミットハッシュのどれかを指定してください');
  }
}

export interface GitStep {
  args: string[];
  /** 'work' は作業領域、'repo' は clone 先 */
  cwd: 'work' | 'repo';
}

/**
 * トークンを渡す環境変数。引数（ps で見える）にも URL にも入れない。
 * キーを https://github.com/ に限るので、別ホストへのリダイレクト先には送られない。
 */
export function buildGitEnv(token: string | undefined): Record<string, string> {
  if (!token) return {};
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Bearer ${token}`,
  };
}

/** clone〜checkout の git 引数を組み立てる（トークンは含めない。buildGitEnv で渡す） */
export function buildGitPlan(cloneUrl: string, ref: string | undefined, dest: string): GitStep[] {
  const sha = ref !== undefined && isCommitSha(ref);
  const branch = ref !== undefined && !sha ? ['--branch', ref] : [];
  const steps: GitStep[] = [{ cwd: 'work', args: ['clone', '--depth', '1', ...branch, '--', cloneUrl, dest] }];
  if (sha && ref) {
    steps.push({ cwd: 'repo', args: ['fetch', '--depth', '1', 'origin', ref] });
    steps.push({ cwd: 'repo', args: ['checkout', '--detach', ref] });
  }
  return steps;
}

export interface GithubFetch {
  root: string;
  commit: string;
  cleanup(): Promise<void>;
}

export async function fetchGithub(
  input: { url: string; ref?: string; token?: string },
  run: GitRunner = execGit,
  env: NodeJS.ProcessEnv = process.env,
): Promise<GithubFetch> {
  const { owner, repo, cloneUrl } = parseGithubUrl(input.url);
  if (input.ref !== undefined) validateRef(input.ref);
  const token = input.token || env['GITHUB_TOKEN'] || undefined;
  const gitEnv = buildGitEnv(token);
  const work = await mkdtemp(join(tmpdir(), 'spec2doc-gh-'));
  const untrack = trackTempDir(work);
  const root = join(work, 'repo');
  const cleanup = async (): Promise<void> => {
    untrack();
    await rm(work, { recursive: true, force: true });
  };
  try {
    for (const step of buildGitPlan(cloneUrl, input.ref, root)) {
      await run(step.args, step.cwd === 'work' ? work : root, gitEnv);
    }
    const commit = (await run(['rev-parse', 'HEAD'], root, gitEnv)).trim();
    if (!isCommitSha(commit)) throw new Error(`rev-parse の結果が不正: ${commit}`);
    return { root, commit: commit.toLowerCase(), cleanup };
  } catch (err) {
    await cleanup();
    if (err instanceof InputError) throw err;
    throw new InputError(
      `GitHub から取得できませんでした: ${owner}/${repo}${input.ref ? `@${input.ref}` : ''}`,
      'URL・参照の綴りと、非公開なら環境変数 GITHUB_TOKEN を確かめてください',
    );
  }
}
