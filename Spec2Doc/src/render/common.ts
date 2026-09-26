// 出力 4 形式で共有する根拠（Provenance）の書式。4 形式とも evidence・source・d09Ref を落とさない（REQ-F-017）。

import { EVIDENCE_LABELS, type Document, type ListItem, type Provenance } from '../doc/model.ts';
import type { SourceRef } from '../ir/schema.ts';

export function formatSourceRef(ref: SourceRef): string {
  const range = ref.endLine !== undefined && ref.endLine !== ref.line ? `${ref.line}-${ref.endLine}` : `${ref.line}`;
  return `${ref.file}:${range}`;
}

/** ソース位置の一覧（区切りは「, 」）。無ければ空文字 */
export function formatSources(p: Provenance): string {
  return p.source.map(formatSourceRef).join(', ');
}

/** 推測の出どころの表示。LLM の説明文か、解析による対応付けか（REQ-F-017） */
export function inferenceSourceLabel(p: Provenance): string {
  return p.origin === 'llm' ? 'LLM' : '解析による対応付け';
}

/** 根拠の区分だけの表示（表の根拠列用）。例: 事実／推測（LLM）／推測（解析による対応付け）／不明 */
export function evidenceLabel(p: Provenance): string {
  const label = EVIDENCE_LABELS[p.evidence];
  return p.evidence === 'inference' ? `${label}（${inferenceSourceLabel(p)}）` : label;
}

/** 根拠ラベルの本文。例: 事実（a.ts:3）／推測（LLM。a.ts:3）／推測（解析による対応付け。a.ts:3）／不明（D09-001） */
export function formatProvenance(p: Provenance): string {
  const label = EVIDENCE_LABELS[p.evidence];
  const parts: string[] = [];
  if (p.evidence === 'inference') parts.push(inferenceSourceLabel(p));
  const src = formatSources(p);
  if (src) parts.push(src);
  if (p.d09Ref) parts.push(p.d09Ref);
  return parts.length > 0 ? `${label}（${parts.join('。')}）` : label;
}

export interface FlatItem {
  depth: number;
  item: ListItem;
}

/** 入れ子の列挙を深さ付きで平らにする（新しい配列を返す） */
export function flattenItems(items: readonly ListItem[], depth = 0): FlatItem[] {
  return items.flatMap((item) => [{ depth, item }, ...flattenItems(item.children ?? [], depth + 1)]);
}

/** 文書の本文に改版履歴の節があるか（あれば doc.revision からの表は重ねて出さない） */
export function hasRevisionSection(doc: Document): boolean {
  return doc.sections.at(-1)?.heading === '改版履歴';
}
