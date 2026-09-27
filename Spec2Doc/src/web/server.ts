// Web 画面（REQ-F-027・028・040、REQ-N-002・010・014）。node:http・127.0.0.1 のみ。処理は CLI と同じ中核 run。
// 起動: `node src/web/server.ts`（ポートは環境変数 PORT、既定 8765）

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { run, type Progress, type RunLog, type RunOptions, type RunResult } from '../core.ts';
import { InputError, type IngestInput } from '../ingest/index.ts';
import { DOC_TITLES } from '../doc/model.ts';
import { isInputError, parseDocIds, parseFormats, resolveLlm } from '../cli.ts';
import { validateReview } from '../trace/review.ts';
import { AUDIT_FILE, appendAudit, diffReviewToAudit } from '../trace/audit.ts';
import { compareTrace } from '../trace/compare.ts';
import { toReqIF } from '../trace/export-reqif.ts';
import { toMatrixXlsx } from '../trace/export-xlsx.ts';
import { TRACE_VERSION, type ReviewEntry, type TraceAuditEvent, type TraceGraph, type TraceReview } from '../trace/schema.ts';
import { BodyTooLargeError, boundaryOf, MultipartError, parseMultipart, readBody, type MultipartResult } from './multipart.ts';

export type Runner = (options: RunOptions, onProgress: (p: Progress) => void) => Promise<RunResult>;

export interface WebOptions {
  /** 出力の親フォルダ。既定は `out` */
  outDir?: string;
  /** アップロードの上限（バイト）。既定 100 MB（環境変数 MAX_UPLOAD_MB で変更） */
  maxUploadBytes?: number;
  /** 既定は core の run（テストで差し替える） */
  runner?: Runner;
  /** 「デモのサンプルで試す」のフォルダ。既定は fixtures/demo-library（無ければ画面のボタンを隠す） */
  demoDir?: string;
}

interface Failure {
  message: string;
  hint: string;
}

interface JobEvent {
  event: 'progress' | 'result' | 'failure';
  data: unknown;
}

interface Job {
  events: JobEvent[];
  listeners: Set<ServerResponse>;
  done: boolean;
}

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const FILE_RE = /^[A-Za-z0-9_-]{1,40}\.(md|html|docx|xlsx|json)$/;
const MIME: Readonly<Record<string, string>> = {
  md: 'text/markdown; charset=utf-8',
  html: 'text/html; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json; charset=utf-8',
};
const JOB_TTL_MS = 30 * 60 * 1000;
/** 進行中の実行が使っているアップロード用一時領域。シグナルで止められたときに消す（REQ-F-040） */
const activeTmpDirs = new Set<string>();

/** 画面が読む kit の出荷物（yuki-aidd-kit から無改変で複製）。読み込み順は tokens → components → layout */
const STATIC_ASSETS: Readonly<Record<string, string>> = {
  '/tokens.css': 'text/css; charset=utf-8',
  '/components.css': 'text/css; charset=utf-8',
  '/layout.css': 'text/css; charset=utf-8',
  '/icons.js': 'text/javascript; charset=utf-8',
  '/feedback.js': 'text/javascript; charset=utf-8',
};

const DEMO_DIR = fileURLToPath(new URL('../../fixtures/demo-library', import.meta.url));
const INDEX_PATH = fileURLToPath(new URL('./index.html', import.meta.url));

/**
 * 閲覧用 HTML の CSP。文書内の inline script（目次の追従など）だけを sha256 で許し、外部読み込みは許さない。
 * sandbox は allow-scripts のみ（allow-same-origin は付けない＝この画面の Cookie・保存領域に触れない）
 */
export function viewCsp(html: string): string {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1] ?? '', 'utf8').digest('base64')}'`,
  );
  const scriptSrc = hashes.length > 0 ? [...new Set(hashes)].join(' ') : "'none'";
  return `sandbox allow-scripts; default-src 'none'; script-src ${scriptSrc}; style-src 'unsafe-inline'; img-src data:`;
}

/** 確認状態の保存の本文の上限（1 MB） */
export const MAX_REVIEW_BYTES = 1024 * 1024;

