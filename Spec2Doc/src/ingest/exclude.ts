// 除外判定: 既定の除外・ルートの .gitignore・利用者指定（REQ-F-004）
// 正規表現を使わない自前の照合（REDoS 対策）。区切り `/` ごとに照合し、`**` は区切りの列を DP で扱う。
// 1 区切り内は * の後戻りを直前の * 1 か所に限る照合で O(パターン長 × 名前長)。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'build', '.git']);

/** パターン 1 行の最大長（超えた行は無視する） */
export const MAX_PATTERN_LENGTH = 512;
/** 読む規則の最大数（.gitignore・利用者指定それぞれ。超えた分は無視する） */
export const MAX_RULES = 2000;
/** 読む .gitignore の最大バイト数 */
export const MAX_GITIGNORE_BYTES = 256 * 1024;

type Token =
  | { readonly t: 'star' }
  | { readonly t: 'any' }
  | { readonly t: 'lit'; readonly c: string }
  | { readonly t: 'class'; readonly neg: boolean; readonly items: readonly (readonly [string, string])[] };

/** 区切り 1 つ分。'**' は区切りの列（0 個以上）に当たる */
type Segment = { readonly globstar: true } | { readonly globstar: false; readonly tokens: readonly Token[] };

export interface Rule {
  readonly raw: string;
  readonly negate: boolean;
  readonly dirOnly: boolean;
  /** true なら basename だけを照合する（区切りを含まないパターン） */
  readonly basenameOnly: boolean;
  readonly segments: readonly Segment[];
}

export interface Excluder {
  /** 上限で読めなかった規則の知らせ */
  readonly notices: readonly ExcludeNotice[];
  /** 除外するなら理由、しないなら null。relPath は root からの `/` 区切り */
  check(relPath: string, isDir: boolean): string | null;
}

/** `[...]` を読む。閉じが無ければ null（`[` を文字として扱う） */
function parseClass(s: string, start: number): { token: Token; next: number } | null {
  let i = start + 1;
  let neg = false;
  if (s[i] === '!' || s[i] === '^') {
    neg = true;
    i += 1;
  }
  const items: (readonly [string, string])[] = [];
  let first = true;
  while (i < s.length && (s[i] !== ']' || first)) {
    first = false;
    let c = s[i] ?? '';
    if (c === '\\' && i + 1 < s.length) {
      i += 1;
      c = s[i] ?? '';
    }
    if (s[i + 1] === '-' && i + 2 < s.length && s[i + 2] !== ']') {
      items.push([c, s[i + 2] ?? c]);
      i += 3;
    } else {
      items.push([c, c]);
      i += 1;
    }
  }
  if (i >= s.length) return null;
  return { token: { t: 'class', neg, items }, next: i + 1 };
}

function compileSegment(seg: string): Segment {
  if (seg === '**') return { globstar: true };
  const tokens: Token[] = [];
  let i = 0;
  while (i < seg.length) {
    const ch = seg[i] ?? '';
    if (ch === '*') {
      if (tokens.at(-1)?.t !== 'star') tokens.push({ t: 'star' }); // 連続する * は 1 つに畳む
      i += 1;
    } else if (ch === '?') {
      tokens.push({ t: 'any' });
      i += 1;
    } else if (ch === '[') {
      const cls = parseClass(seg, i);
      if (cls) {
        tokens.push(cls.token);
        i = cls.next;
      } else {
        tokens.push({ t: 'lit', c: '[' });
        i += 1;
      }
    } else if (ch === '\\' && i + 1 < seg.length) {
      tokens.push({ t: 'lit', c: seg[i + 1] ?? '' });
      i += 2;
    } else {
      tokens.push({ t: 'lit', c: ch });
      i += 1;
    }
  }
  return { globstar: false, tokens };
}

function tokenMatches(tok: Token, c: string): boolean {
  if (tok.t === 'any') return true;
  if (tok.t === 'lit') return tok.c === c;
  if (tok.t === 'class') {
    const hit = tok.items.some(([lo, hi]) => c >= lo && c <= hi);
    return tok.neg ? !hit : hit;
  }
  return false;
}

/** 1 区切りの照合。後戻りは直前の * だけ（O(トークン数 × 文字数)） */
export function matchSegment(tokens: readonly Token[], name: string): boolean {
  let ti = 0;
  let ni = 0;
  let starTi = -1;
  let starNi = 0;
  while (ni < name.length) {
    const tok = tokens[ti];
    if (tok && tok.t === 'star') {
      starTi = ti;
      starNi = ni;
      ti += 1;
    } else if (tok && tokenMatches(tok, name[ni] ?? '')) {
      ti += 1;
      ni += 1;
    } else if (starTi >= 0) {
      ti = starTi + 1;
      starNi += 1;
      ni = starNi;
    } else {
      return false;
    }
  }
  while (tokens[ti]?.t === 'star') ti += 1;
  return ti === tokens.length;
}

/** 区切り列の照合。表 dp[p][s] を 1 回ずつ埋める（O(パターン区切り数 × パス区切り数)） */
export function matchSegments(pat: readonly Segment[], path: readonly string[]): boolean {
  const P = pat.length;
  const S = path.length;
  // next[s]: pat[p+1..] が path[s..] に当たるか。末尾から埋める
  let next: boolean[] = Array.from({ length: S + 1 }, (_, s) => s === S);
  for (let p = P - 1; p >= 0; p -= 1) {
    const seg = pat[p];
    const cur: boolean[] = new Array<boolean>(S + 1).fill(false);
    for (let s = S; s >= 0; s -= 1) {
      if (!seg) continue;
      if (seg.globstar) {
        if (p === P - 1) {
          cur[s] = s < S; // 末尾の ** は中身（1 区切り以上）だけに当たる
        } else {
          cur[s] = (next[s] ?? false) || (s < S && (cur[s + 1] ?? false));
        }
      } else {
        cur[s] = s < S && matchSegment(seg.tokens, path[s] ?? '') && (next[s + 1] ?? false);
      }
    }
    next = cur;
  }
  return next[0] ?? false;
}

