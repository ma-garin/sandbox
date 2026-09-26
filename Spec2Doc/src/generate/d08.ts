// D08 解析カバレッジ・追跡レポート: 記述→ソース位置、ソース→記述、ファイル別の解析結果の件数（REQ-F-023）。
// 各文書の記述は IR 要素の id（irIds）を持つため、ここでは IR 要素 id ⇔ ソース位置の対応を出す。

import type { FileStatus, IR, IrNode, SourceRef } from '../ir/schema.ts';
import type { Block, DocId, Document, ListItem, Provenance, Section, TableRow } from '../doc/model.ts';
import {
  type GenCtx,
  STATIC_LIMIT_HEADING,
  STATIC_LIMIT_NOTE,
  displayName,
  isScopeNote,
  isStandardApiCall,
  noteProv,
  uniqueSources,
  factProv,
  hasFailedFiles, makeDocument, para, provOf, row, section, srcText, table, zeroResult } from './common.ts';

const ORIGIN: DocId = 'D08';

const STATUS_LABEL: Readonly<Record<FileStatus, string>> = {
  analyzed: '解析済み',
  failed: '失敗',
  excluded: '除外',
  unsupported: '対象外',
};
const STATUSES: readonly FileStatus[] = ['analyzed', 'failed', 'excluded', 'unsupported'];

/** 追跡対象の IR 要素の種別と表示名 */
const TRACE_KINDS: readonly { key: keyof IR; label: string }[] = [
  { key: 'modules', label: 'モジュール' },
  { key: 'functions', label: '関数' },
  { key: 'classes', label: 'クラス' },
  { key: 'exports', label: 'export' },
  { key: 'eventHandlers', label: 'イベント' },
  { key: 'screens', label: '画面' },
  { key: 'uiElements', label: '画面部品' },
  { key: 'rules', label: '業務ルール' },
  { key: 'boundaries', label: '境界値' },
  { key: 'states', label: '状態' },
  { key: 'errors', label: 'エラー' },
  { key: 'integrations', label: '連携' },
  { key: 'dataItems', label: 'データ' },
  { key: 'defaults', label: '既定値' },
  { key: 'dependencies', label: '依存' },
  { key: 'cssRules', label: 'CSS 規則' },
  { key: 'globals', label: '大域変数' },
  { key: 'unknowns', label: '確認事項' },
];

const NAME_KEYS = ['name', 'title', 'label', 'subject', 'message', 'topic', 'url', 'variable', 'selector', 'from'] as const;

function nameOf(node: IrNode): string {
  const rec = node as unknown as Record<string, unknown>;
  for (const k of NAME_KEYS) {
    const v = rec[k];
    if (typeof v === 'string' && v !== '') return v;
  }
  return node.id;
}

function traceNodes(ir: IR): { label: string; node: IrNode }[] {
  return TRACE_KINDS.flatMap(({ key, label }) => (ir[key] as IrNode[]).map((node) => ({ label, node })));
}

function fileRows(ir: IR, ctx: GenCtx): TableRow[] {
  return [...ir.files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => row([f.id, f.path, f.language, String(f.lines), STATUS_LABEL[f.status], f.reason ?? '—'], provOf(f, ctx, ORIGIN, `ファイル ${f.path}`)));
}

function countRows(ir: IR): TableRow[] {
  const perStatus = STATUSES.map((s) => {
    const hit = ir.files.filter((f) => f.status === s);
    return row([STATUS_LABEL[s], String(hit.length)], factProv(hit.flatMap((f) => f.source), hit.map((f) => f.id)));
  });
  const total = row(['合計', String(ir.files.length)], factProv(ir.files.flatMap((f) => f.source), ir.files.map((f) => f.id)));
  return [...perStatus, total];
}

function forwardRows(ir: IR, ctx: GenCtx): TableRow[] {
  return traceNodes(ir).map(({ label, node }) =>
    row([node.id, label, nameOf(node), srcText(node.source) || '位置なし'], provOf(node, ctx, ORIGIN, `${label} ${nameOf(node)}`)),
  );
}

function backwardRows(ir: IR): TableRow[] {
  const byFile = new Map<string, { ids: string[]; lines: number[] }>();
  for (const { node } of traceNodes(ir)) {
    for (const s of node.source) {
      const cur = byFile.get(s.file) ?? { ids: [], lines: [] };
      byFile.set(s.file, { ids: cur.ids.includes(node.id) ? cur.ids : [...cur.ids, node.id], lines: [...cur.lines, s.line] });
    }
  }
  return [...byFile.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, v]) => row([file, String(v.ids.length), v.ids.join(', ')], factProv(v.lines.map((line) => ({ file, line })), v.ids)));
}

