// D09 確認事項一覧: ソースから確定できなかった点（REQ-F-025）。
// 他の文書を作り終えた後に呼ぶ（登録簿 ctx.d09 に集まった事項を一覧にする）。

import type { IR } from '../ir/schema.ts';
import type { Document } from '../doc/model.ts';
import { type GenCtx, factProv, makeDocument, para, row, section, srcText, table } from './common.ts';

/** 区分コードの表示名。未知の区分は生の値を出す */
const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  'unknown-value': '値が不明',
  'undefined-transition': '定義なしの状態×契機',
  'unit-unknown': '単位不明',
  'magic-number': '意味の読み取れない定数',
  'parse-failure': '解析失敗',
  'unreachable-or-unknown-condition': '発生条件を確定できない',
  'dynamic-call': '動的な呼び出し',
  'zero-result': '検出なし（対象外か実装漏れか）',
  other: 'その他',
};

export function buildD09(ir: IR, ctx: GenCtx): Document {
  for (const u of ir.unknowns) ctx.d09.registerUnknown(u);
  const entries = ctx.d09.entries();
  const rows = entries.map((e) =>
    row(
      [
        e.no,
        CATEGORY_LABEL[String(e.category)] ?? String(e.category),
        e.topic ?? '',
        e.question ?? '',
        (e.origins && e.origins.length > 0 ? e.origins : [e.origin]).map((o) => (o === 'IR' ? '解析結果' : o)).join('、'),
        e.relatedIds.join(', '),
        srcText(e.source),
      ],
      e.resolved ? factProv([]) : { evidence: 'unknown', source: [...e.source], irIds: [...e.relatedIds], d09Ref: e.no },
    ),
  );
  return makeDocument('D09', ctx, [
    section('1. 確認事項一覧', 2, [
      rows.length > 0
        ? table(['No.', '分類', '事項', '確認したいこと', '参照元の文書', '関連ID', '根拠位置'], rows)
        : para('確認事項は 0 件（生成した文書に不明の記述が無い）', factProv([])),
    ]),
  ]);
}