/** gitignore 形式の 1 行を規則にする。空行・コメント・長すぎる行は null */
export function parsePattern(line: string): Rule | null {
  if (line.length > MAX_PATTERN_LENGTH) return null;
  const raw = line.replace(/[ \t\r]+$/, '');
  if (raw === '' || raw.startsWith('#')) return null;
  let p = raw;
  let negate = false;
  if (p.startsWith('\\')) p = p.slice(1);
  else if (p.startsWith('!')) {
    negate = true;
    p = p.slice(1);
  }
  let dirOnly = false;
  while (p.endsWith('/')) {
    dirOnly = true;
    p = p.slice(0, -1);
  }
  if (p === '') return null;
  const basenameOnly = !p.includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  const parts = p.split('/').filter((s) => s !== '');
  // 連続する ** は 1 つに畳む
  const segments = parts.map(compileSegment).filter((s, i, a) => !(s.globstar && a[i - 1]?.globstar));
  if (segments.length === 0) return null;
  return { raw, negate, dirOnly, basenameOnly, segments };
}

const HOW_TO = '除外したいファイルは除外パターン欄で指定してください';

/** 上限で読めなかった規則の知らせ（IngestResult.excluded に積む） */
export interface ExcludeNotice {
  path: string;
  reason: string;
}

function parseLines(lines: readonly string[], path: string): { rules: Rule[]; notices: ExcludeNotice[] } {
  const rules: Rule[] = [];
  const notices: ExcludeNotice[] = [];
  const tooLong: number[] = [];
  for (const [i, l] of lines.entries()) {
    if (l.length > MAX_PATTERN_LENGTH) {
      tooLong.push(i + 1);
      continue;
    }
    const r = parsePattern(l);
    if (!r) continue;
    if (rules.length >= MAX_RULES) {
      notices.push({ path, reason: `規則の上限（${MAX_RULES} 件）を超えたため ${i + 1} 行目以降を無視。${HOW_TO}` });
      break;
    }
    rules.push(r);
  }
  if (tooLong.length > 0) {
    const shown = tooLong.slice(0, 5).join('・') + (tooLong.length > 5 ? ' ほか' : '');
    notices.push({
      path,
      reason: `パターン長の上限（${MAX_PATTERN_LENGTH} 文字）を超えた ${tooLong.length} 行（${shown} 行目）を無視。${HOW_TO}`,
    });
  }
  return { rules, notices };
}

export function parseRules(text: string): Rule[] {
  return parseLines(text.split('\n'), '.gitignore').rules;
}

export function ruleMatches(rule: Rule, rel: string): boolean {
  const parts = rel.split('/');
  if (rule.basenameOnly) return matchSegments(rule.segments, [parts.at(-1) ?? '']);
  return matchSegments(rule.segments, parts);
}

function lastMatch(rules: readonly Rule[], rel: string, isDir: boolean, prefix: string): string | null | undefined {
  let result: string | null | undefined;
  for (const r of rules) {
    if (r.dirOnly && !isDir) continue;
    if (ruleMatches(r, rel)) result = r.negate ? null : `${prefix}${r.raw}`;
  }
  return result;
}

export function createExcluder(
  gitignoreText: string | null,
  userPatterns: readonly string[],
  extraNotices: readonly ExcludeNotice[] = [],
): Excluder {
  const git = gitignoreText ? parseLines(gitignoreText.split('\n'), '.gitignore') : { rules: [], notices: [] };
  const user = parseLines(userPatterns, '除外パターン欄');
  const gitRules = git.rules;
  const userRules = user.rules;
  const notices = [...extraNotices, ...git.notices, ...user.notices];
  return {
    notices,
    check(rel: string, isDir: boolean): string | null {
      const name = rel.slice(rel.lastIndexOf('/') + 1);
      if (isDir && DEFAULT_DIRS.has(name)) return name;
      if (!isDir && name.endsWith('.min.js')) return '*.min.js';
      const byUser = lastMatch(userRules, rel, isDir, '利用者指定: ');
      if (byUser !== undefined) return byUser;
      return lastMatch(gitRules, rel, isDir, '.gitignore: ') ?? null;
    },
  };
}

/** root 直下の .gitignore（無ければ無視。先頭 MAX_GITIGNORE_BYTES まで）と利用者指定から判定器を作る */
export async function loadExcluder(root: string, userPatterns: readonly string[]): Promise<Excluder> {
  const buf = await readFile(join(root, '.gitignore')).catch(() => null);
  if (!buf) return createExcluder(null, userPatterns);
  if (buf.length <= MAX_GITIGNORE_BYTES) return createExcluder(buf.toString('utf8'), userPatterns);
  const head = buf.subarray(0, MAX_GITIGNORE_BYTES).toString('utf8');
  const kept = head.slice(0, head.lastIndexOf('\n') + 1); // 途中で切れた行は使わない
  const nextLine = kept.split('\n').length;
  const notice = {
    path: '.gitignore',
    reason: `ファイルの上限（${MAX_GITIGNORE_BYTES / 1024}KB）を超えたため ${nextLine} 行目以降を無視。${HOW_TO}`,
  };
  return createExcluder(kept, userPatterns, [notice]);
}
