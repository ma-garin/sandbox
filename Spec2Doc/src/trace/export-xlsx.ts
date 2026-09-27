// トレーサビリティの Excel 書き出し。シート 1: マトリクス（行=文書の節、列=ソースファイル、セル=件数と判定済み割合）、
// シート 2: 対応一覧（状態・確認者・種類・要確認・根拠）。
import ExcelJS from 'exceljs';
import { LINK_KIND_LABEL, REVIEW_STATUS_LABEL, SUSPECT_REASON_LABEL, type ReviewEntry, type TraceGraph, type TraceLink, type TraceReview } from './schema.ts';

const entryOf = (review: TraceReview, id: string): ReviewEntry | undefined => (Object.hasOwn(review.reviews, id) ? review.reviews[id] : undefined);
const decided = (review: TraceReview, l: TraceLink): boolean => (entryOf(review, l.id)?.status ?? 'unreviewed') !== 'unreviewed';

/** マトリクスのセルの文字列。対応が無ければ空 */
export function matrixCell(links: readonly TraceLink[], review: TraceReview): string {
  if (links.length === 0) return '';
  const pct = Math.round((links.filter((l) => decided(review, l)).length / links.length) * 100);
  return `${links.length}（判定済み ${pct}%）`;
}

function addMatrix(wb: ExcelJS.Workbook, graph: TraceGraph, review: TraceReview): void {
  const ws = wb.addWorksheet('マトリクス', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const files = [...new Set(graph.links.flatMap((l) => l.sources.map((s) => s.file)))].sort();
  const sections = new Map<string, { docId: string; section: string; links: TraceLink[] }>();
  for (const l of graph.links) {
    const s = sections.get(l.sectionNodeId) ?? { docId: l.docId, section: l.section, links: [] };
    sections.set(l.sectionNodeId, { ...s, links: [...s.links, l] });
  }
  ws.addRow(['文書', '節', ...files]).font = { bold: true };
  for (const s of sections.values()) {
    ws.addRow([s.docId, s.section, ...files.map((f) => matrixCell(s.links.filter((l) => l.sources.some((x) => x.file === f)), review))]);
  }
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 48;
  for (let i = 0; i < files.length; i++) ws.getColumn(i + 3).width = 18;
}

function addList(wb: ExcelJS.Workbook, graph: TraceGraph, review: TraceReview): void {
  const ws = wb.addWorksheet('対応一覧', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(['文書', '節', '記述', '種類', '状態', '確認者', '確認日時', '要確認', '根拠', 'ソース', 'メモ', '行 ID']).font = { bold: true };
  for (const l of graph.links) {
    const r = entryOf(review, l.id);
    ws.addRow([
      l.docId,
      l.section,
      l.summary,
      LINK_KIND_LABEL[l.kind ?? 'describes'],
      REVIEW_STATUS_LABEL[r?.status ?? 'unreviewed'],
      r?.reviewer ?? '',
      r?.reviewedAt ?? '',
      l.suspect ? SUSPECT_REASON_LABEL[l.suspect.reason] : '',
      String(l.evidence),
      l.sources.map((s) => (s.line !== undefined ? `${s.file}:${s.line}` : s.file)).join(', '),
      r?.note ?? '',
      l.id,
    ]);
  }
  [8, 40, 48, 10, 10, 14, 22, 24, 10, 36, 36, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));
}

export async function toMatrixXlsx(graph: TraceGraph, review: TraceReview): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Spec2Doc';
  addMatrix(wb, graph, review);
  addList(wb, graph, review);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
