// 解析層: ファイル → IR。REQ-F-005〜015・018・033・034・036・037。
// 言語判定 → 各解析器（js.ts・html.ts・css.ts・deps.ts）に振り分け → emptyIr にマージ → files の status を確定。
// 1 ファイルの失敗で全体を止めない（失敗は status='failed' と reason に残す）。

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { emptyIr, type EventHandler, type IR, type IrFile, type IrInput, type Language, type Unknown } from '../ir/schema.ts';
import type { IngestedFile } from '../ingest/index.ts';
import { analyzeHtml, type InlineBlock, type SourceFile } from './html.ts';
import { analyzeCss } from './css.ts';
import { analyzePackageJson, dependenciesFromScripts, mergeDependencies } from './deps.ts';

export interface AnalyzeOptions {
  input?: IrInput;
  generatedAt?: string;
}

const LANG_BY_EXT: Readonly<Record<string, Language>> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
};

export function detectLanguage(path: string): Language {
  return LANG_BY_EXT[extname(path).toLowerCase()] ?? 'other';
}

type ArrayKey = { [K in keyof IR]: IR[K] extends unknown[] ? K : never }[keyof IR];
type Failure = { path: string; reason: string };
type JsResult = Partial<IR> & { failed?: Failure[] };
type JsAnalyzer = (files: SourceFile[]) => JsResult | Promise<JsResult>;

const MERGE_KEYS: readonly Exclude<ArrayKey, 'files'>[] = [
  'modules', 'functions', 'classes', 'imports', 'exports', 'eventHandlers', 'screens', 'uiElements', 'rules',
  'boundaries', 'states', 'errors', 'integrations', 'dataItems', 'defaults', 'dependencies', 'cssRules', 'globals', 'unknowns',
];

