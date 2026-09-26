// 中核: 取得 → 解析 → 生成 → 出力 → 実行記録（REQ-F-030）。CLI と Web 画面は同じこの関数を呼ぶ（REQ-F-027）。

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ingest, type IngestInput, type IngestResult } from './ingest/index.ts';
import { analyze } from './analyze/index.ts';
import { applyRunDiff, diffSections, generate, sectionDigests, type RunDiff, type SectionChange, type SectionDigest } from './generate/index.ts';
import { render, type Format } from './render/index.ts';
import { disabledLlm, type LlmClient, type LlmUsage } from './llm/index.ts';
import { ALL_DOC_IDS, type DocId } from './doc/model.ts';
import type { IR, IrInput } from './ir/schema.ts';
import { buildTrace } from './trace/graph.ts';
import { carryOverReview, emptyReview, validateReview } from './trace/review.ts';
import { TRACE_VERSION, type TraceGraph, type TraceReview } from './trace/schema.ts';
import { renderTraceHtml } from './render/trace-html.ts';
import { readSourceFiles, verifyDocuments, type VerifyCounts } from './verify/index.ts';

/** 出力形式。'trace' はトレーサビリティの画面（traceability.html）。trace.json と trace-review.json は形式によらず毎回書く */
export type OutputFormat = Format | 'trace';

export interface RunOptions {
  input: IngestInput;
  /** 出力の親フォルダ。既定は `out`。実体は `<outDir>/<runId>/` */
  outDir?: string;
  docIds?: DocId[]; // 既定は全文書
  formats?: OutputFormat[]; // 既定は ['md']
  exclude?: string[];
  llm?: LlmClient; // 既定は disabledLlm
  runId?: string;
}

export type Stage = 'ingest' | 'analyze' | 'generate' | 'render' | 'done';

export interface Progress {
  stage: Stage;
  message: string;
  /** 0〜1 */
  ratio: number;
}

export interface RunLog {
  runId: string;
  input: IrInput;
  settings: { docIds: DocId[]; formats: OutputFormat[]; exclude: string[]; llmEnabled: boolean };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stageMs: Partial<Record<Stage, number>>;
  fileCounts: { total: number; analyzed: number; failed: number; excluded: number; unsupported: number };
  llm: LlmUsage;
  outputs: string[];
  /** 前回との比較に使う入力元のキー（フォルダ名・GitHub owner/repo@ref・zip 名）。絶対パス・トークンは含めない（REQ-F-035） */
  sourceKey: string;
  /** 文書ごとの節の要約値（節の見出し → 内容・全体のハッシュ）。改版履歴の節は含めない */
  sectionDigests: Partial<Record<DocId, Record<string, SectionDigest>>>;
  /** 文書ごとの版（前回の同じ文書の版 +1。前回に無ければ 1） */
  docVersions: Partial<Record<DocId, number>>;
  /** 比べた前回の実行（同じ入力元キーの直前の実行）。無ければ初回 */
  previous?: { runId: string; startedAt: string };
  /** 前回と比べた節の変化（位置のみ変更を含む）。前回にその文書が無ければ載せない（初回生成） */
  docChanges: Partial<Record<DocId, SectionChange[]>>;
  /** トレーサビリティの点・線・行の数 */
  trace: { nodes: number; edges: number; links: number; skippedLinks: number };
  /** 検証の工程（生成後・出力前の照合）の件数 */
  verify?: VerifyCounts;
}

export interface RunResult {
  runId: string;
  outPath: string;
  ir: IR;
  log: RunLog;
  /** 解析に失敗したファイルがある（CLI の終了コード 1） */
  hasFailures: boolean;
}

/** 入力の表示用ラベル。トークンは含めない（REQ-F-018・030） */
/** 末尾のフォルダ名・ファイル名（区切りは / と \\ のどちらでも） */
function lastSegment(path: string): string {
  const parts = path.split(/[\\/]+/).filter((x) => x !== '');
  return parts.at(-1) ?? path;
}

