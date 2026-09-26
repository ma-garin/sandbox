// Markdown 出力。表は GFM。各記述の末尾に根拠ラベルを付ける。

import type { Block, Document } from '../doc/model.ts';
import { flattenItems, formatProvenance, hasRevisionSection } from './common.ts';
import { renderDiagramMermaid, TRUNCATION_NOTE, selectForDiagram } from './diagram.ts';

function escapeCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function blockToMd(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `${block.text} 〔${formatProvenance(block)}〕`;
    case 'list':
      return flattenItems(block.items)
        .map(({ depth, item }, i) => `${'  '.repeat(depth)}${block.ordered ? `${i + 1}.` : '-'} ${item.text} 〔${formatProvenance(item)}〕`)
        .join('\n');
    case 'diagram': {
      const note = selectForDiagram(block.nodes, block.edges).truncated ? `\n\n${TRUNCATION_NOTE}` : '';
      return `**${block.title}** 〔${formatProvenance(block.provenance)}〕${note}\n\n${renderDiagramMermaid(block)}`;
    }
    case 'table': {
      const cols = [...block.columns, '根拠'];
      const lines = [
        `| ${cols.map(escapeCell).join(' | ')} |`,
        `| ${cols.map(() => '---').join(' | ')} |`,
        ...block.rows.map((r) => `| ${[...r.cells, formatProvenance(r)].map(escapeCell).join(' | ')} |`),
      ];
      return block.caption ? `**${block.caption}**\n\n${lines.join('\n')}` : lines.join('\n');
    }
  }
}

export function renderMarkdown(doc: Document): string {
  const out: string[] = [`# ${doc.id} ${doc.title}`];
  for (const s of doc.sections) {
    out.push(`${'#'.repeat(Math.min(s.level + 1, 6))} ${s.heading}`);
    for (const b of s.blocks) out.push(blockToMd(b));
  }
  if (doc.revision.length > 0 && !hasRevisionSection(doc)) {
    const rows = doc.revision.map(
      (r) => `| ${escapeCell(r.generatedAt)} | ${escapeCell(r.commit ?? '')} | ${escapeCell(r.changedSections.join(', '))} |`,
    );
    const src = doc.revision.at(-1)?.source;
    out.push('## 改版履歴', ...(src ? [`入力元: ${src}`] : []), ['| 生成日時 | コミット | 変更した節 |', '| --- | --- | --- |', ...rows].join('\n'));
  }
  return out.join('\n\n') + '\n';
}
