// 生成層: IR → 文書モデル D01〜D09・D11・D12。入力は IR だけ（REQ-F-019）。
// 文書ごとの生成器は dXX.ts の `buildDXX(ir, ctx)`。D09 番号を選択に依存させないため、選択に関係なく
// 全文書を決まった順に作り、D09 を最後に作り、D08 に文書横断の対応表（REQ-F-023）を足してから、
// 選ばれた文書だけを返す（REQ-F-020）。生成器が無い文書は「未実装」の 1 節を返す。

import { createHash } from 'node:crypto';
import { summarySections } from './d08.ts';
import type { IR } from '../ir/schema.ts';
import { ALL_DOC_IDS, type Block, type DocId, type Document, type ListItem, type Provenance, type Section, type TableRow } from '../doc/model.ts';
import { disabledLlm, LLM_DISABLED_TEXT, type LlmClient } from '../llm/index.ts';
import { D09Registry, type DocBuilder, type GenCtx, displayName, normalizeLevels, factProv, para, unknownProv, LLM_ALL_GENERATED_TEXT, LLM_D09_KEY, notImplementedDoc, reserveLlmD09, row, section, srcText, table, zeroResult } from './common.ts';

export type { GenCtx, DocBuilder } from './common.ts';
export { D09Registry } from './common.ts';

export interface GenerateOptions {
  llm?: LlmClient; // 省略時は disabledLlm
  /** 入力元の表示（全文書の改版履歴に入れる。絶対パスを含めない） */
  source?: string;
}

function isModuleNotFound(err: unknown, file: string): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as Error & { code?: string }).code;
  return code === 'ERR_MODULE_NOT_FOUND' && err.message.includes(file);
}

async function loadBuilder(id: DocId): Promise<DocBuilder | undefined> {
  const file = `${id.toLowerCase()}.ts`;
  try {
    const mod: Record<string, unknown> = await import(`./${file}`);
    const fn = mod[`build${id}`];
    return typeof fn === 'function' ? (fn as DocBuilder) : undefined;
  } catch (err) {
    if (isModuleNotFound(err, file)) return undefined;
    throw err;
  }
}

async function buildOne(id: DocId, ir: IR, ctx: GenCtx): Promise<Document> {
  const builder = await loadBuilder(id);
  return builder ? await builder(ir, ctx) : notImplementedDoc(id, ctx);
}

// ---------- 文書横断の対応表（D08 に足す。REQ-F-023） ----------

interface Trace {
  doc: DocId;
  heading: string;
  summary: string;
  prov: Provenance;
}

function summarize(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

function blockTraces(doc: DocId, heading: string, b: Block): Trace[] {
  const fromItems = (items: ListItem[]): Trace[] =>
    items.flatMap((i) => [{ doc, heading, summary: summarize(i.text), prov: i }, ...fromItems(i.children ?? [])]);
  if (b.type === 'paragraph') return [{ doc, heading, summary: summarize(b.text), prov: b }];
  if (b.type === 'list') return fromItems(b.items);
  if (b.type === 'diagram') return [{ doc, heading, summary: summarize(b.title), prov: b.provenance }];
  return b.rows.map((r: TableRow) => ({ doc, heading, summary: summarize(r.cells.slice(0, 3).join(' / ')), prov: r }));
}

function collectTraces(docs: Document[]): Trace[] {
  return docs
    .filter((d) => d.id !== 'D08')
    .flatMap((d) => d.sections.flatMap((s) => s.blocks.flatMap((b) => blockTraces(d.id, s.heading, b))))
    .filter((t) => t.prov.source.length > 0);
}

function crossRefSections(ir: IR, docs: Document[], ctx: GenCtx): Section[] {
  const traces = collectTraces(docs);
  const uncertain = ir.files.some((f) => f.status === 'failed');
  const fwd = traces.map((t) => row([t.doc, t.heading, t.summary, srcText(t.prov.source)], factProv(t.prov.source, t.prov.irIds ?? [])));
  const byFile = new Map<string, { lines: Set<number>; places: Set<string>; ids: Set<string> }>();
  for (const t of traces) {
    for (const s of t.prov.source) {
      const v = byFile.get(s.file) ?? { lines: new Set<number>(), places: new Set<string>(), ids: new Set<string>() };
      v.lines.add(s.line);
      v.places.add(`${t.doc} ${t.heading}`);
      for (const id of t.prov.irIds ?? []) v.ids.add(id);
      byFile.set(s.file, v);
    }
  }
  const back = [...byFile.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, v]) =>
      row(
        [file, String(v.places.size), [...v.places].join('、')],
        factProv([...v.lines].sort((a, b) => a - b).map((line) => ({ file, line })), [...v.ids]),
      ),
    );
  return [
    section('文書横断の対応表（記述→ソース位置）', 2, [
      fwd.length > 0
        ? table(['文書ID', '節', '行の要約', 'ソース位置'], fwd)
        : zeroResult(ctx, 'D08', '文書の記述とソース位置の対応', { uncertain }),
    ]),
    section('文書横断の対応表（ソース→文書・節）', 2, [
      back.length > 0
        ? table(['ソースファイル', '節の数', '文書ID・節'], back)
        : zeroResult(ctx, 'D08', 'ソースから文書への対応', { uncertain }),
    ]),
  ];
}

