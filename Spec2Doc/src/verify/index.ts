// 検証の工程の入口: 照合 → D09 へ不一致を登録（生成済みの D09 文書に行を追記）→ D08 に「照合の結果」を足す。
// generate の後・出力の前に core から呼ぶ。入力ファイルの本文は呼び出し側が渡す（書き換えない）。

import { readFile } from 'node:fs/promises';
import type { Block, Document, Section, TableBlock, TableRow } from '../doc/model.ts';
import type { IR, SourceRef } from '../ir/schema.ts';
import { D09Registry, factProv, para, row, section, srcText, table } from '../generate/common.ts';
import { checkDocuments, type VerifyCounts, type VerifyMismatch } from './check.ts';

export { aliasesOf, checkDocuments, irNameIndex, makeContext, textIdentifiers, verifyRow, VERIFY_WINDOW } from './check.ts';
export type { VerifyCounts, VerifyMismatch, MismatchKind } from './check.ts';

export const VERIFY_HEADING = '照合の結果';
const D09_COLUMNS = ['No.', '分類', '事項', '確認したいこと', '参照元の文書', '関連ID', '根拠位置'];

export interface VerifyResult {
  docs: Document[];
  counts: VerifyCounts;
  mismatches: (VerifyMismatch & { d09Ref: string })[];
}

/** 文書の根拠位置が指すファイルのうち、入力にあるものの本文を読む（読み取りのみ） */
export async function readSourceFiles(
  files: readonly { path: string; abs: string }[],
  docs: readonly Document[],
): Promise<Map<string, string>> {
  const wanted = new Set<string>();
  const collect = (source: readonly SourceRef[]): void => source.forEach((s) => wanted.add(s.file));
  const walkItems = (items: readonly { source: SourceRef[]; children?: unknown }[]): void =>
    items.forEach((it) => {
      collect(it.source);
      if (Array.isArray(it.children)) walkItems(it.children as { source: SourceRef[] }[]);
    });
  for (const d of docs)
    for (const s of d.sections)
      for (const b of s.blocks) {
        if (b.type === 'paragraph') collect(b.source);
        else if (b.type === 'table') b.rows.forEach((r) => collect(r.source));
        else if (b.type === 'list') walkItems(b.items);
      }
  const out = new Map<string, string>();
  for (const f of files) {
    if (!wanted.has(f.path)) continue;
    try {
      out.set(f.path, await readFile(f.abs, 'utf8'));
    } catch {
      // 読めないファイルは入力に無いものとして (a) で不一致になる
    }
  }
  return out;
}

function reason(m: VerifyMismatch): string {
  const loc = srcText([m.source]);
  return m.kind === 'location'
    ? `照合で不一致（${loc} が入力に無いか、行番号がファイルの行数を超える）`
    : `照合で不一致（${loc} に ${m.identifiers.join('・')} が見当たらない）`;
}

function isD09Table(b: Block): b is TableBlock {
  return b.type === 'table' && b.columns[0] === 'No.';
}

/** 生成済みの D09 の番号を予約し、続きの番号から採番する登録簿を作る */
function seededRegistry(d09: Document | undefined): { reg: D09Registry; seeded: number } {
  const reg = new D09Registry();
  const existing = (d09?.sections ?? []).flatMap((s) => s.blocks.filter(isD09Table).flatMap((t) => t.rows.map((r) => r.cells[0] ?? '')));
  existing.forEach((no) => reg.register({ key: `existing:${no}`, topic: '', question: '', origin: 'D09', reserve: true }));
  return { reg, seeded: existing.length };
}

/** D09 文書の一覧表に照合の不一致を追記する（0 件の段落は表に置き換える） */
export function appendToD09(d09: Document, entries: ReturnType<D09Registry['entries']>): Document {
  if (entries.length === 0) return d09;
  const rows: TableRow[] = entries.map((e) =>
    row(
      [e.no, 'その他', e.topic, e.question, (e.origins ?? [e.origin]).join('、'), e.relatedIds.join(', '), srcText(e.source)],
      { evidence: 'unknown', source: [...e.source], irIds: [...e.relatedIds], d09Ref: e.no },
    ),
  );
  let done = false;
  const sections = d09.sections.map((s, i) => {
    if (done || i !== 0) return s;
    done = true;
    const hasTable = s.blocks.some(isD09Table);
    const blocks = hasTable
      ? s.blocks.map((b) => (isD09Table(b) ? { ...b, rows: [...b.rows, ...rows] } : b))
      : [...s.blocks.filter((b) => b.type !== 'paragraph'), table(D09_COLUMNS, rows)];
    return { ...s, blocks };
  });
  return { ...d09, sections };
}