// ---------- 静的解析の限界（Call Me Maybe, 2025） ----------

/** 静的解析で解決できなかった箇所 1 件 */
export interface StaticLimit {
  group: string;
  kind: string;
  /** 表示用の場所（file:line と対象） */
  where: string;
  source: SourceRef[];
  irIds: string[];
}

const G_DYNAMIC = '動的な呼び出し';
const G_UNRESOLVED = '呼び出し先の未解決';
const G_UNTRACED = '呼び出し元をたどれない関数';
const G_CONDITION = '確定できない分岐';
const GROUP_ORDER: readonly string[] = [G_DYNAMIC, G_UNRESOLVED, G_UNTRACED, G_CONDITION];
/** 解析器が dynamic-call として積む呼び出し（二重に数えないよう呼び出し先の名前からは除く） */
const DYNAMIC_NAME = /^(?:eval|(?:new\s+)?Function|import)\b/;

function at(source: readonly SourceRef[], detail: string): string {
  const s = source[0];
  return `${s ? `${s.file}:${s.line}` : '位置なし'}（${detail}）`;
}

/**
 * 静的解析で呼び出し関係を確定できなかった箇所: 動的な呼び出し（IR の unknowns・区分 dynamic-call）、
 * 自前の関数にも標準 API にも解決できない呼び出し先、呼び出し元の無い（コールバック等として値で渡された）関数、
 * 発生条件・到達を確定できない分岐（IR の unknowns）
 */
export function staticLimits(ir: IR): StaticLimit[] {
  const ids = new Set(ir.functions.map((f) => f.id));
  const own = new Set(ir.functions.map((f) => f.name));
  const one = (source: readonly SourceRef[]): SourceRef[] => source.slice(0, 1);
  const dynamic = ir.unknowns
    .filter((u) => String(u.category) === 'dynamic-call')
    .map((u) => ({ group: G_DYNAMIC, kind: u.topic, where: at(u.source, u.question.split(' の呼び出し先')[0] ?? u.topic), source: one(u.source), irIds: [u.id] }));
  const calls = ir.functions.flatMap((f) =>
    f.calls
      .filter((c) => !ids.has(c) && !DYNAMIC_NAME.test(c.trim()) && !isStandardApiCall(c, own))
      .map((c) => ({ group: G_UNRESOLVED, kind: '名前だけで呼び出し先を解決できない', where: at(f.source, `${displayName(f.name)} → ${c}`), source: one(f.source), irIds: [f.id] })),
  );
  const called = new Set(ir.functions.flatMap((f) => f.calls));
  const handled = new Set(ir.eventHandlers.map((h) => h.handler));
  const untraced = ir.functions
    .filter((f) => !called.has(f.id) && !handled.has(f.id) && !handled.has(f.name) && !f.exported && (f.name.startsWith('<anonymous') || f.refCount > 0))
    .map((f) => ({ group: G_UNTRACED, kind: 'コールバック等として値で渡された関数', where: at(f.source, displayName(f.name)), source: one(f.source), irIds: [f.id] }));
  const conds = ir.unknowns
    .filter((u) => String(u.category) === 'unreachable-or-unknown-condition')
    .map((u) => ({ group: G_CONDITION, kind: '発生条件・到達を確定できない', where: at(u.source, u.topic), source: one(u.source), irIds: [u.id] }));
  return [...dynamic, ...calls, ...untraced, ...conds];
}

/** D11・D12 の注記に使う内訳 */
export function staticLimitCounts(ir: IR): { dynamic: number; untraced: number } {
  const all = staticLimits(ir);
  return { dynamic: all.filter((l) => l.group === G_DYNAMIC).length, untraced: all.filter((l) => l.group === G_UNTRACED).length };
}

function limitRows(limits: readonly StaticLimit[]): TableRow[] {
  const keys = [...new Set(limits.map((l) => `${l.group}\u0000${l.kind}`))].sort(
    (x, y) => GROUP_ORDER.indexOf(x.split('\u0000')[0] ?? '') - GROUP_ORDER.indexOf(y.split('\u0000')[0] ?? '') || (x < y ? -1 : x > y ? 1 : 0),
  );
  return keys.map((key) => {
    const [group = '', kind = ''] = key.split('\u0000');
    const hit = limits.filter((l) => l.group === group && l.kind === kind);
    const prov = factProv(uniqueSources(hit.flatMap((l) => l.source)), [...new Set(hit.flatMap((l) => l.irIds))]);
    return row([group, kind, String(hit.length), hit.map((l) => l.where).join(', ')], prov);
  });
}