/** 改版履歴（末尾の節）の直前に節を差し込んだ新しい文書を返す */
function withSections(doc: Document, extra: Section[]): Document {
  const last = doc.sections.at(-1);
  const hasRevision = last?.heading === '改版履歴';
  const body = hasRevision ? doc.sections.slice(0, -1) : doc.sections;
  return { ...doc, sections: [...body, ...extra, ...(hasRevision && last ? [last] : [])] };
}

/** 同じ見出しの節を差し替えた新しい文書を返す（段は元の節のまま） */
function withSummary(doc: Document, fresh: Section[]): Document {
  const byHeading = new Map(fresh.map((s) => [s.heading, s]));
  return {
    ...doc,
    sections: doc.sections.map((s) => {
      const f = byHeading.get(s.heading);
      return f ? polishSection({ ...f, level: s.level }) : s;
    }),
  };
}

// ---------- 仕上げ（全文書共通の表示の整理） ----------

function polishItems(items: ListItem[]): ListItem[] {
  return items.map((i) => ({ ...i, text: displayName(i.text), ...(i.children ? { children: polishItems(i.children) } : {}) }));
}

/** 節の中で同じ段落・同じ表の注記（caption）が 2 回以上出たら 1 回にし、無名関数の表示名を整える */
function polishSection(s: Section): Section {
  const paras = new Set<string>();
  const captions = new Set<string>();
  const blocks = s.blocks.flatMap((b): Block[] => {
    if (b.type === 'paragraph') {
      const text = displayName(b.text);
      if (paras.has(text)) return [];
      paras.add(text);
      return [{ ...b, text }];
    }
    if (b.type === 'list') return [{ ...b, items: polishItems(b.items) }];
    if (b.type === 'diagram') return [{ ...b, title: displayName(b.title), nodes: b.nodes.map((n) => ({ ...n, label: displayName(n.label) })) }];
    const caption = b.caption === undefined ? undefined : displayName(b.caption);
    const keepCaption = caption !== undefined && !captions.has(caption);
    if (caption !== undefined) captions.add(caption);
    return [
      {
        type: 'table',
        columns: b.columns.map(displayName),
        rows: b.rows.map((r) => ({ ...r, cells: r.cells.map(displayName) })),
        ...(keepCaption ? { caption } : {}),
      },
    ];
  });
  return { ...s, heading: displayName(s.heading), blocks };
}

export function polishDocument(doc: Document): Document {
  return { ...doc, title: displayName(doc.title), sections: normalizeLevels(doc.sections.map(polishSection)) };
}

function containsText(doc: Document, needle: string): boolean {
  const inItems = (items: ListItem[]): boolean => items.some((i) => i.text.includes(needle) || inItems(i.children ?? []));
  return doc.sections.some((s) =>
    s.blocks.some((b) =>
      b.type === 'paragraph' ? b.text.includes(needle) : b.type === 'list' ? inItems(b.items) : b.type === 'diagram' ? b.nodes.some((n) => n.label.includes(needle)) : b.rows.some((r) => r.cells.some((c) => c.includes(needle))),
    ),
  );
}

/** 説明文の欄に「LLM 無効のため未生成」がある文書は、冒頭に 1 回だけその旨と D09 番号を書く */
function withLlmNote(doc: Document, ctx: GenCtx): Document {
  if (!containsText(doc, LLM_DISABLED_TEXT)) return doc;
  const no = ctx.d09.register({ key: LLM_D09_KEY, topic: '', question: '', origin: doc.id });
  const note = para(`説明文の欄は LLM 無効のため未生成（業務上の意味は ${no} で確認）`, unknownProv(no));
  const [first, ...rest] = doc.sections;
  if (!first) return doc;
  return { ...doc, sections: [{ ...first, blocks: [note, ...first.blocks] }, ...rest] };
}

