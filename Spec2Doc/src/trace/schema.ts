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
  /** リンクの種類（市販ツールの satisfies / verifies 等に相当。表示は LINK_KIND_LABEL） */
  kind?: LinkKind;
  /** 要確認（suspect link）。前回の実行から根拠のソースまたは記述の内容が変わった対応 */
  suspect?: { since: string; reason: SuspectReason };
  /** 抜けを埋めるトレース先の候補（解析から推定。根拠付き。確定ではない） */
  candidates?: { nodeId: string; score: number; why: string }[];
}

export type LinkKind = 'describes' | 'satisfies' | 'verifies' | 'derives' | 'calls' | 'uses';
export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  describes: '記述する',
  satisfies: '満たす',
  verifies: '検証する',
  derives: '派生する',
  calls: '呼び出す',
  uses: '利用する',
};

/** content-changed=記述の内容が変わった／source-changed=根拠のソースが変わった／new=前回に無かった */
export type SuspectReason = 'content-changed' | 'source-changed' | 'new';
export const SUSPECT_REASON_LABEL: Record<SuspectReason, string> = {
  'content-changed': '記述の内容が前回から変わった',
  'source-changed': '根拠のソースが前回から変わった',
  new: '前回の実行に無かった対応',
};

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
  /** 確認者（承認した人の名前）と確認日時。status が unreviewed 以外になった時に記録 */
  reviewer?: string;
  reviewedAt?: string;
  /** コメントの履歴（追記のみ。1 件 2000 文字まで） */
  comments?: { at: string; by?: string; text: string }[];
}

/** 名前を付けて保存した絞り込み（管理表・マトリクス・関係図で共通） */
export interface SavedView {
  name: string;
  tab: 'graph' | 'matrix' | 'manage' | 'gaps' | 'compare';
  filters: Record<string, string>;
}

export interface TraceReview {
  version: typeof TRACE_VERSION;
  runId: string;
  reviews: Record<string, ReviewEntry>;
  savedViews?: SavedView[];
  /** 比較の基準として固定した実行（ベースライン） */
  baselineRunId?: string;
}

/** 変更の監査記録（サーバが trace-audit.jsonl に 1 行ずつ追記。改ざん防止のため追記のみ） */
export interface TraceAuditEvent {
  at: string;
  runId: string;
  linkId: string;
  field: 'status' | 'note' | 'comment' | 'reviewer' | 'baseline' | 'savedView';
  from?: string;
  to?: string;
  by?: string;
}

/** ベースラインとの比較の結果（GET /api/runs/<runId>/trace-compare?base=<runId>） */
export interface TraceCompare {
  baseRunId: string;
  runId: string;
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  unreviewed: '未確認',
  ok: '確認済み',
  ng: '要修正',
  na: '対象外',
};
