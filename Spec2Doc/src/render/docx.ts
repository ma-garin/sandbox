// Word（.docx）出力。見出し・段落・表。表には「根拠」列、段落と列挙には根拠ラベルを付ける。

import {
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow as DocxTableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx';
import type { Block, Document, Provenance } from '../doc/model.ts';
import { flattenItems, formatProvenance, hasRevisionSection } from './common.ts';
import { DIAGRAM_EDGE_COLUMNS, diagramEdgeRows } from './diagram.ts';
import { TOKEN_HEX } from './tokens.ts';

/** 根拠ラベルは深刻度ではないため色で区別しない（中立の文字色。区別は文字「事実/推測/不明」） */
const EVIDENCE_COLORS: Readonly<Record<Provenance['evidence'], string>> = {
  fact: TOKEN_HEX['color-text-secondary'],
  inference: TOKEN_HEX['color-text-secondary'],
  unknown: TOKEN_HEX['color-text-secondary'],
};

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5] as const;

function labelRun(p: Provenance): TextRun {
  return new TextRun({ text: ` 〔${formatProvenance(p)}〕`, color: EVIDENCE_COLORS[p.evidence], size: 18 });
}

function cell(text: string, header = false, color?: string): TableCell {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: header, color })] })] });
}

function blockToDocx(block: Block): FileChild[] {
  switch (block.type) {
    case 'paragraph':
      return [new Paragraph({ children: [new TextRun(block.text), labelRun(block)] })];
    case 'list':
      return flattenItems(block.items).map(({ depth, item }, i) =>
        block.ordered
          ? new Paragraph({ indent: { left: 360 * (depth + 1) }, children: [new TextRun(`${i + 1}. ${item.text}`), labelRun(item)] })
          : new Paragraph({ bullet: { level: Math.min(depth, 8) }, children: [new TextRun(item.text), labelRun(item)] }),
      );
    case 'diagram': {
      // 図は描かず、辺の一覧表にする（全件）
      const p = block.provenance;
      const header = new DocxTableRow({ tableHeader: true, children: [...DIAGRAM_EDGE_COLUMNS, '根拠'].map((c) => cell(c, true)) });
      const rows = diagramEdgeRows(block).map(
        (r) => new DocxTableRow({ children: [...r.map((c) => cell(c)), cell(formatProvenance(p), false, EVIDENCE_COLORS[p.evidence])] }),
      );
      const cap = new Paragraph({ children: [new TextRun({ text: `${block.title}（辺の一覧）`, bold: true })] });
      return [cap, new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }), new Paragraph('')];
    }
    case 'table': {
      const header = new DocxTableRow({ tableHeader: true, children: [...block.columns, '根拠'].map((c) => cell(c, true)) });
      const rows = block.rows.map(
        (r) =>
          new DocxTableRow({
            children: [...r.cells.map((c) => cell(c)), cell(formatProvenance(r), false, EVIDENCE_COLORS[r.evidence])],
          }),
      );
      const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
      const cap = block.caption ? [new Paragraph({ children: [new TextRun({ text: block.caption, bold: true })] })] : [];
      return [...cap, table, new Paragraph('')];
    }
  }
}

export async function renderDocx(doc: Document): Promise<Buffer> {
  const children: FileChild[] = [new Paragraph({ text: `${doc.id} ${doc.title}`, heading: HeadingLevel.TITLE })];
  for (const s of doc.sections) {
    children.push(new Paragraph({ text: s.heading, heading: HEADINGS[s.level - 1] ?? HeadingLevel.HEADING_4 }));
    for (const b of s.blocks) children.push(...blockToDocx(b));
  }
  if (doc.revision.length > 0 && !hasRevisionSection(doc)) {
    children.push(new Paragraph({ text: '改版履歴', heading: HeadingLevel.HEADING_1 }));
    const src = doc.revision.at(-1)?.source;
    if (src) children.push(new Paragraph({ text: `入力元: ${src}` }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new DocxTableRow({ tableHeader: true, children: ['生成日時', 'コミット', '変更した節'].map((c) => cell(c, true)) }),
          ...doc.revision.map(
            (r) => new DocxTableRow({ children: [cell(r.generatedAt), cell(r.commit ?? ''), cell(r.changedSections.join(', '))] }),
          ),
        ],
      }),
    );
  }
  const file = new DocxDocument({
    title: `${doc.id} ${doc.title}`,
    styles: { default: { document: { run: { font: 'Yu Gothic' } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(file);
}