export async function generate(ir: IR, docIds: DocId[], opts: GenerateOptions = {}): Promise<Document[]> {
  const ctx: GenCtx = {
    llm: opts.llm ?? disabledLlm,
    d09: new D09Registry(),
    generatedAt: ir.generatedAt,
    ...(ir.input.commit ? { commit: ir.input.commit } : {}),
    ...(opts.source ? { inputSource: opts.source } : {}),
  };
  // IR の不明事項を先に採番し、以降は全文書を決まった順に作る（D09 番号が選択に依存しない。REQ-F-032）
  for (const u of ir.unknowns) ctx.d09.registerUnknown(u);
  // 選ばれていない文書は LLM 無効で作るため「説明文未生成」の事項は必ず生じうる。
  // LLM の有効・無効で D09 番号がずれないよう、登録順をここで固定する
  const llmNo = reserveLlmD09(ctx);
  const unique = [...new Set(docIds)];
  const built = new Map<DocId, Document>();
  // LLM は選ばれた文書にだけ使う。選ばれていない文書（D09 採番・D08 対応表の材料）は disabledLlm で作る
  const ctxFor = (id: DocId): GenCtx => (unique.includes(id) ? ctx : { ...ctx, llm: disabledLlm });
  for (const id of ALL_DOC_IDS.filter((d) => d !== 'D09')) built.set(id, withLlmNote(polishDocument(await buildOne(id, ir, ctxFor(id))), ctx));
  const d08 = built.get('D08');
  if (d08) {
    const others = [...built.values()].filter((d) => d.id !== 'D08');
    built.set('D08', polishDocument(withSections(d08, crossRefSections(ir, others, ctx))));
  }
  // 選ばれた全文書で LLM が説明文を生成できたら、番号は残して「該当なし」にする
  const llmUsers = ctx.d09.usedBy(LLM_D09_KEY);
  if (ctx.llm.enabled && !unique.some((id) => llmUsers.includes(id))) {
    ctx.d09.replace(llmNo, { question: LLM_ALL_GENERATED_TEXT, relatedIds: [], source: [], resolved: true });
  }
  built.set('D09', polishDocument(await buildOne('D09', ir, ctxFor('D09'))));
  // D08 冒頭の「確度のまとめ」「自動度」を、D08 以外の選ばれた文書の横断集計に差し替える（D08 だけが選ばれたときは D08 自身の集計のまま）
  const d08Final = built.get('D08');
  const selectedOthers = unique.filter((id) => id !== 'D08').flatMap((id) => built.get(id) ?? []);
  if (d08Final && selectedOthers.length > 0) built.set('D08', withSummary(d08Final, summarySections(selectedOthers)));
  return unique.map((id) => built.get(id)).filter((d): d is Document => d !== undefined);
}

// ---------- 前回の実行との差分（REQ-F-035 改版履歴「前回の生成から変わった節」） ----------

/** moved = 内容は同じでソース位置（file:line・行番号の範囲・Provenance.source）だけが違う */
export type ChangeKind = 'added' | 'removed' | 'changed' | 'moved';

export interface SectionChange {
  section: string;
  kind: ChangeKind;
}

/** 節の要約値。content はソース位置を除いた内容、full は位置を含む全体 */
export interface SectionDigest {
  content: string;
  full: string;
}

/** 比べた前回の実行と、節の変化。version は今回の版（前回の同じ文書の版 +1） */
export interface RunDiff {
  runId: string;
  startedAt: string;
  version: number;
  changes: SectionChange[];
}

const REVISION_HEADING = '改版履歴';
const KIND_LABELS: Readonly<Record<ChangeKind, string>> = { added: '追加', removed: '削除', changed: '変更', moved: '位置のみ変更' };
const SUMMARY_NAMES_MAX = 5;

/**
 * ソース位置を伏せる: 「app.js:12」「app.js:12-15」、ID の行番号「-L24」、本文の「55 行」「55 行目」。
 * 「行数」の列（ファイルの行数・記述の行数）は位置のずれで変わるため、内容の比較では空にする（maskLineCounts）
 */
export function stripPositions(text: string): string {
  return text
    .replace(/(\.[A-Za-z0-9]+):\d+(?:-\d+)?/g, '$1:#')
    .replace(/-L\d+\b/g, '-L#')
    .replace(/\d+ ?行(目)?(?!数)/g, '# 行$1');
}

/** D08 横断表の「行の要約」は他文書の行（行数の列を含む）の写しなので、数字だけ伏せる。変化は元の文書の節で出る */
export function maskLineCounts(b: Block): Block {
  if (b.type !== 'table') return b;
  const mask = (c: string, i: number): string => (b.columns[i] === '行数' ? '#' : b.columns[i] === '行の要約' ? c.replace(/\d+/g, '#') : c);
  if (!b.columns.some((c) => c === '行数' || c === '行の要約')) return b;
  return { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map(mask) })) };
}

const digest = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

/**
 * 文書の節ごとの要約値（見出し → 内容・全体のハッシュ）。改版履歴の節は含めない。
 * 見出しの行番号は伏せ、同じ見出しが 2 回以上あれば 2 回目から「見出し（n）」にする。volatile の文字列（生成日時など）は除いて計算する
 */