function nextHeading(sections: readonly Section[], level: Section['level']): string {
  const nums = sections.filter((s) => s.level === level).map((s) => /^(\d+)\.\s/.exec(s.heading)?.[1]).filter((n): n is string => n !== undefined);
  const last = nums.length > 0 ? Math.max(...nums.map(Number)) : 0;
  return last > 0 ? `${last + 1}. ${VERIFY_HEADING}` : VERIFY_HEADING;
}

/** D08 の改版履歴の前に「照合の結果」を足す */
export function appendToD08(d08: Document, counts: VerifyCounts, mismatches: VerifyResult['mismatches']): Document {
  const revIdx = d08.sections.findIndex((s) => s.heading === '改版履歴');
  const at = revIdx >= 0 ? revIdx : d08.sections.length;
  const level = d08.sections[at]?.level ?? d08.sections.at(-1)?.level ?? 1;
  const mismatchTotal = counts.mismatchLocation + counts.mismatchIdentifier;
  const blocks: Block[] = [
    para(
      `生成した全文書の段落・表の行・列挙のうち、根拠位置（ファイル:行）を持つ行を元のソースと照合した（位置の実在と、行の前後 3 行以内に対象の識別子があるか）。`,
      factProv([]),
    ),
    table(
      ['項目', '件数'],
      [
        row(['照合した行', String(counts.checked)], factProv([])),
        row(['一致', String(counts.matched)], factProv([])),
        row(['不一致（位置が実在しない）', String(counts.mismatchLocation)], factProv([])),
        row(['不一致（識別子が見当たらない）', String(counts.mismatchIdentifier)], factProv([])),
        row(['照合対象外（根拠位置なし）', String(counts.skipped)], factProv([])),
      ],
      '照合の件数',
    ),
    mismatchTotal === 0
      ? para('不一致は 0 件', factProv([]))
      : table(
          ['文書', '節', '要約', '根拠位置', '理由', '確認事項'],
          mismatches.map((m) =>
            row([m.docId, m.section, m.summary, srcText([m.source]), m.kind === 'location' ? '位置が実在しない' : `識別子が見当たらない（${m.identifiers.join('・')}）`, m.d09Ref], factProv([])),
          ),
          '照合で不一致の行',
        ),
  ];
  const added = section(nextHeading(d08.sections.slice(0, at), level), level, blocks);
  return { ...d08, sections: [...d08.sections.slice(0, at), added, ...d08.sections.slice(at)] };
}

/** 検証の工程: 照合 → D09 に登録・追記 → D08 に結果を追記。元の文書は変更しない */
export function verifyDocuments(docs: readonly Document[], ir: IR, files: ReadonlyMap<string, string>): VerifyResult {
  const { reg, seeded } = seededRegistry(docs.find((d) => d.id === 'D09'));
  const refs: string[] = [];
  const checked = checkDocuments(docs, ir, files, (m) => {
    const q = reason(m);
    const no = reg.register({
      key: `verify:${srcText([m.source])}:${m.kind}:${m.identifiers.join(',')}`,
      topic: `照合: ${m.docId} ${m.section}`,
      question: q,
      category: 'other',
      relatedIds: m.irIds,
      source: [m.source],
      origin: m.docId,
    });
    refs.push(no);
    return no;
  });
  const mismatches = checked.mismatches.map((m, i) => ({ ...m, d09Ref: refs[i] ?? '' }));
  const added = reg.entries().slice(seeded);
  const out = checked.docs.map((d) => {
    if (d.id === 'D09') return appendToD09(d, added);
    if (d.id === 'D08') return appendToD08(d, checked.counts, mismatches);
    return d;
  });
  return { docs: out, counts: checked.counts, mismatches };
}
