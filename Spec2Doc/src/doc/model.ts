// 契約 2: 文書モデル。generate が作り、render が 4 形式（md・html・docx・xlsx）に変換する。
// 各段落・各行は根拠ラベル（事実/推測/不明）と根拠位置を必ず持つ（REQ-F-017）。

import type { Evidence, SourceRef } from '../ir/schema.ts';

export type DocId = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09' | 'D11' | 'D12' | 'D13';

export const ALL_DOC_IDS: readonly DocId[] = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D11', 'D12', 'D13'];

export const DOC_TITLES: Readonly<Record<DocId, string>> = {
  D01: '概要書',
  D02: '要求仕様書',
  D03: '画面仕様書',
  D04: 'データ仕様書',
  D05: 'データ連携仕様書',
  D06: '依存ライブラリ一覧',
  D07: '移行論点・技術的負債一覧',
  D08: '解析カバレッジ・追跡レポート',
  D09: '確認事項一覧',
  D11: '基本設計書',
  D12: '詳細設計書',
  D13: 'テスト観点表',
};

/** 根拠。evidence='inference' の source は LLM が参照したソース位置、'unknown' の d09Ref は D09 の番号 */
export interface Provenance {
  evidence: Evidence;
  source: SourceRef[];
  d09Ref?: string;
  /** 記述が指す IR 要素の id（D08 の追跡表に使う） */
  irIds?: string[];
  /** evidence='inference' の出どころ。'llm'=LLM の説明文／'analysis'=解析による対応付け（REQ-F-017） */
  origin?: 'llm' | 'analysis';
}

export interface ParagraphBlock extends Provenance {
  type: 'paragraph';
  text: string;
}

export interface TableRow extends Provenance {
  cells: string[];
}

export interface TableBlock {
  type: 'table';
  caption?: string;
  columns: string[];
  rows: TableRow[];
}

export interface ListItem extends Provenance {
  text: string;
  children?: ListItem[]; // AND/OR の入れ子の列挙（REQ-F-036）
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface DiagramNode {
  id: string;
  label: string;
  group?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

/** 図。html は SVG、md は mermaid、docx・xlsx は辺の一覧表で出す */
/** 図の中で点線で描くノードの group（画面外の遷移先など） */
export const EXTERNAL_GROUP = '画面外';

export interface DiagramBlock {
  type: 'diagram';
  title: string;
  diagramType: 'flow';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  provenance: Provenance;
}

export type Block = ParagraphBlock | TableBlock | ListBlock | DiagramBlock;

export interface Section {
  heading: string;
  level: 1 | 2 | 3 | 4;
  blocks: Block[];
}

/** 改版履歴の 1 行（REQ-F-035） */
export interface Revision {
  generatedAt: string;
  commit?: string;
  /** 入力元の表示（例「フォルダ: sample-app」「GitHub: owner/repo@main」）。絶対パスは含めない */
  source?: string;
  changedSections: string[];
}

export interface Document {
  id: DocId;
  title: string;
  sections: Section[];
  revision: Revision[];
}

export const EVIDENCE_LABELS: Readonly<Record<Evidence, string>> = {
  fact: '事実',
  inference: '推測',
  unknown: '不明',
};