function limitSection(ir: IR): Section {
  const rows = limitRows(staticLimits(ir));
  return section(STATIC_LIMIT_HEADING, 2, [
    para(STATIC_LIMIT_NOTE, noteProv()),
    rows.length > 0
      ? table(['区分', '種類', '件数', '場所（file:line）'], rows, '種類別の件数と場所（呼び出し先の未解決は呼び出し元の関数の位置）')
      : para('該当なし（動的な呼び出し・解決できない呼び出し・呼び出し元の無い関数・確定できない分岐は検出されなかった）', noteProv()),
  ]);
}

export function buildD08(ir: IR, ctx: GenCtx): Document {
  const uncertain = hasFailedFiles(ir);
  const files = fileRows(ir, ctx);
  const fwd = forwardRows(ir, ctx);
  const back = backwardRows(ir);
  const body = [
    section('ファイル別の解析結果', 2, [
      table(['区分', '件数'], countRows(ir), '区分別の件数（合計は入力のファイル数）'),
      files.length > 0
        ? table(['ファイルID', 'パス', '言語', '行数', '区分', '理由'], files)
        : zeroResult(ctx, ORIGIN, '入力ファイル', { uncertain: false }),
    ]),
    section('記述→ソース位置', 2, [
      fwd.length > 0
        ? table(['記述ID', '種別', '名前', 'ソース位置'], fwd, '各文書の記述は記述ID（IR 要素 ID）でこの表を引く')
        : zeroResult(ctx, ORIGIN, '追跡対象の記述', { uncertain }),
    ]),
    section('ソース→記述', 2, [
      back.length > 0
        ? table(['ファイル', '記述数', '記述ID'], back)
        : zeroResult(ctx, ORIGIN, 'ソースから記述への対応', { uncertain }),
    ]),
    limitSection(ir),
  ];
  const self: Document = { id: ORIGIN, title: '', sections: body, revision: [] };
  return makeDocument(ORIGIN, ctx, [...summarySections([self], D08_ONLY_NOTE), ...body]);
}

// ---------- 確度のまとめ・自動度（D08 の冒頭） ----------

/** D08 の builder は他の文書を受け取らないため、D08 自身（IR 由来の追跡表）の件数で集計する旨の注記 */
export const D08_ONLY_NOTE =
  '集計の対象は D08 に載る IR 由来の記述（ファイル別の解析結果・記述→ソース位置・ソース→記述）。他の文書の件数は含まない';

const EXCLUDED_HEADINGS: ReadonlySet<string> = new Set(['改版履歴', '確度のまとめ', '自動度']);

interface Tally {
  total: number;
  fact: number;
  llm: number;
  analysis: number;
  unknown: number;
}

const ZERO: Tally = { total: 0, fact: 0, llm: 0, analysis: 0, unknown: 0 };

function addProv(t: Tally, p: Provenance): Tally {
  const next = { ...t, total: t.total + 1 };
  if (p.evidence === 'fact') return { ...next, fact: t.fact + 1 };
  if (p.evidence === 'unknown') return { ...next, unknown: t.unknown + 1 };
  return p.origin === 'llm' ? { ...next, llm: t.llm + 1 } : { ...next, analysis: t.analysis + 1 };
}

function flatItems(items: readonly ListItem[]): ListItem[] {
  return items.flatMap((i) => [i, ...flatItems(i.children ?? [])]);
}

function blockProvs(b: Block): Provenance[] {
  if (isScopeNote(b)) return [];
  if (b.type === 'paragraph') return [b];
  if (b.type === 'list') return flatItems(b.items);
  if (b.type === 'diagram') return [b.provenance];
  return b.rows;
}

function tallySection(s: Section): Tally {
  return s.blocks.flatMap(blockProvs).reduce(addProv, ZERO);
}

function sum(ts: readonly Tally[]): Tally {
  return ts.reduce(
    (a, t) => ({ total: a.total + t.total, fact: a.fact + t.fact, llm: a.llm + t.llm, analysis: a.analysis + t.analysis, unknown: a.unknown + t.unknown }),
    ZERO,
  );
}

function pct(n: number, total: number): string {
  return total === 0 ? '—' : `${((n / total) * 100).toFixed(1)}%`;
}

