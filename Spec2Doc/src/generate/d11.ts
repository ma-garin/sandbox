// D11 基本設計書（IEEE 1016-2009）: 方式・アーキテクチャ・モジュール構成・外部 I/F・非機能の実装方式（REQ-F-038）。
// D04（データ）・D05（連携）・D06（依存）と重なる内容は ID で参照し、同じ行を書かない。

import type { Boundary, IR, Integration, Module } from '../ir/schema.ts';
import type { DiagramBlock, DiagramEdge, DocId, Document, TableRow } from '../doc/model.ts';
import { boundaryMatchesIntegration, type GenCtx, designIntentNote, dynamicCallNote, factProv, hasFailedFiles, makeDocument, mergeProv, provOf, row, section, table, zeroResult } from './common.ts';
import { boundaryCells } from './d04.ts';
import { staticLimitCounts } from './d08.ts';

const ORIGIN: DocId = 'D11';

function countText(values: string[]): string {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([k, n]) => `${k} ${n} 件`).join('、');
}

function methodRows(ir: IR): TableRow[] {
  const rows: TableRow[] = [];
  if (ir.screens.length > 0) {
    rows.push(row(['実行形態', `ブラウザで動く Web アプリ（HTML 画面 ${ir.screens.length} 枚）`], factProv(ir.screens.flatMap((s) => s.source), ir.screens.map((s) => s.id))));
  } else if (ir.modules.length > 0) {
    rows.push(row(['実行形態', 'スクリプト（HTML 画面なし）'], factProv(ir.modules.flatMap((m) => m.source), ir.modules.map((m) => m.id))));
  }
  const analyzed = ir.files.filter((f) => f.status === 'analyzed');
  if (analyzed.length > 0) rows.push(row(['言語', countText(analyzed.map((f) => f.language))], factProv(analyzed.flatMap((f) => f.source), analyzed.map((f) => f.id))));
  if (ir.modules.length > 0) rows.push(row(['モジュール方式', countText(ir.modules.map((m) => m.kind))], factProv(ir.modules.flatMap((m) => m.source), ir.modules.map((m) => m.id))));
  if (ir.dataItems.length > 0) rows.push(row(['データ保持', `D04 参照: ${ir.dataItems.map((d) => d.id).join(', ')}`], factProv(ir.dataItems.flatMap((d) => d.source), ir.dataItems.map((d) => d.id))));
  if (ir.integrations.length > 0) rows.push(row(['外部連携', `${ir.integrations.length} 件（D05 参照）`], factProv(ir.integrations.flatMap((i) => i.source), ir.integrations.map((i) => i.id))));
  if (ir.dependencies.length > 0) rows.push(row(['依存ライブラリ', `${ir.dependencies.length} 件（D06 参照）`], factProv(ir.dependencies.flatMap((d) => d.source), ir.dependencies.map((d) => d.id))));
  return rows;
}

/** import の指定子を入力ルートからの相対パスに解決し、内部モジュールを探す */
function resolveModule(ir: IR, from: Module, spec: string): Module | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = from.file.split('/').slice(0, -1);
  const parts = spec.split('/').reduce<string[]>((acc, p) => (p === '..' ? acc.slice(0, -1) : p === '.' || p === '' ? acc : [...acc, p]), base);
  const path = parts.join('/');
  const candidates = [path, `${path}.ts`, `${path}.js`, `${path}.mjs`, `${path}/index.ts`, `${path}/index.js`];
  return ir.modules.find((m) => candidates.includes(m.file));
}

function archRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.modules.map((m) => {
    const imps = ir.imports.filter((i) => i.moduleId === m.id);
    const internal = imps.filter((i) => !i.external).map((i) => resolveModule(ir, m, i.from)?.id ?? `${i.from}（未解決）`);
    const external = imps.filter((i) => i.external).map((i) => i.from);
    return row(
      [m.id, m.name, [...new Set(internal)].join(', ') || 'なし', [...new Set(external)].join(', ') || 'なし'],
      mergeProv([provOf(m, ctx, ORIGIN, `モジュール ${m.name}`), ...imps.map((i) => provOf(i, ctx, ORIGIN, `import ${i.from}`))]),
    );
  });
}

/** モジュール依存図: 内部モジュールをノード、解決できた import を辺（import する側 → される側）にする */
function dependencyDiagram(ir: IR): DiagramBlock | undefined {
  if (ir.modules.length === 0) return undefined;
  const seen = new Set<string>();
  const edges = ir.modules.flatMap((m) =>
    ir.imports
      .filter((i) => i.moduleId === m.id && !i.external)
      .flatMap((i): DiagramEdge[] => {
        const to = resolveModule(ir, m, i.from);
        if (!to || seen.has(`${m.id}|${to.id}`)) return [];
        seen.add(`${m.id}|${to.id}`);
        return [{ from: m.id, to: to.id }];
      }),
  );
  const imps = ir.imports.filter((i) => !i.external);
  return {
    type: 'diagram',
    title: 'モジュール依存図',
    diagramType: 'flow',
    nodes: ir.modules.map((m) => ({ id: m.id, label: m.name, group: m.kind })),
    edges,
    provenance: factProv([...ir.modules.flatMap((m) => m.source), ...imps.flatMap((i) => i.source)], [...ir.modules.map((m) => m.id), ...imps.map((i) => i.id)]),
  };
}

function moduleRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.modules.map((m) => {
    const fns = ir.functions.filter((f) => f.moduleId === m.id);
    const cls = ir.classes.filter((c) => c.moduleId === m.id);
    const exps = ir.exports.filter((e) => e.moduleId === m.id);
    const data = ir.dataItems.filter((d) => d.source.some((s) => s.file === m.file)).map((d) => d.id);
    return row(
      [m.id, m.name, m.file, m.kind, String(fns.length), String(cls.length), String(exps.length), data.length > 0 ? `D04 参照: ${data.join(', ')}` : '—'],
      provOf(m, ctx, ORIGIN, `モジュール ${m.name}`),
    );
  });
}

function callerModule(ir: IR, i: Integration): string {
  const fn = i.functionId ? ir.functions.find((f) => f.id === i.functionId) : undefined;
  if (fn) return fn.moduleId;
  return ir.modules.find((m) => i.source.some((s) => s.file === m.file))?.id ?? '不明';
}

function interfaceRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.integrations.map((i) => row([i.id, `D05 ${i.id}`, callerModule(ir, i)], provOf(i, ctx, ORIGIN, `連携 ${i.url}`)));
}

function nfrRows(ir: IR, ctx: GenCtx): TableRow[] {
  const linked = (b: Boundary): Integration | undefined => ir.integrations.find((i) => boundaryMatchesIntegration(b, i));
  const bRows = ir.boundaries
    .filter((b) => b.bound === 'timeout' || b.bound === 'retry' || b.bound === 'interval')
    .map((b) => {
      const label = b.bound === 'timeout' ? 'タイムアウト' : b.bound === 'retry' ? '再試行' : '定期実行';
      const link = linked(b);
      const c = boundaryCells(b, ctx, ORIGIN);
      const how = link ? `${b.subject}（${b.id}。連携 ${link.id}、D05 参照）` : `${b.subject}（${b.id}）`;
      return row([label, how, `${c.value} ${c.unit}`, c.setting], c.prov);
    });
  const rows = [...bRows];
  const media = ir.cssRules.filter((r) => r.kind === 'media' && r.media);
  if (media.length > 0) {
    const text = [...new Set(media.map((r) => `${r.media?.feature}: ${r.media?.value}`))].join('、');
    rows.push(row(['画面幅への対応', `メディアクエリ ${media.length} 件`, text, 'コード固定（CSS）'], factProv(media.flatMap((r) => r.source), media.map((r) => r.id))));
  }
  if (ir.errors.length > 0) {
    rows.push(row(['エラー処理', countText(ir.errors.map((e) => e.kind)), '—', '—'], factProv(ir.errors.flatMap((e) => e.source), ir.errors.map((e) => e.id))));
  }
  const secrets = ir.files.flatMap((f) => (f.secrets ?? []).map((s) => ({ file: f.path, line: s.line, kind: s.kind })));
  if (secrets.length > 0) {
    rows.push(row(['秘密情報の扱い', `ソースに秘密情報らしき値 ${secrets.length} 箇所（値は出力から除外）`, countText(secrets.map((s) => s.kind)), 'コード固定'], factProv(secrets.map((s) => ({ file: s.file, line: s.line })))));
  }
  return rows;
}

export function buildD11(ir: IR, ctx: GenCtx): Document {
  const uncertain = hasFailedFiles(ir);
  const zero = (topic: string) => zeroResult(ctx, ORIGIN, topic, { uncertain });
  const method = methodRows(ir);
  const arch = archRows(ir, ctx);
  const depDiagram = dependencyDiagram(ir);
  const mods = moduleRows(ir, ctx);
  const ifs = interfaceRows(ir, ctx);
  const nfr = nfrRows(ir, ctx);
  return makeDocument(ORIGIN, ctx, [
    section('システム方式', 2, [designIntentNote(), method.length > 0 ? table(['項目', '内容'], method) : zero('システム方式')]),
    section('アーキテクチャ', 2, [...(depDiagram ? [depDiagram, dynamicCallNote(staticLimitCounts(ir))] : []), arch.length > 0 ? table(['モジュールID', '名前', '依存する内部モジュール', '外部ライブラリ'], arch, 'モジュール間の依存') : zero('アーキテクチャ')]),
    section('モジュール構成', 2, [mods.length > 0 ? table(['モジュールID', '名前', 'ファイル', '種類', '関数数', 'クラス数', 'export 数', 'データ'], mods) : zero('モジュール構成')]),
    section('外部 I/F', 2, [ifs.length > 0 ? table(['外部I/F ID', '定義', '呼び出し元モジュール'], ifs, '内容は D05 の同じ ID を参照') : zero('外部 I/F')]),
    section('非機能の実装方式', 2, [nfr.length > 0 ? table(['観点', '実装方式', '値', '固定／設定'], nfr) : zero('非機能の実装方式')]),
  ]);
}

