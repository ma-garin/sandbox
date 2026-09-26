// D01 概要書: システム構成・モジュール構成・機能サマリ・用語集（REQ-F-022）

import type { IR, Screen, UiElement } from '../ir/schema.ts';
import type { Heading } from '../analyze/html.ts';
import type { Document, TableRow } from '../doc/model.ts';
import {
  type GenCtx,
  designIntentNote,
  factProv,
  idMaps,
  makeDocument,
  mergeProv,
  para,
  provOf,
  row,
  rowProvWithLlm,
  section,
  srcText,
  table,
  zeroResult,
  hasFailedFiles,
} from './common.ts';

const LANG_LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  other: 'その他',
};

function systemSection(ir: IR, ctx: GenCtx) {
  const byLang = new Map<string, number>();
  for (const f of ir.files) byLang.set(f.language, (byLang.get(f.language) ?? 0) + 1);
  const rows = [...byLang.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([lang, n]) => {
      const files = ir.files.filter((f) => f.language === lang);
      return row([LANG_LABEL[lang] ?? lang, String(n), String(files.reduce((s, f) => s + f.lines, 0))], factProv(
        files.map((f) => ({ file: f.path, line: 1 })),
        files.map((f) => f.id),
      ));
    });
  const inputText = `入力: ${ir.input.label}（${ir.input.kind}${ir.input.commit ? `、コミット ${ir.input.commit}` : ''}）。ファイル ${ir.files.length} 件、画面 ${ir.screens.length} 件、モジュール ${ir.modules.length} 件、関数 ${ir.functions.length} 件`;
  return section('1. システム構成', 2, [
    designIntentNote(),
    para(inputText, factProv([])),
    rows.length > 0
      ? table(['言語', 'ファイル数', '行数'], rows, '言語別のファイル構成')
      : zeroResult(ctx, 'D01', 'システム構成（ファイル）', { uncertain: hasFailedFiles(ir) }),
  ]);
}

async function moduleSection(ir: IR, ctx: GenCtx) {
  const rows: TableRow[] = [];
  for (const m of [...ir.modules].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
    const fns = ir.functions.filter((f) => f.moduleId === m.id);
    const base = provOf(m, ctx, 'D01', `モジュール ${m.name}`);
    const r = await ctx.llm.explain({
      targetId: m.id,
      kind: 'module',
      summary: `モジュール ${m.name}（${m.file}、${m.kind}）。関数: ${fns.map((f) => f.name).join(', ') || 'なし'}`,
      snippets: [],
    });
    rows.push(row([m.name, m.file, m.kind, String(fns.length), r.text], rowProvWithLlm(base, r)));
  }
  return section('2. モジュール構成', 2, [
    rows.length > 0
      ? table(['モジュール', 'ファイル', '種類', '関数数', '説明'], rows)
      : zeroResult(ctx, 'D01', 'モジュール構成', { uncertain: hasFailedFiles(ir) }),
  ]);
}

function featureSection(ir: IR, ctx: GenCtx) {
  const { features } = idMaps(ir);
  const rows = features.map((f) =>
    row([f.no, f.category, f.fn.name, srcText(f.fn.source)], provOf(f.fn, ctx, 'D01', `機能 ${f.fn.name}`)),
  );
  return section('3. 機能サマリ', 2, [
    rows.length > 0
      ? table(['機能ID', '分類', '機能名', '定義位置'], rows, '詳細は D02 要求仕様書の同じ機能 ID を参照')
      : zeroResult(ctx, 'D01', '機能', { uncertain: hasFailedFiles(ir) }),
  ]);
}

/** analyze の html.ts が Screen に載せる h1〜h3 の見出し（無ければ空） */
function headingsOf(s: Screen): Heading[] {
  const hs = (s as Screen & { headings?: unknown }).headings;
  return Array.isArray(hs) ? (hs as Heading[]).filter((h) => h && typeof h.text === 'string' && typeof h.line === 'number') : [];
}

/** 画面の語とコード上の識別子の対応（REQ-F-022）。識別子は domId・name と、同名の変数・引数 */
function glossaryRows(ir: IR, ctx: GenCtx): TableRow[] {
  const { part, screen } = idMaps(ir);
  const labeled = ir.uiElements.filter((e): e is UiElement & { label: string } => !!e.label && e.label.trim() !== '');
  const byTerm = new Map<string, UiElement[]>();
  for (const e of labeled) byTerm.set(e.label.trim(), [...(byTerm.get(e.label.trim()) ?? []), e]);
  const termRows = [...byTerm.entries()].map(([term, els]) => {
    const names = [...new Set(els.flatMap((e) => [e.domId, e.name].filter((x): x is string => !!x)))];
    const codeRefs = [
      ...ir.globals.filter((g) => names.includes(g.name)),
      ...ir.functions.filter((f) => f.params.some((p) => names.includes(p.name))),
      ...ir.defaults.filter((d) => names.includes(d.subject)),
    ];
    const idents = names;
    const desc = els.map((e) => `${part.get(e.id) ?? e.id}（${screen.get(e.screenId) ?? e.screenId} の${e.kind}${e.inputType ? `・${e.inputType}` : ''}）`).join('、');
    const prov = mergeProv([...els.map((e) => provOf(e, ctx, 'D01', `用語 ${term}`)), ...codeRefs.map((c) => factProv(c.source, [c.id]))]);
    return { term, cells: [desc, idents.length > 0 ? idents.join(', ') : '（識別子なし）'], prov };
  });
  const screenRows = ir.screens
    .filter((s) => s.title.trim() !== '' && !byTerm.has(s.title.trim()))
    .map((s) => ({ term: s.title.trim(), cells: [`画面 ${screen.get(s.id) ?? s.id} の題名`, s.file], prov: provOf(s, ctx, 'D01', `画面 ${s.title}`) }));
  const seen = new Set([...byTerm.keys(), ...screenRows.map((r) => r.term)]);
  const headingRows = ir.screens.flatMap((s) =>
    headingsOf(s)
      .filter((h) => {
        const t = h.text.trim();
        if (t === '' || seen.has(t)) return false;
        seen.add(t);
        return true;
      })
      .map((h) => ({
        term: h.text.trim(),
        cells: [`画面 ${screen.get(s.id) ?? s.id} の見出し（h${h.level}）`, `${s.file} の h${h.level}`],
        prov: factProv([{ file: s.file, line: h.line }], [s.id]),
      })),
  );
  return [...termRows, ...screenRows, ...headingRows]
    .sort((a, b) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0))
    .map((t, i) => row([String(i + 1), t.term, ...t.cells], t.prov));
}

function glossarySection(ir: IR, ctx: GenCtx) {
  const rows = glossaryRows(ir, ctx);
  return section('4. 用語集', 2, [
    rows.length > 0
      ? table(['No.', '用語', '説明', '対応する識別子'], rows)
      : zeroResult(ctx, 'D01', '用語（画面に表示される語）', { uncertain: hasFailedFiles(ir) }),
  ]);
}

export async function buildD01(ir: IR, ctx: GenCtx): Promise<Document> {
  return makeDocument('D01', ctx, [systemSection(ir, ctx), await moduleSection(ir, ctx), featureSection(ir, ctx), glossarySection(ir, ctx)]);
}
