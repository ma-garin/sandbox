// Excel（.xlsx）出力。節ごとに 1 シート。表は表のまま、行ごとに根拠・ソース位置・確認事項番号の列を持つ。

import ExcelJS from 'exceljs';
import { type Block, type Document, type Provenance } from '../doc/model.ts';
import { evidenceLabel, flattenItems, formatSources } from './common.ts';
import { DIAGRAM_EDGE_COLUMNS, diagramEdgeRows } from './diagram.ts';
import { TOKEN_HEX } from './tokens.ts';

const PROV_COLUMNS = ['根拠', 'ソース位置', '確認事項'] as const;
const HEADER_FILL = `FF${TOKEN_HEX['color-surface-3']}`;

function provCells(p: Provenance): string[] {
  return [evidenceLabel(p), formatSources(p), p.d09Ref ?? ''];
}

/** シート名の制約（31 文字・禁止文字・重複不可）に合わせる */
export function sheetName(heading: string, index: number, used: ReadonlySet<string>): string {
  const base = `${index}_${heading}`.replace(/[\\/?*[\]:]/g, '_').replace(/^'+|'+$/g, '').slice(0, 31) || `${index}`;
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - `~${n}`.length)}~${n}`;
  return name;
}

function addRow(ws: ExcelJS.Worksheet, values: string[], p?: Provenance, header = false): void {
  const row = ws.addRow(values);
  if (header) {
    row.font = { bold: true };
    row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }));
  }
  // 根拠列は色で区別しない（深刻度ではない分類。区別は文字「事実/推測/不明」）
  void p;
  row.alignment = { vertical: 'top', wrapText: true };
}

function writeBlock(ws: ExcelJS.Worksheet, block: Block): void {
  switch (block.type) {
    case 'paragraph':
      addRow(ws, ['段落', block.text, ...provCells(block)], block);
      break;
    case 'list':
      for (const { depth, item } of flattenItems(block.items)) {
        addRow(ws, [block.ordered ? '番号付き列挙' : '列挙', `${'  '.repeat(depth)}${item.text}`, ...provCells(item)], item);
      }
      break;
    case 'diagram':
      addRow(ws, [`${block.title}（辺の一覧）`], undefined, true);
      addRow(ws, [...DIAGRAM_EDGE_COLUMNS, ...PROV_COLUMNS], undefined, true);
      for (const r of diagramEdgeRows(block)) addRow(ws, [...r, ...provCells(block.provenance)], block.provenance);
      break;
    case 'table':
      if (block.caption) addRow(ws, [block.caption], undefined, true);
      addRow(ws, [...block.columns, ...PROV_COLUMNS], undefined, true);
      for (const r of block.rows) addRow(ws, [...r.cells, ...provCells(r)], r);
      break;
  }
  ws.addRow([]);
}

export async function renderXlsx(doc: Document): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.title = `${doc.id} ${doc.title}`;
  const used = new Set<string>(['文書情報']);
  const info = wb.addWorksheet('文書情報');
  addRow(info, ['文書', `${doc.id} ${doc.title}`], undefined, true);
  addRow(info, ['節の数', String(doc.sections.length)]);
  const src = doc.revision.at(-1)?.source;
  if (src) addRow(info, ['入力元', src]);
  addRow(info, []);
  addRow(info, ['生成日時', 'コミット', '変更した節'], undefined, true);
  for (const r of doc.revision) addRow(info, [r.generatedAt, r.commit ?? '', r.changedSections.join(', ')]);
  info.columns.forEach((c) => (c.width = 30));

  doc.sections.forEach((s, i) => {
    const name = sheetName(s.heading, i + 1, used);
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name);
    addRow(ws, [s.heading], undefined, true);
    const blocks = s.blocks;
    if (blocks.some((b) => b.type !== 'table')) addRow(ws, ['種別', '内容', ...PROV_COLUMNS], undefined, true);
    for (const b of blocks) writeBlock(ws, b);
    ws.columns.forEach((c) => (c.width = 28));
  });
  const data = await wb.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}
