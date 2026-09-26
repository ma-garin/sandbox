// 図（DiagramBlock）の描画。外部ライブラリを使わず、レイヤ配置（最長経路で段を決め、段内は入力の順）で SVG 文字列を作る。
// 色は kit のトークン（var(--color-*)）だけを使う。md 用の mermaid と、docx・xlsx 用の辺の一覧もここで作る。

import type { DiagramBlock, DiagramEdge, DiagramNode } from '../doc/model.ts';

/** 図に描くノードの上限。超えたら次数の多い順に上位だけ描き、注記を付ける */
export const MAX_DIAGRAM_NODES = 40;
export const TRUNCATION_NOTE = `上位 ${MAX_DIAGRAM_NODES} 件のみ表示。全件は下の表`;

/** ノード幅。ラベルの長さに応じて MIN〜MAX で広げ、MAX を超えるときだけ省略する */
export const NODE_W_MIN = 168;
export const NODE_W_MAX = 240;
const FONT_PX = 13;
const NODE_PAD_X = 12;
const NODE_H = 40;
const GAP_X = 72;
const GAP_Y = 20;
const PAD = 16;
export { EXTERNAL_GROUP } from '../doc/model.ts';
import { EXTERNAL_GROUP } from '../doc/model.ts';

export interface DiagramView {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  truncated: boolean;
}

/** 描く対象を決める。辺の端が存在しないものは落とす。ノードが上限を超えたら次数の多い順（同数は入力順）に上位だけ残す */
export function selectForDiagram(nodes: readonly DiagramNode[], edges: readonly DiagramEdge[], max = MAX_DIAGRAM_NODES): DiagramView {
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  if (nodes.length <= max) return { nodes: [...nodes], edges: valid, truncated: false };
  const degree = new Map<string, number>();
  for (const e of valid) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const keep = new Set(
    nodes
      .map((n, i) => ({ n, i, d: degree.get(n.id) ?? 0 }))
      .sort((a, b) => b.d - a.d || a.i - b.i)
      .slice(0, max)
      .map((x) => x.n.id),
  );
  return { nodes: nodes.filter((n) => keep.has(n.id)), edges: valid.filter((e) => keep.has(e.from) && keep.has(e.to)), truncated: true };
}

/** 閉路を作る辺（DFS の後退辺）の添字。段の計算からは外す */
function backEdges(nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]): Set<number> {
  const out = new Map<string, number[]>();
  edges.forEach((e, i) => out.set(e.from, [...(out.get(e.from) ?? []), i]));
  const state = new Map<string, 1 | 2>();
  const back = new Set<number>();
  for (const root of nodes) {
    if (state.has(root.id)) continue;
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    state.set(root.id, 1);
    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const ei = (out.get(top.id) ?? [])[top.next];
      if (ei === undefined) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      top.next += 1;
      const to = edges[ei]?.to;
      if (to === undefined) continue;
      const s = state.get(to);
      if (s === 1) back.add(ei);
      else if (s === undefined) {
        state.set(to, 1);
        stack.push({ id: to, next: 0 });
      }
    }
  }
  return back;
}

/** 最長経路で段を決める（入次数 0 のノードが段 0）。閉路の辺は無視する */
export function assignLayers(nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]): Map<string, number> {
  const back = backEdges(nodes, edges);
  const dag = edges.filter((e, i) => !back.has(i) && e.from !== e.to);
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of dag) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  // for-of は走査中に push した要素も順にたどる
  for (const id of queue) {
    for (const e of dag.filter((x) => x.from === id)) {
      layer.set(e.to, Math.max(layer.get(e.to) ?? 0, (layer.get(id) ?? 0) + 1));
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  return layer;
}

export interface NodeBox {
  node: DiagramNode;
  x: number;
  y: number;
  /** ノードの幅と、枠に収まるよう省略した表示文字列 */
  w: number;
  text: string;
}

/** 表示幅の見積もり（全角は 1em、半角は 0.62em） */
function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += (ch.codePointAt(0) ?? 0) > 0x2e7f ? FONT_PX : FONT_PX * 0.62;
  return w;
}

/** ラベルが収まる幅（上限 NODE_W_MAX）。上限でも収まらないときだけ末尾を「…」で省略する */
export function fitLabel(label: string): { w: number; text: string } {
  const need = Math.ceil(textWidth(label)) + NODE_PAD_X * 2;
  if (need <= NODE_W_MAX) return { w: Math.max(NODE_W_MIN, need), text: label };
  const chars = [...label];
  let n = chars.length;
  while (n > 0 && textWidth(`${chars.slice(0, n).join('')}…`) + NODE_PAD_X * 2 > NODE_W_MAX) n -= 1;
  return { w: NODE_W_MAX, text: `${chars.slice(0, n).join('')}…` };
}

