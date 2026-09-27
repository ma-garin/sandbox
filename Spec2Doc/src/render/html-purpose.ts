// HTML 文書のヘッダカードに出す情報（文書の目的の定型文・情報チップの集計）と、
// 冒頭の callout にまとめる注記（LLM 無効・設計意図）の取り出し。html.ts からだけ使う。

import type { Block, DocId, ParagraphBlock, Section } from '../doc/model.ts';
import { DESIGN_INTENT_NOTE_PREFIX, LLM_DISABLED_NOTE_PREFIX } from '../generate/notices.ts';
import { flattenItems } from './common.ts';

/** 文書ごとの目的（ヘッダカードのリード文。1〜2 文） */
export const DOC_PURPOSE: Readonly<Record<DocId, string>> = {
  D01: 'システムの構成・モジュール構成・機能の一覧・用語集を 1 つの文書にまとめ、詳しい文書を読む前に全体像をつかめるようにする。',
  D02: '機能ごとに、テスト設計に必要な 7 観点（機能・画面・業務ルール・境界・状態・エラー・用語）を並べる。',
  D03: '画面ごとに、一覧・画面遷移・表示する部品・入力項目の範囲・異常時の表示を、ソースの位置つきで並べる。',
  D04: 'データ項目の定義・レコードレイアウト・状態と遷移・使用制限と、CRUD 表による読み書き箇所の一覧を示す。',
  D05: '外部との連携の組ごとに、方向・タイミング・送受信するデータと、定期通信・異常と判断する条件を並べる。',
  D06: '依存しているライブラリと版、読み込んでいる箇所を一覧にし、更新・移行の影響範囲を見積もる材料にする。',
  D07: '未参照の関数・export、複雑度超過の関数、大域変数などの移行論点を根拠位置つきで並べ、変更影響分析で波及範囲を示す。',
  D08: '解析できたファイル・できなかったファイルの範囲と、各文書の記述とソース位置の対応・確度・自動度を示す。',
  D09: 'ソースから確定できず、保守者の確認が必要な事項を、番号をつけて一覧にする。',
  D11: 'システム方式・アーキテクチャ・モジュール構成・外部 I/F・非機能の実装方式を、ソースから復元できる範囲で示す。',
  D12: 'モジュール・クラス・関数ごとの一覧と入出力・処理フロー・呼び出しシーケンス・例外処理を、データ（D04）・連携（D05）と対応づけて示す。',
  D13: 'D02 の 7 観点を入力に、同値分割・境界値・デシジョンテーブル・状態遷移・エラー推測の各技法でテスト条件を導き、機能ごとに並べる。',
};

export function docPurpose(docId: string): string {
  return (DOC_PURPOSE as Record<string, string>)[docId] ?? '';
}

/** 冒頭の callout に移す注記（生成側の定型文の書き出し。本文からは除く。生成側と同じ定数を参照する） */
export const NOTICE_PREFIXES: readonly string[] = [LLM_DISABLED_NOTE_PREFIX, DESIGN_INTENT_NOTE_PREFIX];

function isNotice(b: Block): b is ParagraphBlock {
  return b.type === 'paragraph' && NOTICE_PREFIXES.some((p) => b.text.startsWith(p));
}

/** 注記の段落を取り出し、除いた節を新しい配列で返す（元の節は変えない）。同じ文の注記は 1 つにまとめる */
export function extractNotices(sections: readonly Section[]): { notices: ParagraphBlock[]; sections: Section[] } {
  const found = sections.flatMap((s) => s.blocks.filter(isNotice));
  const notices = found.filter((n, i) => found.findIndex((m) => m.text === n.text) === i);
  return { notices, sections: sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => !isNotice(b)) })) };
}

/** 根拠を持つ行（段落・箇条・表の行・図）の区分の集計 */
export function evidenceCounts(sections: readonly Section[]): { fact: number; total: number } {
  const evs = sections.flatMap((s) =>
    s.blocks.flatMap((b): string[] => {
      switch (b.type) {
        case 'paragraph':
          return [b.evidence];
        case 'list':
          return flattenItems(b.items).map((f) => f.item.evidence);
        case 'table':
          return b.rows.map((r) => r.evidence);
        case 'diagram':
          return [b.provenance.evidence];
      }
    }),
  );
  return { fact: evs.filter((e) => e === 'fact').length, total: evs.length };
}

/** 事実の割合の表示。例「82%（123/150 行）」。行が無ければ空文字 */
export function factRatioText(sections: readonly Section[]): string {
  const { fact, total } = evidenceCounts(sections);
  return total === 0 ? '' : `${Math.round((fact / total) * 100)}%（${fact}/${total} 行）`;
}

/** 節見出しの番号と本文。「1. 機能一覧」→ ['1', '機能一覧']。番号が無ければ既定の番号を使う */
export function splitHeadingNumber(heading: string, fallback: number): [string, string] {
  const m = /^(\d+(?:\.\d+)*)[.．]?\s+(.+)$/.exec(heading);
  return m ? [m[1]!, m[2]!] : [String(fallback), heading];
}
