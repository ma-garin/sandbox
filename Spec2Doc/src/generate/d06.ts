// D06 依存ライブラリ一覧: パッケージ・版・読み込み元（REQ-F-015）。

import type { IR } from '../ir/schema.ts';
import type { DocId, Document } from '../doc/model.ts';
import { type GenCtx, hasFailedFiles, makeDocument, mergeProv, provOf, row, section, srcText, table, unknownProv, zeroResult } from './common.ts';

const ORIGIN: DocId = 'D06';

export function buildD06(ir: IR, ctx: GenCtx): Document {
  const rows = [...ir.dependencies]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((d) => {
      const base = provOf(d, ctx, ORIGIN, `依存 ${d.name}`);
      if (d.version !== null) {
        return row([d.id, d.name, d.version, d.loadedFrom, d.url ?? '—', srcText(d.source)], base);
      }
      const d09Ref = ctx.d09.register({
        key: `version:${d.id}`,
        topic: `${d.name} の版`,
        question: `${d.name} の版をソースから確定できない。使用している版を確認してください`,
        category: 'unknown-value',
        relatedIds: [d.id],
        source: d.source,
        origin: ORIGIN,
      });
      return row(
        [d.id, d.name, `版不明（${d09Ref}）`, d.loadedFrom, d.url ?? '—', srcText(d.source)],
        mergeProv([base, unknownProv(d09Ref, [d.id], d.source)]),
      );
    });
  return makeDocument(ORIGIN, ctx, [
    section('依存ライブラリ', 2, [
      rows.length > 0
        ? table(['依存ID', '名前', '版', '読み込み元', 'URL', '根拠位置'], rows)
        : zeroResult(ctx, ORIGIN, '依存ライブラリ', { uncertain: hasFailedFiles(ir) }),
    ]),
  ]);
}