/** 段を左から右へ、段内は入力の順に上から並べる */
export function layoutDiagram(nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]): { boxes: NodeBox[]; width: number; height: number } {
  const layer = assignLayers(nodes, edges);
  const fitted = nodes.map((node) => ({ node, l: layer.get(node.id) ?? 0, ...fitLabel(node.label) }));
  const layers = Math.max(1, ...fitted.map((f) => f.l + 1));
  const colW = Array.from({ length: layers }, (_, l) => Math.max(NODE_W_MIN, ...fitted.filter((f) => f.l === l).map((f) => f.w)));
  const colX = colW.map((_, l) => PAD + colW.slice(0, l).reduce((a, b) => a + b + GAP_X, 0));
  const rowInLayer = new Map<number, number>();
  const boxes = fitted.map(({ node, l, w, text }) => {
    const r = rowInLayer.get(l) ?? 0;
    rowInLayer.set(l, r + 1);
    return { node, x: colX[l] ?? PAD, y: PAD + r * (NODE_H + GAP_Y), w, text };
  });
  const rows = Math.max(1, ...rowInLayer.values());
  const width = PAD * 2 + colW.reduce((a, b) => a + b, 0) + (layers - 1) * GAP_X;
  return { boxes, width, height: PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y };
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


/** 同じ文書に複数の図があっても marker の id がぶつからないよう、題名と内容から短い id を作る */
function markerId(block: DiagramBlock): string {
  const key = `${block.title}|${block.nodes.map((n) => n.id).join(',')}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `dg-arrow-${h.toString(36)}`;
}

function edgePath(a: NodeBox, b: NodeBox): string {
  if (a.node.id === b.node.id) {
    const x = a.x + a.w;
    const y = a.y + NODE_H / 2;
    return `M${x} ${y - 8} C${x + 36} ${y - 30} ${x + 36} ${y + 30} ${x} ${y + 8}`;
  }
  const x1 = a.x + a.w;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(36, Math.abs(x2 - x1) / 2);
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

/** 図の SVG 文字列。ノード数が上限を超えたら注記を図の上に出す（html から使う） */
export function renderDiagramSvg(block: DiagramBlock): string {
  const view = selectForDiagram(block.nodes, block.edges);
  const { boxes, width, height } = layoutDiagram(view.nodes, view.edges);
  const byId = new Map(boxes.map((b) => [b.node.id, b] as const));
  const mid = markerId(block);
  const groups = [...new Set(view.nodes.map((n) => n.group).filter((g): g is string => g !== undefined))];
  const fill = (n: DiagramNode): string => (n.group !== undefined && groups.indexOf(n.group) % 2 === 1 ? 'var(--color-surface-2)' : 'var(--color-surface)');
  const rectStyle = (n: DiagramNode): string =>
    n.group === EXTERNAL_GROUP
      ? 'fill:var(--color-bg);stroke:var(--color-border-strong);stroke-width:1.5;stroke-dasharray:6 4'
      : `fill:${fill(n)};stroke:var(--color-primary);stroke-width:1.5`;
  const edgeSvg = view.edges
    .map((e) => {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) return '';
      const title = `<title>${esc(`${a.node.label} → ${b.node.label}${e.label ? `（${e.label}）` : ''}`)}</title>`;
      return `<path d="${edgePath(a, b)}" style="fill:none;stroke:var(--color-border-strong);stroke-width:1.5" marker-end="url(#${mid})">${title}</path>`;
    })
    .join('');
  const nodeSvg = boxes
    .map(
      (b) =>
        `<g><title>${esc(b.node.label)}${b.node.group ? `（${esc(b.node.group)}）` : ''}</title>` +
        `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${NODE_H}" rx="6" style="${rectStyle(b.node)}"/>` +
        `<text x="${b.x + b.w / 2}" y="${b.y + NODE_H / 2}" text-anchor="middle" dominant-baseline="central" style="fill:var(--color-text);font-size:${FONT_PX}px">${esc(b.text)}</text></g>`,
    )
    .join('');
  const defs = `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--color-border-strong)"/></marker></defs>`;
  const note = view.truncated ? `<p class="diagram-note muted">${esc(TRUNCATION_NOTE)}</p>` : '';
  const svg = `<svg class="diagram" role="img" aria-label="${esc(block.title)}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}${edgeSvg}${nodeSvg}</svg>`;
  return `${note}${svg}`;
}

/** mermaid の node id に使えない文字を置き換える */
function mermaidId(id: string, index: number): string {
  return `n${index}_${id.replace(/[^A-Za-z0-9_]/g, '_')}`;
}

function mermaidText(text: string): string {
  return text.replace(/"/g, '#quot;').replace(/\r?\n/g, ' ');
}

/** md 用の mermaid flowchart。ノード上限と注記は SVG と同じ */
export function renderDiagramMermaid(block: DiagramBlock): string {
  const view = selectForDiagram(block.nodes, block.edges);
  const idOf = new Map(view.nodes.map((n, i) => [n.id, mermaidId(n.id, i)] as const));
  const lines = [
    'flowchart LR',
    ...view.nodes.map((n) => `  ${idOf.get(n.id)}["${mermaidText(n.label)}"]`),
    ...view.edges.map((e) => `  ${idOf.get(e.from)} -->${e.label ? `|"${mermaidText(e.label)}"|` : ''} ${idOf.get(e.to)}`),
    ...view.nodes.filter((n) => n.group === EXTERNAL_GROUP).map((n) => `  style ${idOf.get(n.id)} stroke-dasharray: 5 5`),
  ];
  return ['```mermaid', ...lines, '```'].join('\n');
}

/** docx・xlsx 用の辺の一覧（全件。図の上限は掛けない）。辺が無いノードも 1 行ずつ出す */
export function diagramEdgeRows(block: DiagramBlock): string[][] {
  const label = new Map(block.nodes.map((n) => [n.id, n.label] as const));
  const rows = block.edges.map((e) => [label.get(e.from) ?? e.from, label.get(e.to) ?? e.to, e.label ?? '']);
  const touched = new Set(block.edges.flatMap((e) => [e.from, e.to]));
  return [...rows, ...block.nodes.filter((n) => !touched.has(n.id)).map((n) => [n.label, '—', '（接続なし）'])];
}

export const DIAGRAM_EDGE_COLUMNS = ['元', '先', 'ラベル'] as const;
