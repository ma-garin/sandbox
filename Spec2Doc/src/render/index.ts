// 出力層: 文書モデル → md・html・docx・xlsx（REQ-F-021）。4 形式とも根拠（evidence・source・d09Ref）を落とさない（REQ-F-017）。

import type { Document } from '../doc/model.ts';
import { toDisplayDoc } from './display-date.ts';
import { renderDocx } from './docx.ts';
import { renderHtml } from './html.ts';
import { renderMarkdown } from './md.ts';
import { renderXlsx } from './xlsx.ts';

export type Format = 'md' | 'html' | 'docx' | 'xlsx';

export const ALL_FORMATS: readonly Format[] = ['md', 'html', 'docx', 'xlsx'];

export async function render(source: Document, format: Format): Promise<Buffer> {
  const doc = toDisplayDoc(source); // 日時は表示形式（データは ISO のまま）
  switch (format) {
    case 'md':
      return Buffer.from(renderMarkdown(doc), 'utf8');
    case 'html':
      return Buffer.from(renderHtml(doc), 'utf8');
    case 'docx':
      return renderDocx(doc);
    case 'xlsx':
      return renderXlsx(doc);
    default:
      throw new Error(`未対応の出力形式です: ${String(format satisfies never)}`);
  }
}

export { formatProvenance, formatSourceRef } from './common.ts';
