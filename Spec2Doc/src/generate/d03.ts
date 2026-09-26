// D03 画面仕様書: 画面一覧・画面遷移表・画面部品表・異常系の画面と表示（REQ-F-032）

import type { EventHandler, IR, Screen, UiElement } from '../ir/schema.ts';
import type { Block, DiagramBlock, DiagramEdge, DiagramNode, Document, Section, TableRow } from '../doc/model.ts';
import {
  type GenCtx,
  errorProv,
  factProv,
  mergeProv,
  hasFailedFiles,
  idMaps,
  makeDocument,
  provOf,
  row,
  rowProvWithLlm,
  section,
  srcText,
  table,
  zeroResult,
} from './common.ts';
import { BOUNDARY_COLUMNS, boundaryRow, constraintText } from './d02.ts';
import { EXTERNAL_GROUP } from '../doc/model.ts';

function sortedScreens(ir: IR): Screen[] {
  const { screen } = idMaps(ir);
  return [...ir.screens].sort((a, b) => ((screen.get(a.id) ?? '') < (screen.get(b.id) ?? '') ? -1 : 1));
}

/** 遷移先の文字列（href・action）を画面 ID に解決する。解決できなければ undefined */
function resolveScreen(ir: IR, target: string): Screen | undefined {
  const path = target.replace(/^\.\//, '').replace(/[?#].*$/, '');
  if (path === '' || /^[a-z]+:/i.test(path)) return undefined;
  return ir.screens.find((s) => s.file === path || s.file.endsWith(`/${path}`));
}

/** ハンドラが既定動作を止めるか（JS 解析が EventHandler に載せる preventsDefault。欄が無ければ false） */
function preventsDefault(h: EventHandler): boolean {
  return (h as EventHandler & { preventsDefault?: unknown }).preventsDefault === true;
}

/**
 * 要素の既定の遷移を止めるハンドラ。要素自身のハンドラ、またはボタンなら同じ画面・同じ遷移先のフォームのハンドラ
 * （送信ボタンの押下はフォームの submit として処理されるため）
 */
function preventingHandlers(ir: IR, e: UiElement): EventHandler[] {
  const own = ir.eventHandlers.filter((h) => h.uiElementId === e.id && preventsDefault(h));
  if (own.length > 0) return own;
  const isSubmitter = e.kind === 'button' || (e.kind === 'input' && (e.inputType === 'submit' || e.inputType === 'image'));
  if (!isSubmitter) return [];
  const forms = ir.uiElements.filter((x) => x.kind === 'form' && x.screenId === e.screenId && x.navigatesTo === e.navigatesTo);
  return ir.eventHandlers.filter((h) => forms.some((x) => x.id === h.uiElementId) && h.event === 'submit' && preventsDefault(h));
}

async function screenList(ir: IR, ctx: GenCtx): Promise<Section> {
  const { screen } = idMaps(ir);
  const rows: TableRow[] = [];
  for (const s of sortedScreens(ir)) {
    const r = await ctx.llm.explain({
      targetId: s.id,
      kind: 'screen',
      summary: `画面 ${s.title}（${s.file}）。部品 ${s.elementIds.length} 件${s.isErrorView ? '。異常系の画面' : ''}`,
      snippets: [],
    });
    const base = provOf(s, ctx, 'D03', `画面 ${s.title}`);
    rows.push(row([screen.get(s.id) ?? s.id, s.title, s.file, s.isErrorView ? '異常系' : '正常系', r.text], rowProvWithLlm(base, r)));
  }
  return section('1. 画面一覧', 2, [
    rows.length > 0
      ? table(['画面ID', '画面名', 'ファイル', '備考', '説明'], rows)
      : zeroResult(ctx, 'D03', '画面', { uncertain: hasFailedFiles(ir) }),
  ]);
}

/** 画面遷移図: 画面をノード、遷移を辺にする。画面外の遷移先は点線のノード、画面内で処理（既定の遷移を止める）は自己ループ */
function transitionDiagram(ir: IR): DiagramBlock | undefined {
  const { screen } = idMaps(ir);
  const screens = sortedScreens(ir);
  if (screens.length === 0) return undefined;
  const navs = ir.uiElements.filter((e) => e.navigatesTo && e.navigatesTo.trim() !== '');
  const seen = new Set<string>();
  const external = new Map<string, DiagramNode>();
  const edges = navs.flatMap((e): DiagramEdge[] => {
    const target = (e.navigatesTo ?? '').trim();
    const stops = preventingHandlers(ir, e).length > 0;
    const resolved = stops ? undefined : resolveScreen(ir, target);
    const to = stops ? e.screenId : resolved ? resolved.id : `ext:${target}`;
    if (!stops && !resolved && !external.has(to)) external.set(to, { id: to, label: target, group: EXTERNAL_GROUP });
    const name = e.label ?? e.domId ?? e.kind;
    const label = stops ? `${name}（画面内で処理）` : name;
    const key = `${e.screenId}|${to}|${label}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ from: e.screenId, to, label }];
  });
  return {
    type: 'diagram',
    title: '画面遷移図',
    diagramType: 'flow',
    nodes: [
      ...screens.map((s) => ({ id: s.id, label: `${screen.get(s.id) ?? s.id} ${s.title}`, group: s.isErrorView ? '異常系' : '正常系' })),
      ...external.values(),
    ],
    edges,
    provenance: factProv([...screens.flatMap((s) => s.source), ...navs.flatMap((e) => e.source)], [...screens.map((s) => s.id), ...navs.map((e) => e.id)]),
  };
}

function transitions(ir: IR, ctx: GenCtx): Section {
  const { screen, part } = idMaps(ir);
  const rows = ir.uiElements
    .filter((e) => e.navigatesTo && e.navigatesTo.trim() !== '')
    .sort((a, b) => ((part.get(a.id) ?? '') < (part.get(b.id) ?? '') ? -1 : 1))
    .map((e) => {
      const to = resolveScreen(ir, e.navigatesTo ?? '');
      const trigger = ir.eventHandlers.filter((h) => h.uiElementId === e.id).map((h) => h.event);
      const stops = preventingHandlers(ir, e);
      const base = provOf(e, ctx, 'D03', `遷移 ${e.navigatesTo}`);
      return row(
        [
          screen.get(e.screenId) ?? e.screenId,
          part.get(e.id) ?? e.id,
          `${e.label ?? e.domId ?? e.kind} の${trigger.join('・') || (e.kind === 'form' ? '送信' : '押下')}`,
          stops.length > 0 ? '画面内で処理（遷移なし）' : to ? (screen.get(to.id) ?? to.id) : '（画面外）',
          stops.length > 0 ? `—（${stops.map((h) => h.handler).join(', ')} が既定の遷移を止める）` : (e.navigatesTo ?? ''),
        ],
        stops.length > 0 ? mergeProv([base, ...stops.map((h) => factProv(h.source, [h.id]))]) : base,
      );
    });
  const diagram = transitionDiagram(ir);
  return section('2. 画面遷移', 2, [
    ...(diagram ? [diagram] : []),
    rows.length > 0
      ? table(['遷移元画面ID', '部品ID', '契機', '遷移先画面ID', '遷移先の指定'], rows, '画面遷移表')
      : zeroResult(ctx, 'D03', '画面遷移', { uncertain: hasFailedFiles(ir) }),
  ]);
}

function parts(ir: IR, ctx: GenCtx): Section[] {
  const { screen, part } = idMaps(ir);
  const perScreen = sortedScreens(ir).map((s) => {
    const rows = ir.uiElements
      .filter((e) => e.screenId === s.id)
      .sort((a, b) => ((part.get(a.id) ?? '') < (part.get(b.id) ?? '') ? -1 : 1))
      .map((e) => {
        const events = ir.eventHandlers.filter((h) => h.uiElementId === e.id).map((h) => `${h.event}→${h.handler}`);
        return row(
          [part.get(e.id) ?? e.id, e.label ?? '', e.kind + (e.inputType ? `（${e.inputType}）` : ''), e.domId ?? e.name ?? '', constraintText(e), events.join(', '), e.description ?? ''],
          provOf(e, ctx, 'D03', `画面部品 ${e.label ?? e.domId ?? e.id}`),
        );
      });
    const body: Block = rows.length > 0
      ? table(['識別ID', 'ラベル', '種類', '識別子', '制約', 'イベント', '説明'], rows)
      : zeroResult(ctx, 'D03', `${screen.get(s.id) ?? s.id} ${s.title} の画面部品`, { uncertain: hasFailedFiles(ir), relatedIds: [s.id], source: s.source });
    return section(`${screen.get(s.id) ?? s.id} ${s.title}`, 3, [body]);
  });
  return [
    section('3. 画面部品表', 2, perScreen.length > 0 ? [] : [zeroResult(ctx, 'D03', '画面部品', { uncertain: hasFailedFiles(ir) })]),
    ...perScreen,
  ];
}

function abnormal(ir: IR, ctx: GenCtx): Section {
  const { screen, error } = idMaps(ir);
  const rows: TableRow[] = [
    ...sortedScreens(ir)
      .filter((s) => s.isErrorView)
      .map((s) => row([screen.get(s.id) ?? s.id, '異常系の画面', s.title, '', srcText(s.source)], provOf(s, ctx, 'D03', `画面 ${s.title}`))),
    ...ir.errors
      .filter((e) => e.kind === 'display' || e.kind === 'validation')
      .sort((a, b) => ((error.get(a.id) ?? '') < (error.get(b.id) ?? '') ? -1 : 1))
      .map((e) => {
        const { cond, prov } = errorProv(e, ctx, 'D03', ir);
        return row([error.get(e.id) ?? e.id, e.kind === 'validation' ? '入力エラー表示' : 'エラー表示', e.message, cond, srcText(e.source)], prov);
      }),
  ];
  return section('4. 異常系の画面と表示', 2, [
    rows.length > 0
      ? table(['ID', '種別', '表示内容', '表示条件', '位置'], rows, 'エラーID は D02 のエラー一覧と同じ')
      : zeroResult(ctx, 'D03', '異常系の画面・表示', { uncertain: hasFailedFiles(ir) }),
  ]);
}

/** 画面部品の制約属性から取った境界（maxlength 等）。内側・外側の例を併記する（REQ-F-033） */
function inputBoundaries(ir: IR, ctx: GenCtx): Section {
  const { part } = idMaps(ir);
  const rows = ir.boundaries
    .filter((b) => b.uiElementId !== undefined && part.has(b.uiElementId))
    .sort((a, b) => {
      const pa = part.get(a.uiElementId ?? '') ?? '';
      const pb = part.get(b.uiElementId ?? '') ?? '';
      return pa !== pb ? (pa < pb ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((b) => boundaryRow(ir, ctx, b, 'D03'));
  return section('5. 入力項目の範囲・境界', 2, [
    rows.length > 0
      ? table(BOUNDARY_COLUMNS, rows, '部品ID は画面部品表と同じ。機能ごとの境界は D02 を参照')
      : zeroResult(ctx, 'D03', '入力項目の境界', { uncertain: hasFailedFiles(ir) }),
  ]);
}

export async function buildD03(ir: IR, ctx: GenCtx): Promise<Document> {
  return makeDocument('D03', ctx, [await screenList(ir, ctx), transitions(ir, ctx), ...parts(ir, ctx), abnormal(ir, ctx), inputBoundaries(ir, ctx)]);
}