export function sectionDigests(doc: Document, volatile: readonly string[] = []): Record<string, SectionDigest> {
  const seen = new Map<string, number>();
  const clean = (text: string): string => volatile.reduce((acc, v) => (v === '' ? acc : acc.split(v).join('')), text);
  const entries = doc.sections
    .filter((s) => s.heading !== REVISION_HEADING)
    .map((s): [string, SectionDigest] => {
      const heading = stripPositions(s.heading);
      const n = (seen.get(heading) ?? 0) + 1;
      seen.set(heading, n);
      const key = n === 1 ? heading : `${heading}（${n}）`;
      const full = clean(JSON.stringify({ heading: s.heading, level: s.level, blocks: s.blocks }));
      const content = stripPositions(clean(JSON.stringify({ level: s.level, blocks: s.blocks.map(maskLineCounts) }, (k, v: unknown) => (k === 'source' ? undefined : v))));
      return [key, { content: digest(content), full: digest(full) }];
    });
  return Object.fromEntries(entries);
}

/** 節の比較。並びは今回の節の順（追加・変更・位置のみ変更）→ 前回だけにあった節（削除） */
export function diffSections(
  before: Readonly<Record<string, SectionDigest>>,
  after: Readonly<Record<string, SectionDigest>>,
): SectionChange[] {
  const current = Object.entries(after).flatMap(([section, d]): SectionChange[] => {
    const b = Object.hasOwn(before, section) ? before[section] : undefined;
    if (!b) return [{ section, kind: 'added' }];
    if (b.content !== d.content) return [{ section, kind: 'changed' }];
    return b.full === d.full ? [] : [{ section, kind: 'moved' }];
  });
  const removed = Object.keys(before)
    .filter((k) => !Object.hasOwn(after, k))
    .map((section): SectionChange => ({ section, kind: 'removed' }));
  return [...current, ...removed];
}

/** 内容の変更（追加・削除・変更）だけ。位置のみ変更は含めない */
export function contentChanges(changes: readonly SectionChange[]): SectionChange[] {
  return changes.filter((c) => c.kind !== 'moved');
}

/** 改版履歴の「変更箇所」欄の文言。前回が無ければ「初回生成」 */
export function diffSummary(diff: RunDiff | undefined): string {
  if (!diff) return '初回生成';
  const content = contentChanges(diff.changes);
  const moved = diff.changes.length - content.length;
  if (diff.changes.length === 0) return '前回から変更なし';
  const names = content.slice(0, SUMMARY_NAMES_MAX).map((c) => c.section).join('、');
  const more = content.length > SUMMARY_NAMES_MAX ? '…' : '';
  return `変更 ${content.length} 節${content.length > 0 ? `（${names}${more}）` : ''}／位置のみ変更 ${moved} 節`;
}

export function changeLabel(c: SectionChange): string {
  return `${c.section}（${KIND_LABELS[c.kind]}）`;
}

function revisionWithDiff(s: Section, diff: RunDiff | undefined): Section {
  const summary = diffSummary(diff);
  const version = String(diff?.version ?? 1);
  const blocks = s.blocks.map((b): Block => {
    if (b.type !== 'table' || b.columns.at(-1) !== '変更箇所') return b;
    const last = b.rows.length - 1;
    const vCol = b.columns.indexOf('版');
    const fill = (cells: string[]): string[] => cells.map((c, j) => (j === cells.length - 1 ? summary : j === vCol ? version : c));
    return { ...b, rows: b.rows.map((r, i) => (i === last ? { ...r, cells: fill(r.cells) } : r)) };
  });
  if (!diff) return { ...s, blocks };
  const prev = table(['比較した前回の実行 ID', '前回の生成日時', '変わった節の数'], [row([diff.runId, diff.startedAt, String(contentChanges(diff.changes).length)], factProv([]))]);
  const changes =
    diff.changes.length > 0
      ? [table(['前回から変わった節', '変化'], diff.changes.map((c) => row([c.section, KIND_LABELS[c.kind]], factProv([]))))]
      : [para('前回から変更なし', factProv([]))];
  return { ...s, blocks: [...blocks, prev, ...changes] };
}

/** 前回との差分を改版履歴（本文の節と doc.revision の最新行）に書いた新しい文書を返す。diff が無ければ初回生成 */
export function applyRunDiff(doc: Document, diff: RunDiff | undefined): Document {
  const last = doc.revision.length - 1;
  const changed = (diff?.changes ?? []).map(changeLabel);
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.heading === REVISION_HEADING ? revisionWithDiff(s, diff) : s)),
    revision: doc.revision.map((r, i) => (i === last ? { ...r, changedSections: changed } : r)),
  };
}