/** 文書に載せる入力元の表示。絶対パスは出さず末尾の名前だけ。GitHub は owner/repo@ref */
export function describeSource(input: IngestInput): string {
  switch (input.kind) {
    case 'github': {
      const m = /github\.com[/:]([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#].*)?$/.exec(input.url);
      const repo = m ? `${m[1]}/${m[2]}` : lastSegment(input.url.replace(/^[a-z]+:\/\/[^@/]*@/i, ''));
      return `GitHub: ${repo}${input.ref ? `@${input.ref}` : ''}`;
    }
    case 'folder':
      return `フォルダ: ${lastSegment(input.path)}`;
    case 'zip':
      return `zip: ${lastSegment(input.path)}`;
    case 'files':
      return input.paths.length === 1 ? `ファイル: ${lastSegment(input.paths[0] ?? '')}` : `ファイル: ${input.paths.length} 件`;
  }
}

export function describeInput(input: IngestInput, commit?: string): IrInput {
  const label =
    input.kind === 'github'
      ? `${input.url}${input.ref ? `@${input.ref}` : ''}`
      : input.kind === 'files'
        ? input.paths.join(', ')
        : input.path;
  return { kind: input.kind, label, ...(commit ? { commit } : {}) };
}

/** 前回の実行を探すための入力元キー。files は名前の一覧（並べ替え済み） */
export function sourceKey(input: IngestInput): string {
  if (input.kind === 'files') return `ファイル: ${input.paths.map(lastSegment).sort().join(', ')}`;
  return describeSource(input);
}

async function readRunLog(path: string): Promise<Partial<RunLog> | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Partial<RunLog>;
  } catch {
    return undefined; // 実行記録が無い・壊れているフォルダは比較の対象にしない
  }
}