function withPct(n: number, total: number): string {
  return `${n}（${pct(n, total)}）`;
}

interface SectionTally {
  doc: DocId;
  heading: string;
  tally: Tally;
  provs: Provenance[];
}

function sectionTallies(docs: readonly Document[]): SectionTally[] {
  return docs.flatMap((d) =>
    d.sections
      .filter((s) => !EXCLUDED_HEADINGS.has(s.heading))
      .map((s) => ({ doc: d.id, heading: s.heading, tally: tallySection(s), provs: s.blocks.flatMap(blockProvs) })),
  );
}

export type AutomationLevel = '自動' | '半自動' | '対象外';

export const AUTOMATION_LABEL: Readonly<Record<AutomationLevel, string>> = {
  自動: '自動（ソースから確定）',
  半自動: '半自動（推測を含む。人の確認が要る）',
  対象外: '対象外（ソースから作れない。D09 へ）',
};

/** 節の自動度: 全行が事実→自動／全行が不明（または行なし）→対象外／それ以外→半自動 */
export function automationOf(t: Tally): AutomationLevel {
  if (t.total === 0 || t.unknown === t.total) return '対象外';
  return t.fact === t.total ? '自動' : '半自動';
}

const COUNT_PROV: Provenance = { evidence: 'inference', source: [], origin: 'analysis' };

/** 集計行の根拠: 数えた行のソース位置を持つ事実。位置が 1 つも無ければ解析による推測 */
function countProv(provs: readonly Provenance[]): Provenance {
  const source = uniqueSources(provs.flatMap((p) => p.source));
  return source.length > 0 ? factProv(source, [...new Set(provs.flatMap((p) => p.irIds ?? []))]) : COUNT_PROV;
}

function docRows(docs: readonly Document[], tallies: readonly SectionTally[]): TableRow[] {
  return docs.map((d) => {
    const mine = tallies.filter((s) => s.doc === d.id);
    const t = sum(mine.map((s) => s.tally));
    return row(
      [d.id, String(t.total), withPct(t.fact, t.total), withPct(t.llm, t.total), withPct(t.analysis, t.total), withPct(t.unknown, t.total)],
      countProv(mine.flatMap((s) => s.provs)),
    );
  });
}

function topUnknownRows(tallies: readonly SectionTally[]): TableRow[] {
  return tallies
    .filter((s) => s.tally.unknown > 0)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.tally.unknown - a.s.tally.unknown || b.s.tally.unknown / b.s.tally.total - a.s.tally.unknown / a.s.tally.total || a.i - b.i)
    .slice(0, 5)
    .map(({ s }) => row([s.doc, s.heading, String(s.tally.unknown), String(s.tally.total), pct(s.tally.unknown, s.tally.total)], countProv(s.provs)));
}

function automationRows(tallies: readonly SectionTally[]): TableRow[] {
  return tallies.map((s) =>
    row(
      [s.doc, s.heading, AUTOMATION_LABEL[automationOf(s.tally)], `事実 ${s.tally.fact} / 推測 ${s.tally.llm + s.tally.analysis} / 不明 ${s.tally.unknown}`],
      countProv(s.provs),
    ),
  );
}

/**
 * 「確度のまとめ」「自動度」の 2 節を作る（純関数）。docs に全文書を渡せば文書横断の集計になる。
 * 行 = 段落・表の行・箇条（入れ子を含む）。改版履歴とこの 2 節自身は数えない。
 */
export function summarySections(docs: readonly Document[], note?: string): Section[] {
  const tallies = sectionTallies(docs);
  const top = topUnknownRows(tallies);
  const noteBlocks: Block[] = note ? [para(note, COUNT_PROV)] : [];
  return [
    section('確度のまとめ', 2, [
      ...noteBlocks,
      table(['文書ID', '行数', '事実', '推測（LLM）', '推測（解析）', '不明'], docRows(docs, tallies), '文書ごとの行の件数（割合）'),
      top.length > 0
        ? table(['文書ID', '節', '不明の件数', '行数', '不明の割合'], top, '不明の多い節（上位 5。人が確かめる順）')
        : para('不明を含む節はない', COUNT_PROV),
    ]),
    section('自動度', 2, [
      table(['文書ID', '節', '自動度', '内訳'], automationRows(tallies), '節ごとの自動度（全行が事実→自動／推測・不明を含む→半自動／全行が不明→対象外）'),
    ]),
  ];
}
