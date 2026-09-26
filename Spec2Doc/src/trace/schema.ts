/**
 * トレーサビリティの受け渡しの形（契約）。
 * - trace.json（TraceGraph）: 実行ごとに core が out/<runId>/ に書く。traceability.html はこれを埋め込んで描く
 * - trace-review.json（TraceReview）: 利用者が付けた確認状態。Web から保存し、次の実行へ linkId で引き継ぐ
 * 版を変えるときは TRACE_VERSION を上げ、読み手は知らない版を拒否する。
 */
import type { DocId } from '../doc/model.ts';
import type { Evidence } from '../ir/schema.ts';

export const TRACE_VERSION = '1';

/** 図の点の種類。folder → file → code（IR の要素）と、doc → section が、links でつながる */
export type TraceNodeKind = 'folder' | 'file' | 'code' | 'doc' | 'section';

export interface TraceNode {
  /** 種類の接頭辞付きで一意（例 folder:src/app, file:src/app/app.js, code:FN-app.js-init, doc:D02, section:D02/2.F-001） */
  id: string;
  kind: TraceNodeKind;
  label: string;
  /** 包含の親（folder / file / doc の id）。最上位は無し */
  parent?: string;
  /** folder / file: 入力元の相対パス（絶対パスは入れない） */
  path?: string;
  /** file: 解析の状態 */
  fileStatus?: 'analyzed' | 'failed' | 'excluded' | 'unsupported';
  /** code: IR の要素の種類（function, screen, uiElement, rule, boundary, state, error, integration, dataItem 等）と定義位置 */
  codeKind?: string;
  line?: number;
  /** doc / section */
  docId?: DocId;
}

/** 図の線の種類。contains=包含、documents=文書の節が IR 要素を記述、calls=呼び出し、uses=データ・画面部品の利用 */
export type TraceEdgeKind = 'contains' | 'documents' | 'calls' | 'uses';

export interface TraceEdge {
  from: string;
  to: string;
  kind: TraceEdgeKind;
  /** 線のラベル（uses のデータ操作 C/R/U/D、画面部品のイベント名など）。無ければ描かない */
  label?: string;
}

/** 管理の単位。文書の 1 行（段落・表の行・列挙の項目）と、その根拠のソース位置の対応 */
export interface TraceLink {
  /** 行番号を除いた内容から作る安定なハッシュ（再実行で同じ対応なら同じ id。差分機能と同じ正規化を使う） */
  id: string;
  docId: DocId;
  /** 節の見出しの連なり（例「2. 機能ごとの仕様 / F-001 init / F-001-4 入力値の範囲／境界」） */
  section: string;
  /** 節ノードの id（TraceNode.id） */
  sectionNodeId: string;
  /** 行の要約（80 文字以内） */
  summary: string;
  evidence: Evidence;
  /** 推測の出どころ（Provenance.origin） */
  origin?: 'llm' | 'analysis';
  d09Ref?: string;
  sources: { file: string; line?: number }[];
  irIds: string[];
}

export interface TraceGraph {
  version: typeof TRACE_VERSION;
  runId: string;
  /** 表示用の入力元（例「フォルダ: sample-app」） */
  source?: string;
  generatedAt: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  links: TraceLink[];
}

export type ReviewStatus = 'unreviewed' | 'ok' | 'ng' | 'na';

export interface ReviewEntry {
  status: ReviewStatus;
  /** 利用者のメモ（2000 文字まで。サーバは超過を拒否） */
  note?: string;
  updatedAt: string;
  /** 前回の実行から引き継いだ場合の元の実行 ID */
  carriedFrom?: string;
}

export interface TraceReview {
  version: typeof TRACE_VERSION;
  runId: string;
  reviews: Record<string, ReviewEntry>;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  unreviewed: '未確認',
  ok: '確認済み',
  ng: '要修正',
  na: '対象外',
};