/** Partial<IR> の配列を ir に連結した新しい IR を返す（元は変更しない）。files は path 一致で上書き合成する */
export function mergeIr(ir: IR, part: Partial<IR>): IR {
  const next: IR = { ...ir };
  for (const key of MERGE_KEYS) {
    const add = part[key];
    if (Array.isArray(add) && add.length > 0) (next as unknown as Record<string, unknown[]>)[key] = [...ir[key], ...add];
  }
  if (part.files && part.files.length > 0) {
    const byPath = new Map(part.files.map((f) => [f.path, f]));
    next.files = ir.files.map((f) => {
      const p = byPath.get(f.path);
      return p ? { ...f, ...p, id: f.id, path: f.path } : f;
    });
  }
  return next;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? '不明なエラー';

/** js.ts は別担当が並行実装中。無い間は null（JS/TS は failed として残す） */
async function loadJsAnalyzer(): Promise<JsAnalyzer | null> {
  const spec = new URL('./js.ts', import.meta.url).href;
  try {
    const mod = (await import(spec)) as { analyzeJsTs?: unknown };
    return typeof mod.analyzeJsTs === 'function' ? (mod.analyzeJsTs as JsAnalyzer) : null;
  } catch {
    return null;
  }
}

/** HTML 内の script・style の仮パス → 元の HTML パスと行のずれ */
interface Virtual {
  real: string;
  offset: number;
}

/** 仮パス（`<file>#script-<n>`）を指す位置を元の HTML の行に直した新しい値を返す */
export function remapSources<T>(value: T, virtuals: ReadonlyMap<string, Virtual>): T {
  if (Array.isArray(value)) return value.map((v) => remapSources(v, virtuals)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = remapSources(v, virtuals);
  const vt = typeof obj['file'] === 'string' ? virtuals.get(obj['file']) : undefined;
  if (!vt) return out as T;
  out['file'] = vt.real;
  for (const k of ['line', 'endLine']) if (typeof obj[k] === 'number') out[k] = (obj[k] as number) + vt.offset;
  return out as T;
}

function inlineFailure(path: string, reason: string, virtuals: ReadonlyMap<string, Virtual>): Unknown {
  const vt = virtuals.get(path);
  return {
    id: `UNK-parse-${path.replace(/[^A-Za-z0-9]+/g, '_')}`,
    source: [{ file: vt?.real ?? path, line: (vt?.offset ?? 0) + 1 }],
    evidence: 'unknown',
    topic: 'HTML 内のコードの解析失敗',
    question: `${path}: ${reason}`,
    relatedIds: [],
    category: 'parse-failure',
  };
}

type OneResult = { part: Partial<IR>; inline?: InlineBlock[] } | { failed: string };

/** 1 ファイルを解析する。成功なら部分 IR（HTML は内部の script・style も）、失敗なら理由 */
function analyzeOne(file: SourceFile, language: Language): OneResult {
  try {
    if (language === 'html') {
      const { scripts, inline, ...rest } = analyzeHtml(file);
      return { part: { ...rest, dependencies: dependenciesFromScripts(file.path, scripts) }, inline };
    }
    if (language === 'css') return { part: analyzeCss(file) };
    if (language === 'json') {
      if (basename(file.path) === 'package.json') return { part: analyzePackageJson(file) };
      JSON.parse(file.text);
      return { part: {} };
    }
    return { part: {} };
  } catch (e) {
    return { failed: `解析に失敗: ${errText(e)}` };
  }
}

async function runJs(files: SourceFile[]): Promise<{ part: Partial<IR>; failed: Failure[] }> {
  if (files.length === 0) return { part: {}, failed: [] };
  const analyzeJsTs = await loadJsAnalyzer();
  if (!analyzeJsTs) return { part: {}, failed: files.map((f) => ({ path: f.path, reason: 'JS/TS 解析器を読み込めない' })) };
  try {
    const { failed = [], ...part } = await analyzeJsTs(files);
    return { part, failed };
  } catch (e) {
    return { part: {}, failed: files.map((f) => ({ path: f.path, reason: `解析に失敗: ${errText(e)}` })) };
  }
}

// ---------- イベントハンドラの結び付け ----------

const NOT_CALLEE = new Set(['if', 'for', 'while', 'switch', 'return', 'function', 'typeof', 'new', 'catch', 'void', 'delete']);

/** HTML のイベント属性値（`doIt(1); return false` 等）に現れる関数名。メンバ呼び出し（a.b()）は除く */
export function handlerCalleeNames(expr: string): string[] {
  const text = expr.trim();
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return NOT_CALLEE.has(text) ? [] : [text];
  const names = new Set<string>();
  for (const m of text.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2] ?? '';
    if (!NOT_CALLEE.has(name)) names.add(name);
  }
  return [...names];
}

const isHtmlSource = (h: EventHandler): boolean => detectLanguage(h.source[0]?.file ?? '') === 'html';

/**
 * EventHandler を UiElement に結び付け（target が `#id` で、その id の要素が 1 つに決まるとき）、
 * HTML のイベント属性から呼ばれる関数の refCount を足した新しい IR を返す（未参照関数の誤検出を防ぐ）
 */
export function linkEventHandlers(ir: IR): IR {
  const byDom = new Map<string, string[]>();
  for (const u of ir.uiElements) if (u.domId) byDom.set(u.domId, [...(byDom.get(u.domId) ?? []), u.id]);
  const eventHandlers = ir.eventHandlers.map((h) => {
    if (h.uiElementId) return h;
    const domId = /^#([\w-]+)$/.exec(h.target.trim())?.[1];
    const ids = domId ? byDom.get(domId) : undefined;
    return ids && ids.length === 1 ? { ...h, uiElementId: ids[0] } : h;
  });
  const extra = new Map<string, number>();
  for (const h of ir.eventHandlers.filter(isHtmlSource)) {
    for (const name of handlerCalleeNames(h.handler)) extra.set(name, (extra.get(name) ?? 0) + 1);
  }
  const functions = ir.functions.map((f) => {
    const add = f.classId ? 0 : (extra.get(f.name) ?? 0);
    return add > 0 ? { ...f, refCount: f.refCount + add } : f;
  });
  return { ...ir, eventHandlers, functions };
}

export async function analyze(files: IngestedFile[], root: string, opts: AnalyzeOptions = {}): Promise<IR> {
  let ir = emptyIr(opts.input ?? { kind: 'folder', label: root }, opts.generatedAt);
  const loaded = await Promise.all(
    files.map(async (f) => {
      try {
        return { f, text: await readFile(f.abs, 'utf8'), readError: undefined };
      } catch (e) {
        return { f, text: '', readError: `読み込みに失敗: ${errText(e)}` };
      }
    }),
  );

  const failures = new Map<string, string>();
  const jsFiles: SourceFile[] = [];
  const virtuals = new Map<string, Virtual>();
  const inlineUnknowns: Unknown[] = [];
  const addInline = (src: SourceFile, blocks: InlineBlock[]): void => {
    const count = { script: 0, style: 0 };
    for (const b of blocks) {
      count[b.kind] += 1;
      // JS 解析器は拡張子で対象を選ぶため、script の仮パスには `.js` を付ける（位置は remapSources で元に戻る）
      const vpath = `${src.path}#${b.kind}-${count[b.kind]}${b.kind === 'script' ? '.js' : ''}`;
      virtuals.set(vpath, { real: src.path, offset: b.line - 1 });
      const vfile: SourceFile = { path: vpath, abs: src.abs, text: b.text };
      if (b.kind === 'script') {
        jsFiles.push(vfile);
        continue;
      }
      try {
        ir = mergeIr(ir, remapSources(analyzeCss(vfile), virtuals));
      } catch (e) {
        inlineUnknowns.push(inlineFailure(vpath, `解析に失敗: ${errText(e)}`, virtuals));
      }
    }
  };
  const irFiles: IrFile[] = loaded.map(({ f, text, readError }, i) => {
    const language = detectLanguage(f.path);
    const src: SourceFile = { path: f.path, abs: f.abs, text };
    if (readError) failures.set(f.path, readError);
    else if (language === 'javascript' || language === 'typescript') jsFiles.push(src);
    else if (language !== 'other') {
      const r = analyzeOne(src, language);
      if ('failed' in r) failures.set(f.path, r.failed);
      else {
        ir = mergeIr(ir, r.part);
        addInline(src, r.inline ?? []);
      }
    }
    return {
      id: `F${String(i + 1).padStart(3, '0')}`,
      source: [{ file: f.path, line: 1 }],
      evidence: 'fact',
      path: f.path,
      language,
      status: language === 'other' ? 'unsupported' : 'analyzed',
      lines: text === '' ? 0 : text.split('\n').length,
      ...(language === 'other' ? { reason: '対象外（未対応言語）' } : {}),
    };
  });

  const js = await runJs(jsFiles);
  const reported = new Set((js.part.unknowns ?? []).filter((u) => u.category === 'parse-failure').flatMap((u) => u.source.map((s) => s.file)));
  for (const f of js.failed) {
    if (virtuals.has(f.path)) {
      if (!reported.has(f.path)) inlineUnknowns.push(inlineFailure(f.path, f.reason, virtuals));
    }
    else failures.set(f.path, f.reason);
  }
  ir = mergeIr({ ...ir, files: irFiles }, { ...remapSources(js.part, virtuals), unknowns: [...(remapSources(js.part.unknowns, virtuals) ?? []), ...inlineUnknowns] });
  ir = linkEventHandlers(ir);
  return {
    ...ir,
    dependencies: mergeDependencies(ir.dependencies),
    files: ir.files.map((f) => {
      const reason = failures.get(f.path);
      return reason ? { ...f, status: 'failed' as const, reason } : f;
    }),
  };
}