function scriptHash(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

/**
 * トレーサビリティ画面（トップレベルのページ）の CSP。確認状態を同一オリジンへ保存するため sandbox は付けない。
 * 許す script は文書内の inline script（差し込んだ API の場所を含む）の sha256 だけ。外部読み込みは許さない
 */
export function traceCsp(html: string): string {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => scriptHash(m[1] ?? ''));
  const scriptSrc = hashes.length > 0 ? [...new Set(hashes)].join(' ') : "'none'";
  return `default-src 'none'; script-src ${scriptSrc}; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;
}

/** 確認状態の保存先を画面に知らせる script を head の先頭に差し込む */
export function injectTraceApi(html: string, runId: string, embed = false): string {
  // embed=1（アプリの本文に埋め込む表示）では、画面側が自前のヘッダを出さないよう描画前に知らせる
  const tag = `<script>window.SPEC2DOC_TRACE_API=${JSON.stringify(`/api/runs/${runId}/trace-review`)}</script>${embed ? '<script>window.SPEC2DOC_EMBED=true</script>' : ''}`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (!head) return tag + html;
  const at = head.index + head[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}

/** 結果画面のトレーサビリティの要約。traceability.html が無い実行は undefined */
async function traceSummary(outDir: string, runId: string): Promise<{ nodes: number; links: number; reviewed: number; needsFix: number } | undefined> {
  const htmlPath = safeOutPath(outDir, runId, 'traceability.html');
  const graphPath = safeOutPath(outDir, runId, 'trace.json');
  if (!htmlPath || !graphPath || !(await stat(htmlPath).catch(() => undefined))?.isFile()) return undefined;
  try {
    const graph = JSON.parse(await readFile(graphPath, 'utf8')) as TraceGraph;
    const review = await readReview(outDir, runId);
    const ids = new Set(graph.links.map((l) => l.id));
    // 判定済み＝未確認でないもの（確認済み・要修正・対象外）。進み具合は「まだ見ていない件数」で測る
    const judged = Object.entries(review.reviews).filter(([id, r]) => ids.has(id) && r.status !== 'unreviewed');
    const needsFix = judged.filter(([, r]) => r.status === 'ng').length;
    return { nodes: graph.nodes.length, links: graph.links.length, reviewed: judged.length, needsFix };
  } catch (e) {
    console.error('[spec2doc web] trace.json を読めませんでした', e);
    return undefined;
  }
}

/** 実行の trace.json。無い・読めない・版が違えば undefined */
async function readGraph(outDir: string, runId: string): Promise<TraceGraph | undefined> {
  const path = safeOutPath(outDir, runId, 'trace.json');
  const text = path ? await readFile(path, 'utf8').catch(() => undefined) : undefined;
  if (text === undefined) return undefined;
  try {
    const g = JSON.parse(text) as TraceGraph;
    return g && g.version === TRACE_VERSION && Array.isArray(g.links) && Array.isArray(g.nodes) ? g : undefined;
  } catch (e) {
    console.error(`[spec2doc web] trace.json を読めませんでした（${runId}）`, e);
    return undefined;
  }
}

/** 監査記録（trace-audit.jsonl）を新しい順で返す。無ければ空。壊れた行は飛ばしてログに残す */
export async function readAudit(outDir: string, runId: string): Promise<TraceAuditEvent[]> {
  // 監査記録は .jsonl なので FILE_RE の外。実行 ID を検査したうえで実行のフォルダの直下に限る
  const path = RUN_ID_RE.test(runId) ? join(resolve(outDir), runId, AUDIT_FILE) : undefined;
  const text = path ? await readFile(path, 'utf8').catch(() => '') : '';
  const events = text.split('\n').filter((l) => l.trim() !== '').flatMap((line): TraceAuditEvent[] => {
    try {
      const e: unknown = JSON.parse(line);
      return isObj(e) && typeof e['at'] === 'string' && typeof e['field'] === 'string' ? [e as unknown as TraceAuditEvent] : [];
    } catch {
      console.error(`[spec2doc web] 監査記録の壊れた行を飛ばしました（${runId}）`);
      return [];
    }
  });
  return events.reverse();
}

/** 保存済みのコメントを消す・書き換える変更を探す（追記のみを強制）。違反した行の id を返す */
export function rewrittenComments(prev: TraceReview, next: TraceReview): string | undefined {
  const same = (a: NonNullable<ReviewEntry['comments']>[number], b: NonNullable<ReviewEntry['comments']>[number] | undefined): boolean =>
    b !== undefined && a.at === b.at && a.text === b.text && (a.by ?? '') === (b.by ?? '');
  return Object.entries(prev.reviews).find(([id, p]) => {
    const kept = p.comments ?? [];
    if (kept.length === 0) return false;
    const now = Object.hasOwn(next.reviews, id) ? next.reviews[id]?.comments ?? [] : [];
    return kept.some((c, i) => !same(c, now[i]));
  })?.[0];
}

async function readReview(outDir: string, runId: string): Promise<TraceReview> {
  const path = safeOutPath(outDir, runId, 'trace-review.json');
  const text = path ? await readFile(path, 'utf8').catch(() => undefined) : undefined;
  return text === undefined ? { version: TRACE_VERSION, runId, reviews: {} } : (JSON.parse(text) as TraceReview);
}

/** out/ の中のファイルだけを返す。範囲外・不正な名前は undefined（パストラバーサル防止） */
export function safeOutPath(outDir: string, runId: string, name: string): string | undefined {
  if (!RUN_ID_RE.test(runId) || !FILE_RE.test(name)) return undefined;
  const root = resolve(outDir);
  const p = resolve(root, runId, name);
  return p.startsWith(root + sep) ? p : undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendFailure(res: ServerResponse, status: number, f: Failure): void {
  sendJson(res, status, f);
}

function toFailure(e: unknown): Failure {
  if (isInputError(e)) return { message: e.message, hint: e.hint };
  console.error('[spec2doc web] 想定外の失敗', e);
  return {
    message: '処理中に想定外の失敗が起きました',
    hint: '入力を確かめてもう一度実行してください。続く場合はサーバのログを添えて報告してください',
  };
}

function one(mp: MultipartResult, key: string): string {
  return mp.fields.get(key)?.[0]?.trim() ?? '';
}

function buildInput(mp: MultipartResult, zipPath: string | undefined): IngestInput {
  const kind = one(mp, 'kind');
  if (kind === 'github') {
    const url = one(mp, 'url');
    if (url === '') throw new InputError('GitHub の URL が空です', 'https://github.com/<所有者>/<リポジトリ> の形で入力してください');
    const ref = one(mp, 'ref');
    const token = process.env['GITHUB_TOKEN'];
    return { kind, url, ...(ref ? { ref } : {}), ...(token ? { token } : {}) };
  }
  if (kind === 'zip') {
    if (!zipPath) throw new InputError('.zip ファイルが選ばれていません', '「.zip ファイル」の欄から .zip を選んでください');
    return { kind, path: zipPath };
  }
  if (kind === 'folder') {
    const path = one(mp, 'folder');
    if (path === '') throw new InputError('フォルダのパスが空です', '解析するフォルダの絶対パスを入力してください');
    return { kind, path };
  }
  throw new InputError('入力の種類が不正です', '画面を再読み込みしてからやり直してください');
}

function buildOptions(mp: MultipartResult, outDir: string, zipPath: string | undefined): RunOptions {
  return {
    input: buildInput(mp, zipPath),
    outDir,
    docIds: parseDocIds(mp.fields.get('docs') ?? []),
    formats: parseFormats(mp.fields.get('formats') ?? []),
    exclude: parseExclude(one(mp, 'exclude')),
    llm: resolveLlm(one(mp, 'llm') === 'on'),
  };
}

/** 除外パターン（改行区切り）。空行と前後の空白は捨てる */
export function parseExclude(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
}

/** 実行完了の結果（SSE の result）。実行直後と履歴の 1 件取得（GET /api/runs/<runId>）の両方がこれを使う */
async function summarize(result: Pick<RunResult, 'runId' | 'hasFailures' | 'log'>, outDir: string): Promise<unknown> {
  const { settings, outputs, fileCounts, durationMs } = result.log;
  const trace = await traceSummary(outDir, result.runId);
  const questions = await questionCount(outDir, { ...result.log, runId: result.runId });
  return {
    runId: result.runId,
    hasFailures: result.hasFailures,
    fileCounts,
    durationMs,
    docs: settings.docIds.map((id) => {
      // 前回の実行と比べて内容が変わった節の数（REQ-F-035。位置のみ変更は数えない）。初回生成の文書には載せない
      const changes = result.log.docChanges?.[id]?.filter((c) => c.kind !== 'moved');
      return {
        id,
        title: DOC_TITLES[id],
        files: settings.formats.map((f) => `${id}.${f}`).filter((n) => outputs.includes(n)),
        ...(changes ? { changes: changes.length } : {}),
      };
    }),
    extras: outputs.filter((n) => n === 'ir.json' || n === 'run-log.json'),
    ...(trace ? { trace: { ...trace, url: `/trace/${result.runId}` } } : {}),
    ...(questions !== undefined ? { questions } : {}),
  };
}

/**
 * ホームの KPI「確認事項（D09）」。生成した D09 の一覧表の行数（検証の工程で不明に下げた行を含む。run-log の questions）。
 * D09 を生成しなかった実行は null。questions を持たない古い実行だけ ir.json の unknowns の件数で代える。読めなければ undefined
 */
async function questionCount(outDir: string, log: RunLog): Promise<number | null | undefined> {
  if (!log.settings.docIds.includes('D09')) return null;
  if (typeof log.questions === 'number' || log.questions === null) return log.questions;
  const path = safeOutPath(outDir, log.runId, 'ir.json');
  if (!path) return undefined;
  try {
    const ir: unknown = JSON.parse(await readFile(path, 'utf8'));
    const unknowns = isObj(ir) ? ir['unknowns'] : undefined;
    return Array.isArray(unknowns) ? unknowns.length : undefined;
  } catch {
    return undefined;
  }
}

/** 実行の履歴の一覧の 1 件（GET /api/runs） */
export interface RunSummary {
  runId: string;
  startedAt: string;
  /** 表示用の入力元（run-log の sourceKey。絶対パスは含めない） */
  source: string;
  fileCount: number;
  analyzed: number;
  failed: number;
  excluded: number;
  docs: string[];
  formats: string[];
  durationMs: number;
  hasTrace: boolean;
  /** 前回から内容の変更があった文書の数（位置のみ変更は数えない）。差分情報が無ければ 0 */
  changedDocs: number;
  traceUrl?: string;
}

export const RUNS_LIMIT_DEFAULT = 50;
export const RUNS_LIMIT_MAX = 200;

type LoadedRunLog = { ok: true; log: RunLog } | { ok: false; missing: boolean; reason: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** run-log.json の形の検査。一覧・結果の組み立てに使う項目が欠けていれば理由を返す（サーバのログ用） */
function runLogProblem(v: unknown, runId: string): string | undefined {
  if (!isObj(v)) return '中身がオブジェクトではありません';
  if (v['runId'] !== runId) return 'runId がフォルダ名と一致しません';
  const startedAt = v['startedAt'];
  if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) return 'startedAt が日時ではありません';
  if (!isNum(v['durationMs'])) return 'durationMs が数値ではありません';
  const settings = v['settings'];
  if (!isObj(settings) || !isStrArr(settings['docIds']) || !isStrArr(settings['formats'])) return 'settings（docIds・formats）が欠けています';
  const counts = v['fileCounts'];
  if (!isObj(counts) || !['total', 'analyzed', 'failed', 'excluded'].every((k) => isNum(counts[k]))) return 'fileCounts が欠けています';
  if (!isStrArr(v['outputs'])) return 'outputs が欠けています';
  const changes = v['docChanges'];
  if (changes !== undefined && (!isObj(changes) || !Object.values(changes).every((c) => Array.isArray(c)))) return 'docChanges の形が不正です';
  return undefined;
}

async function loadRunLog(outDir: string, runId: string): Promise<LoadedRunLog> {
  const path = safeOutPath(outDir, runId, 'run-log.json');
  if (!path) return { ok: false, missing: true, reason: '実行 ID が不正です' };
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    return { ok: false, missing: true, reason: `run-log.json を読めません（${(e as NodeJS.ErrnoException).code ?? String(e)}）` };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, missing: false, reason: 'run-log.json が JSON として壊れています' };
  }
  const problem = runLogProblem(json, runId);
  return problem ? { ok: false, missing: false, reason: problem } : { ok: true, log: json as RunLog };
}

/** 表示用の入力元。sourceKey が無い古い記録は入力のラベルの末尾だけを出す（絶対パスを出さない） */
function sourceOf(log: RunLog): string {
  if (typeof log.sourceKey === 'string' && log.sourceKey !== '') return log.sourceKey;
  const label: unknown = (log.input as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' ? (label.split(/[\\/]/).filter((s) => s !== '').pop() ?? '') : '';
}

async function toRunSummary(outDir: string, log: RunLog): Promise<RunSummary> {
  const htmlPath = safeOutPath(outDir, log.runId, 'traceability.html');
  const hasTrace = htmlPath ? (await stat(htmlPath).catch(() => undefined))?.isFile() === true : false;
  const changedDocs = log.settings.docIds.filter((id) => (log.docChanges?.[id] ?? []).some((c) => c.kind !== 'moved')).length;
  const { total, analyzed, failed, excluded } = log.fileCounts;
  return {
    runId: log.runId,
    startedAt: log.startedAt,
    source: sourceOf(log),
    fileCount: total,
    analyzed,
    failed,
    excluded,
    docs: [...log.settings.docIds],
    formats: [...log.settings.formats],
    durationMs: log.durationMs,
    hasTrace,
    changedDocs,
    ...(hasTrace ? { traceUrl: `/trace/${log.runId}` } : {}),
  };
}

/** out/ の各実行フォルダの run-log.json を新しい順に並べる。壊れた・欠けた記録は外してサーバのログに理由を出す */
export async function listRuns(outDir: string, limit: number): Promise<RunSummary[]> {
  const entries = await readdir(outDir, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return [];
    throw e;
  });
  const names = entries.filter((d) => d.isDirectory() && RUN_ID_RE.test(d.name)).map((d) => d.name);
  const loaded = await Promise.all(names.map(async (name) => ({ name, r: await loadRunLog(outDir, name) })));
  const logs: RunLog[] = [];
  for (const { name, r } of loaded) {
    if (r.ok) logs.push(r.log);
    else console.error(`[spec2doc web] 実行の履歴から外しました（${name}）: ${r.reason}`);
  }
  const sorted = [...logs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.runId.localeCompare(a.runId));
  return Promise.all(sorted.slice(0, limit).map((log) => toRunSummary(outDir, log)));
}

/** 一覧の件数。省略時は既定値、1〜200 の整数以外は undefined（400） */
export function parseRunsLimit(raw: string | null): number | undefined {
  if (raw === null) return RUNS_LIMIT_DEFAULT;
  if (!/^\d{1,4}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= 1 && n <= RUNS_LIMIT_MAX ? n : undefined;
}

export function createWebServer(opts: WebOptions = {}): Server {
  const outDir = resolve(opts.outDir ?? 'out');
  const maxUpload = opts.maxUploadBytes ?? Number(process.env['MAX_UPLOAD_MB'] ?? 100) * 1024 * 1024;
  const runner: Runner = opts.runner ?? run;
  const jobs = new Map<string, Job>();
  let busy = false;
  let indexHtml: Promise<Buffer> | undefined;
  const demoDir = resolve(opts.demoDir ?? DEMO_DIR);

  const emit = (job: Job, ev: JobEvent): void => {
    job.events.push(ev);
    const text = `event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`;
    for (const res of job.listeners) res.write(text);
    if (ev.event !== 'progress') {
      job.done = true;
      for (const res of job.listeners) res.end();
      job.listeners.clear();
    }
  };

  // busy は startJob が受け取った後、runner の完了で解放する（受け取る前の経路は handleRun の finally で解放）
  const startJob = (options: RunOptions, tmp: string | undefined): string => {
    const id = randomBytes(8).toString('hex');
    const job: Job = { events: [], listeners: new Set(), done: false };
    jobs.set(id, job);
    if (tmp) activeTmpDirs.add(tmp);
    runner(options, (p) => emit(job, { event: 'progress', data: p }))
      .then(async (r) => emit(job, { event: 'result', data: await summarize(r, outDir) }))
      .catch((e: unknown) => emit(job, { event: 'failure', data: toFailure(e) }))
      .finally(async () => {
        try {
          if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {});
        } finally {
          if (tmp) activeTmpDirs.delete(tmp);
          busy = false;
          setTimeout(() => jobs.delete(id), JOB_TTL_MS).unref();
        }
      });
    return id;
  };

  const handleRun = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 判定と確保を同期的に 1 か所で行う（本文を読む前）。同時に届いた 2 本目以降は 409
    if (busy) {
      req.resume();
      sendFailure(res, 409, { message: '別の実行が進行中です', hint: '進行中の実行が終わってから、もう一度実行してください' });
      return;
    }
    busy = true;
    let handedOff = false;
    let tmp: string | undefined;
    try {
      const boundary = boundaryOf(req.headers['content-type']);
      if (!boundary) {
        req.resume();
        sendFailure(res, 400, { message: '送信の形式が不正です', hint: '画面を再読み込みしてからやり直してください' });
        return;
      }
      const mp = parseMultipart(await readBody(req, maxUpload), boundary);
      const zip = one(mp, 'kind') === 'zip' ? mp.files.find((f) => f.field === 'zip') : undefined;
      if (zip) {
        if (!/\.zip$/i.test(zip.filename)) throw new InputError('.zip 以外のファイルが選ばれています', '拡張子が .zip のファイルを選んでください');
        tmp = await mkdtemp(join(tmpdir(), 'spec2doc-upload-'));
        await writeFile(join(tmp, 'upload.zip'), zip.data, { mode: 0o400 });
      }
      const options = buildOptions(mp, outDir, tmp ? join(tmp, 'upload.zip') : undefined);
      const jobId = startJob(options, tmp);
      handedOff = true;
      sendJson(res, 202, { jobId });
    } catch (e) {
      if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {});
      if (e instanceof BodyTooLargeError) {
        sendFailure(res, 413, { message: e.message, hint: '不要なファイルを除いた小さな .zip にするか、フォルダのパスで指定してください' });
        req.resume();
      } else if (e instanceof MultipartError) {
        sendFailure(res, 400, { message: '送信内容を読めませんでした', hint: '画面を再読み込みしてからやり直してください' });
      } else if (isInputError(e)) {
        sendFailure(res, 400, { message: e.message, hint: e.hint });
      } else {
        sendFailure(res, 500, toFailure(e));
      }
    } finally {
      if (!handedOff) busy = false;
    }
  };

  const handleEvents = (id: string, req: IncomingMessage, res: ServerResponse): void => {
    const job = jobs.get(id);
    if (!job) {
      sendFailure(res, 404, { message: '実行が見つかりません', hint: 'もう一度実行してください' });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
    for (const ev of job.events) res.write(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`);
    if (job.done) {
      res.end();
      return;
    }
    job.listeners.add(res);
    req.on('close', () => job.listeners.delete(res));
  };

  const handleFile = async (mode: 'files' | 'view', rawRunId: string, rawName: string, res: ServerResponse): Promise<void> => {
    let runId: string;
    let name: string;
    try {
      runId = decodeURIComponent(rawRunId);
      name = decodeURIComponent(rawName);
    } catch {
      sendFailure(res, 400, { message: 'ファイルの指定が不正です', hint: '結果の一覧のリンクから開いてください' });
      return;
    }
    const path = safeOutPath(outDir, runId, name);
    if (!path || (mode === 'view' && !name.endsWith('.html'))) {
      sendFailure(res, 400, { message: 'ファイルの指定が不正です', hint: '結果の一覧のリンクから開いてください' });
      return;
    }
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) {
      sendFailure(res, 404, { message: 'ファイルが見つかりません', hint: 'もう一度実行して文書を作り直してください' });
      return;
    }
    const ext = name.slice(name.lastIndexOf('.') + 1);
    const headers: Record<string, string> = {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    };
    const body = await readFile(path);
    if (mode === 'view') {
      headers['content-security-policy'] = viewCsp(body.toString('utf8'));
    } else {
      headers['content-disposition'] = `attachment; filename="${name}"`;
    }
    res.writeHead(200, headers);
    res.end(body);
  };

  const badTrace = (res: ServerResponse): void =>
    sendFailure(res, 400, { message: '実行の指定が不正です', hint: '結果の画面の「開く」から開いてください' });

  const decodeRunId = (raw: string): string | undefined => {
    try {
      const id = decodeURIComponent(raw);
      return RUN_ID_RE.test(id) ? id : undefined;
    } catch {
      return undefined;
    }
  };

  const handleTracePage = async (rawRunId: string, res: ServerResponse, embed = false): Promise<void> => {
    const runId = decodeRunId(rawRunId);
    const path = runId ? safeOutPath(outDir, runId, 'traceability.html') : undefined;
    if (!runId || !path) return badTrace(res);
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) {
      sendFailure(res, 404, { message: 'トレーサビリティの画面が見つかりません', hint: '出力形式に「HTML（トレーサビリティ）」を選んで、もう一度実行してください' });
      return;
    }
    const html = injectTraceApi(await readFile(path, 'utf8'), runId, embed);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'content-security-policy': traceCsp(html),
    });
    res.end(html);
  };

  const handleReviewGet = async (runId: string, res: ServerResponse): Promise<void> => {
    try {
      sendJson(res, 200, await readReview(outDir, runId));
    } catch (e) {
      console.error('[spec2doc web] trace-review.json を読めませんでした', e);
      sendFailure(res, 500, { message: '確認状態を読めませんでした', hint: 'もう一度実行して作り直してください' });
    }
  };

  const handleReviewPut = async (runId: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const type = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    if (type !== 'application/json') {
      req.resume();
      sendFailure(res, 400, { message: '送信の形式が不正です（JSON ではありません）', hint: '画面を再読み込みしてから保存し直してください' });
      return;
    }
    let body: Buffer;
    try {
      body = await readBody(req, MAX_REVIEW_BYTES);
    } catch (e) {
      if (!(e instanceof BodyTooLargeError)) throw e;
      req.resume();
      sendFailure(res, 413, { message: '確認状態が大きすぎます（上限 1 MB）', hint: 'メモを短くしてから保存し直してください' });
      return;
    }
    const graphPath = safeOutPath(outDir, runId, 'trace.json');
    const graphText = graphPath ? await readFile(graphPath, 'utf8').catch(() => undefined) : undefined;
    if (!graphPath || graphText === undefined) {
      sendFailure(res, 404, { message: 'この実行のトレーサビリティが見つかりません', hint: '出力形式に「HTML（トレーサビリティ）」を選んで、もう一度実行してください' });
      return;
    }
    let review: TraceReview;
    try {
      const json: unknown = JSON.parse(body.toString('utf8'));
      review = validateReview(json, JSON.parse(graphText) as TraceGraph);
      if (review.runId !== runId) throw new InputError('実行 ID が保存先と一致しません', '画面を再読み込みしてから保存し直してください');
    } catch (e) {
      const f = isInputError(e) ? { message: e.message, hint: e.hint } : { message: '確認状態の内容が不正です', hint: '画面を再読み込みしてから保存し直してください' };
      sendFailure(res, 400, f);
      return;
    }
    const saved = await readReview(outDir, runId);
    const rewritten = rewrittenComments(saved, review);
    if (rewritten !== undefined) {
      sendFailure(res, 409, { message: '保存済みのコメントは消したり書き換えたりできません（追記のみ）', hint: '画面を再読み込みして最新の状態にしてから、コメントを追記してください' });
      return;
    }
    if (review.baselineRunId !== undefined && review.baselineRunId !== saved.baselineRunId && !(await readGraph(outDir, review.baselineRunId))) {
      sendFailure(res, 400, { message: 'ベースラインに指定した実行が見つかりません', hint: '実行の履歴にある実行（トレーサビリティ付き）を選び直してください' });
      return;
    }
    const target = join(outDir, runId, 'trace-review.json');
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(review, null, 2), 'utf8');
      await rename(tmp, target);
    } catch (e) {
      await rm(tmp, { force: true }).catch(() => {});
      throw e;
    }
    await appendAudit(join(outDir, runId), diffReviewToAudit(saved, review, runId));
    sendJson(res, 200, review);
  };

  const traceNotFound = (res: ServerResponse): void =>
    sendFailure(res, 404, { message: 'この実行のトレーサビリティが見つかりません', hint: '出力形式に「HTML（トレーサビリティ）」を選んで、もう一度実行してください' });

  const handleAuditGet = async (runId: string, res: ServerResponse): Promise<void> => {
    if (!(await readGraph(outDir, runId))) return traceNotFound(res);
    sendJson(res, 200, { events: await readAudit(outDir, runId) });
  };

  const handleCompareGet = async (runId: string, url: URL, res: ServerResponse): Promise<void> => {
    const baseId = url.searchParams.get('base') ?? '';
    if (!RUN_ID_RE.test(baseId)) {
      sendFailure(res, 400, { message: '比較の基準の実行の指定が不正です', hint: '実行の履歴にある実行を比較の基準に選び直してください' });
      return;
    }
    const cur = await readGraph(outDir, runId);
    if (!cur) return traceNotFound(res);
    const baseGraph = await readGraph(outDir, baseId);
    if (!baseGraph) {
      sendFailure(res, 404, { message: '比較の基準の実行が見つかりません', hint: '実行の履歴にある実行（トレーサビリティ付き）を比較の基準に選び直してください' });
      return;
    }
    sendJson(res, 200, compareTrace(baseGraph, cur));
  };

  const handleExportGet = async (runId: string, url: URL, res: ServerResponse): Promise<void> => {
    const format = url.searchParams.get('format');
    if (format !== 'reqif' && format !== 'xlsx') {
      sendFailure(res, 400, { message: '書き出しの形式が不正です（reqif か xlsx）', hint: '画面の書き出しのボタンから選び直してください' });
      return;
    }
    const graph = await readGraph(outDir, runId);
    if (!graph) return traceNotFound(res);
    const review = await readReview(outDir, runId);
    const body = format === 'reqif' ? Buffer.from(toReqIF(graph, review), 'utf8') : await toMatrixXlsx(graph, review);
    res.writeHead(200, {
      'content-type': format === 'reqif' ? 'application/xml; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="trace-${runId}.${format}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  };

  const handleRunsList = async (url: URL, res: ServerResponse): Promise<void> => {
    const limit = parseRunsLimit(url.searchParams.get('limit'));
    if (limit === undefined) {
      sendFailure(res, 400, { message: `表示する件数の指定が不正です（1〜${RUNS_LIMIT_MAX}）`, hint: '画面を再読み込みしてから、実行の履歴を開き直してください' });
      return;
    }
    sendJson(res, 200, { runs: await listRuns(outDir, limit) });
  };

  const handleRunGet = async (rawRunId: string, res: ServerResponse): Promise<void> => {
    const runId = decodeRunId(rawRunId);
    if (!runId || !safeOutPath(outDir, runId, 'run-log.json')) {
      sendFailure(res, 400, { message: '実行の指定が不正です', hint: '実行の履歴の一覧から開き直してください' });
      return;
    }
    const loaded = await loadRunLog(outDir, runId);
    if (!loaded.ok) {
      console.error(`[spec2doc web] 実行の記録を返せませんでした（${runId}）: ${loaded.reason}`);
      sendFailure(res, 404, {
        message: loaded.missing ? 'この実行の記録が見つかりません' : 'この実行の記録を読めませんでした',
        hint: loaded.missing ? '実行の履歴を開き直して、一覧にある実行を選んでください' : 'もう一度実行して文書を作り直してください',
      });
      return;
    }
    const { log } = loaded;
    sendJson(res, 200, await summarize({ runId, hasFailures: log.fileCounts.failed > 0, log }, outDir));
  };

  const allowedHost = (req: IncomingMessage): boolean => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const origin = req.headers.origin;
    return hosts.includes(req.headers.host ?? '') && (origin === undefined || hosts.some((h) => origin === `http://${h}`));
  };

  const route = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!allowedHost(req)) {
      sendFailure(res, 403, { message: 'この接続先からは使えません', hint: 'http://127.0.0.1:<ポート>/ を開いてください' });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter((s) => s !== '');
    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      // ブラウザが自動で取りに来る。アイコンは持たないので 204（CSP の img-src は緩めない）
      res.writeHead(204, { 'cache-control': 'max-age=86400' });
      res.end();
      return;
    }
    const asset = req.method === 'GET' ? STATIC_ASSETS[url.pathname] : undefined;
    if (asset) {
      const body = await readFile(fileURLToPath(new URL(`.${url.pathname}`, import.meta.url)));
      res.writeHead(200, { 'content-type': asset, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/') {
      indexHtml ??= readFile(INDEX_PATH);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self'",
      });
      res.end(await indexHtml);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/run') return handleRun(req, res);
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const demo = await stat(demoDir).catch(() => undefined);
      sendJson(res, 200, { demoPath: demo?.isDirectory() ? demoDir : null });
      return;
    }
    if (req.method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'jobs' && parts[3] === 'events') {
      handleEvents(parts[2] ?? '', req, res);
      return;
    }
    if (req.method === 'GET' && parts.length === 3 && (parts[0] === 'files' || parts[0] === 'view')) {
      return handleFile(parts[0] as 'files' | 'view', parts[1] ?? '', parts[2] ?? '', res);
    }
    if (req.method === 'GET' && parts[0] === 'trace') {
      return parts.length === 2 ? handleTracePage(parts[1] ?? '', res, url.searchParams.get('embed') === '1') : badTrace(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/runs') return handleRunsList(url, res);
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'runs') return handleRunGet(parts[2] ?? '', res);
    if (parts.length === 4 && parts[0] === 'api' && parts[1] === 'runs' && parts[3] === 'trace-review') {
      const runId = decodeRunId(parts[2] ?? '');
      if (!runId) {
        req.resume();
        return badTrace(res);
      }
      if (req.method === 'GET') return handleReviewGet(runId, res);
      if (req.method === 'PUT') return handleReviewPut(runId, req, res);
      req.resume();
      sendFailure(res, 405, { message: 'この操作は使えません', hint: '画面を再読み込みしてからやり直してください' });
      return;
    }
    const traceApi = parts.length === 4 && parts[0] === 'api' && parts[1] === 'runs' ? parts[3] : undefined;
    if (traceApi === 'trace-audit' || traceApi === 'trace-compare' || traceApi === 'trace-export') {
      const runId = decodeRunId(parts[2] ?? '');
      req.resume();
      if (!runId) return badTrace(res);
      if (req.method !== 'GET') {
        sendFailure(res, 405, { message: 'この操作は使えません', hint: '画面を再読み込みしてからやり直してください' });
        return;
      }
      if (traceApi === 'trace-audit') return handleAuditGet(runId, res);
      if (traceApi === 'trace-compare') return handleCompareGet(runId, url, res);
      return handleExportGet(runId, url, res);
    }
    if (req.method === 'GET' && (parts[0] === 'files' || parts[0] === 'view')) {
      sendFailure(res, 400, { message: 'ファイルの指定が不正です', hint: '結果の一覧のリンクから開いてください' });
      return;
    }
    sendFailure(res, 404, { message: 'ページが見つかりません', hint: 'http://127.0.0.1:<ポート>/ を開いてください' });
  };

  const server = createServer((req, res) => {
    route(req, res).catch((e: unknown) => {
      if (!res.headersSent) sendFailure(res, 500, toFailure(e));
      else res.end();
    });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 8765);
  const server = createWebServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Spec2Doc: http://127.0.0.1:${port}/ （終了は Ctrl+C）`);
  });
  const shutdown = (signal: NodeJS.Signals): void => {
    for (const dir of activeTmpDirs) rmSync(dir, { recursive: true, force: true });
    server.closeAllConnections();
    server.close();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