/** outRoot 配下から、同じ入力元キーで今回より前に始まった直前の実行記録を探す */
export async function findPreviousRun(outRoot: string, key: string, currentRunId: string, startedAt: string): Promise<RunLog | undefined> {
  let names: string[];
  try {
    names = await readdir(outRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
  let best: RunLog | undefined;
  for (const name of names.filter((n) => n !== currentRunId)) {
    const log = await readRunLog(join(outRoot, name, 'run-log.json'));
    if (!log || log.sourceKey !== key || !log.sectionDigests || !log.docVersions || typeof log.startedAt !== 'string' || typeof log.runId !== 'string') continue;
    if (log.startedAt > startedAt) continue;
    if (!best || log.startedAt > best.startedAt) best = log as RunLog;
  }
  return best;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return undefined; // 無い・壊れているときは引き継がない
  }
}

/** 前回の実行の trace.json と trace-review.json から確認状態を引き継ぐ。どちらかが無い・不正なら空 */
export async function carryOverFromRun(prevPath: string | undefined, graph: TraceGraph): Promise<TraceReview> {
  if (!prevPath) return emptyReview(graph.runId);
  const prevGraph = (await readJson(join(prevPath, 'trace.json'))) as TraceGraph | undefined;
  if (!prevGraph || prevGraph.version !== TRACE_VERSION || !Array.isArray(prevGraph.links)) return emptyReview(graph.runId);
  const rawReview = await readJson(join(prevPath, 'trace-review.json'));
  if (rawReview === undefined) return emptyReview(graph.runId);
  try {
    return carryOverReview(prevGraph, validateReview(rawReview, prevGraph), graph);
  } catch {
    return emptyReview(graph.runId); // 前回の確認状態が不正なら引き継がない
  }
}

function newRunId(now: Date): string {
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return `${ts}-${randomBytes(3).toString('hex')}`;
}

export async function run(options: RunOptions, onProgress: (p: Progress) => void = () => {}): Promise<RunResult> {
  const started = new Date();
  const docIds = options.docIds ?? [...ALL_DOC_IDS];
  const formats = options.formats ?? ['md'];
  const exclude = options.exclude ?? [];
  const llm = options.llm ?? disabledLlm;
  const runId = options.runId ?? newRunId(started);
  const outRoot = resolve(options.outDir ?? 'out');
  const outPath = join(outRoot, runId);
  const stageMs: Partial<Record<Stage, number>> = {};
  const timed = async <T>(stage: Stage, ratio: number, message: string, fn: () => Promise<T>): Promise<T> => {
    onProgress({ stage, message, ratio });
    const t0 = performance.now();
    const result = await fn();
    stageMs[stage] = Math.round(performance.now() - t0);
    return result;
  };

  const ingested: IngestResult = await timed('ingest', 0, '入力を取得しています', () => ingest(options.input, { exclude }));
  try {
    const irInput = describeInput(options.input, ingested.commit);
    const analyzed = await timed('analyze', 0.25, 'ソースを解析しています', () =>
      analyze(ingested.files, ingested.root, { input: irInput, generatedAt: started.toISOString() }),
    );
    const ir: IR = {
      ...analyzed,
      files: [
        ...analyzed.files,
        ...ingested.excluded.map((e, i) => ({
          id: `FX${String(i + 1).padStart(3, '0')}`,
          source: [],
          path: e.path,
          language: 'other' as const,
          status: 'excluded' as const,
          lines: 0,
          reason: e.reason,
        })),
      ],
    };
    const rawDocs = await timed('generate', 0.5, '文書を生成しています', () => generate(ir, docIds, { llm, source: describeSource(options.input) }));
    // 検証の工程: 全文書の根拠位置を元のソースと照合し、不一致の行を不明に下げて D09・D08 に載せる（生成後・出力前）
    const verified = verifyDocuments(rawDocs, ir, await readSourceFiles(ingested.files, rawDocs));
    const generated = verified.docs;
    // 前回の実行との差分（REQ-F-035）。利用者が実行したときに、同じ入力元の直前の実行と比べるだけ
    const key = sourceKey(options.input);
    const hashes: Partial<Record<DocId, Record<string, SectionDigest>>> = Object.fromEntries(
      generated.map((d) => [d.id, sectionDigests(d, [started.toISOString()])]),
    );
    const prev = await findPreviousRun(outRoot, key, runId, started.toISOString());
    const diffOf = (id: DocId): RunDiff | undefined => {
      const before = prev?.sectionDigests[id];
      const after = hashes[id];
      if (!prev || !before || !after) return undefined;
      return { runId: prev.runId, startedAt: prev.startedAt, version: (prev.docVersions[id] ?? 0) + 1, changes: diffSections(before, after) };
    };
    const diffs = generated.map((d) => [d.id, diffOf(d.id)] as const);
    const docChanges: Partial<Record<DocId, SectionChange[]>> = Object.fromEntries(
      diffs.flatMap(([id, d]) => (d ? [[id, d.changes]] : [])),
    );
    const docs = generated.map((d, i) => applyRunDiff(d, diffs[i]?.[1]));

    const { graph, skippedLinks } = buildTrace(ir, docs, { runId, source: describeSource(options.input), generatedAt: started.toISOString() });
    const review = await carryOverFromRun(prev ? join(outRoot, prev.runId) : undefined, graph);

    await mkdir(outPath, { recursive: true });
    const outputs = await timed('render', 0.75, '文書を書き出しています', async () => {
      const written: string[] = [];
      const docFormats = formats.filter((f): f is Format => f !== 'trace');
      for (const doc of docs) {
        for (const format of docFormats) {
          const name = `${doc.id}.${format}`;
          await writeFile(join(outPath, name), await render(doc, format));
          written.push(name);
        }
      }
      await writeFile(join(outPath, 'ir.json'), JSON.stringify(ir, null, 2));
      await writeFile(join(outPath, 'trace.json'), JSON.stringify(graph));
      await writeFile(join(outPath, 'trace-review.json'), JSON.stringify(review, null, 2));
      const traceFiles = ['trace.json', 'trace-review.json'];
      if (formats.includes('trace')) {
        await writeFile(join(outPath, 'traceability.html'), renderTraceHtml(graph, review));
        traceFiles.push('traceability.html');
      }
      return [...written, 'ir.json', ...traceFiles];
    });

    const count = (s: string): number => ir.files.filter((f) => f.status === s).length;
    const finished = new Date();
    const log: RunLog = {
      runId,
      input: irInput,
      settings: { docIds, formats, exclude, llmEnabled: llm.enabled },
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
      stageMs,
      fileCounts: {
        total: ir.files.length,
        analyzed: count('analyzed'),
        failed: count('failed'),
        excluded: count('excluded'),
        unsupported: count('unsupported'),
      },
      llm: llm.usage(),
      outputs: [...outputs, 'run-log.json'],
      sourceKey: key,
      sectionDigests: hashes,
      docVersions: Object.fromEntries(diffs.map(([id, d]) => [id, d?.version ?? 1])),
      ...(prev ? { previous: { runId: prev.runId, startedAt: prev.startedAt } } : {}),
      docChanges,
      trace: { nodes: graph.nodes.length, edges: graph.edges.length, links: graph.links.length, skippedLinks },
      verify: verified.counts,
    };
    await writeFile(join(outPath, 'run-log.json'), JSON.stringify(log, null, 2));
    onProgress({ stage: 'done', message: '完了しました', ratio: 1 });
    return { runId, outPath, ir, log, hasFailures: log.fileCounts.failed > 0 };
  } finally {
    await ingested.cleanup();
  }
}
