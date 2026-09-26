// 契約 1: 中間表現（IR）。言語に依存しない、版番号付きの JSON（REQ-F-019）。
// 文書の生成（generate）はこの型だけを入力にする。analyze はこの型を出力する。
// 変更するときは IR_VERSION を上げ、P1 各担当に知らせる。

export const IR_VERSION = '1.0.0';

/** 記述の確からしさ（REQ-F-017）。fact=ソースから確定 / inference=推測（LLM 等） / unknown=確定できない */
export type Evidence = 'fact' | 'inference' | 'unknown';

/** ソース上の位置。file は入力ルートからの相対パス（区切りは `/`）、line は 1 始まり */
export interface SourceRef {
  file: string;
  line: number;
  endLine?: number;
}

/** 全要素の共通部。id は入力が同じなら実行をまたいで変わらないこと（REQ-F-032） */
export interface IrNode {
  id: string;
  source: SourceRef[];
  evidence?: Evidence; // 省略時は 'fact'
}

// ---------- ファイル・構造 ----------

export type Language = 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'other';
export type FileStatus = 'analyzed' | 'failed' | 'excluded' | 'unsupported';

/** ファイル別の解析結果（REQ-F-002・004・005・023）。reason は失敗・除外・対象外の理由 */
export interface IrFile extends IrNode {
  path: string;
  language: Language;
  status: FileStatus;
  lines: number;
  reason?: string;
  /** 秘密情報を除外した位置と種別（REQ-F-018）。値は持たない */
  secrets?: { line: number; kind: string }[];
}

export interface Module extends IrNode {
  name: string;
  file: string;
  kind: 'script' | 'esmodule' | 'commonjs' | 'typescript';
}

export interface Param {
  name: string;
  type?: string;
  defaultValue?: string;
}

export interface FunctionInfo extends IrNode {
  name: string; // 無名関数は `<anonymous@file:line>`
  moduleId: string;
  classId?: string;
  params: Param[];
  returns?: string;
  complexity: number; // 循環的複雑度（REQ-F-024）
  calls: string[]; // 呼び出し先の FunctionInfo.id（解決できない名前はそのまま文字列）
  exported: boolean;
  refCount: number; // 他所からの参照回数。0 は未参照
  async: boolean;
  throws: string[]; // 送出する ErrorInfo.id
}

export interface ClassInfo extends IrNode {
  name: string;
  moduleId: string;
  extends?: string;
  methods: string[]; // FunctionInfo.id
  properties: { name: string; type?: string }[];
  exported: boolean;
  refCount: number;
}

export interface ImportInfo extends IrNode {
  moduleId: string;
  from: string; // 指定子（'./a.ts'・'react'）
  names: string[]; // 取り込む名前。副作用 import は []
  external: boolean;
}

export interface ExportInfo extends IrNode {
  moduleId: string;
  name: string;
  targetId?: string; // FunctionInfo/ClassInfo 等の id
  refCount: number;
}

/** イベントハンドラの登録（addEventListener・onclick 属性 等） */
export interface EventHandler extends IrNode {
  target: string; // セレクタまたは要素 ID
  uiElementId?: string;
  event: string; // 'click'・'submit' 等
  handler: string; // FunctionInfo.id または名前
}

// ---------- 画面 ----------

/** HTML ファイル単位の画面（REQ-F-007・032） */
export interface Screen extends IrNode {
  file: string;
  title: string;
  isErrorView: boolean; // 異常系の画面・表示（REQ-F-032）
  elementIds: string[]; // UiElement.id
}

export type UiKind = 'input' | 'select' | 'textarea' | 'button' | 'link' | 'form' | 'output' | 'other';

export interface UiElement extends IrNode {
  screenId: string;
  domId?: string; // HTML の id 属性
  name?: string;
  label?: string; // 画面に表示される語（REQ-F-022）
  kind: UiKind;
  inputType?: string;
  /** 制約属性（type・required・min・max・maxlength・pattern・step・value） */
  constraints: Record<string, string>;
  navigatesTo?: string; // 遷移先（href・action・location 代入）
  description?: string;
}

// ---------- 業務ルール・境界・状態・エラー ----------

/** AND/OR/NOT の条件木（REQ-F-036） */
export type Condition =
  | { op: 'and' | 'or'; items: Condition[] }
  | { op: 'not'; item: Condition }
  | { op: 'leaf'; text: string; source?: SourceRef };

export interface RuleCase {
  condition: Condition | null; // null は else / default
  result: string;
  source: SourceRef[];
}

/** 業務ルール（REQ-F-009）。条件→結果の表と計算式 */
export interface Rule extends IrNode {
  functionId?: string;
  name: string;
  kind: 'if' | 'switch' | 'ternary' | 'formula';
  cases: RuleCase[];
  formula?: string; // 算術式（kind='formula' または結果内）
}

/** 境界値（REQ-F-010・033・034） */
export interface Boundary extends IrNode {
  subject: string; // 対象（入力項目名・変数名）
  uiElementId?: string;
  bound: 'lower' | 'upper' | 'length' | 'pattern' | 'threshold' | 'timeout' | 'retry' | 'interval';
  value: string;
  inclusive: boolean | null; // null=該当しない（pattern 等）
  unit: string | null; // null=単位不明（D09 へ）
  insideExample: string;
  outsideExample: string;
  configurable: 'fixed' | 'config';
  configSource?: SourceRef; // configurable='config' のときの設定の位置
}

export interface StateTransition {
  from: string;
  trigger: string;
  condition?: string;
  to: string;
  action?: string;
  source: SourceRef[];
}

/** 状態変数と遷移（REQ-F-011） */
export interface StateMachine extends IrNode {
  variable: string; // 変数名またはクラス付与の対象
  mechanism: 'variable' | 'union-type' | 'enum-object' | 'classList';
  values: string[];
  initial?: string;
  transitions: StateTransition[];
}

/** エラー（REQ-F-012） */
export interface ErrorInfo extends IrNode {
  message: string; // 表示文言
  condition: string; // 発生条件
  afterState?: string; // 発生後の状態
  kind: 'throw' | 'display' | 'network' | 'validation';
  functionId?: string;
}

// ---------- 連携・データ ----------

/** 外部連携（REQ-F-013） */
export interface Integration extends IrNode {
  direction: 'outbound' | 'inbound';
  mechanism: 'fetch' | 'xhr' | 'axios' | 'express' | 'other';
  method: string;
  url: string;
  timing: string; // 契機（関数名・イベント）
  requestData?: string;
  response?: string;
  failureConditions: string[];
  timeoutMs?: number;
  retries?: number;
  functionId?: string;
}

export interface DataField {
  name: string;
  type?: string;
  length?: number; // 桁
  example?: string;
  optional?: boolean;
}

/** データ項目（REQ-F-014）。保存域のキー・型定義・レコードレイアウト */
export interface DataItem extends IrNode {
  kind: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'interface' | 'typeAlias' | 'layout';
  name: string; // キー名・型名
  fields: DataField[];
  separator?: string; // レイアウトの区切り文字
  example?: string;
}

/** 既定値・初期状態（REQ-F-037） */
export interface DefaultValue extends IrNode {
  subject: string;
  value: string;
  context: 'variable' | 'input' | 'config' | 'init';
  uiElementId?: string;
}

/** 依存ライブラリ（REQ-F-015） */
export interface Dependency extends IrNode {
  name: string;
  version: string | null;
  loadedFrom: 'package.json' | 'package.json(dev)' | 'cdn' | 'import';
  url?: string;
}

/** CSS 規則（REQ-F-008） */
export interface CssRule extends IrNode {
  kind: 'media' | 'stateClass';
  media?: { feature: string; value: string; inclusive: boolean };
  className?: string; // 状態クラス（is-error 等）
  selector: string;
  effect?: 'show' | 'hide' | 'other';
  declarations: Record<string, string>;
}

/** 大域変数（REQ-F-024） */
export interface GlobalVar extends IrNode {
  name: string;
  kind: 'var' | 'let' | 'const' | 'implicit' | 'window';
}

/** 確定できない事項。D09 へ送る（REQ-F-025） */
export interface Unknown extends IrNode {
  topic: string;
  question: string;
  relatedIds: string[];
  category: 'unknown-value' | 'undefined-transition' | 'unit-unknown' | 'magic-number' | 'parse-failure' | 'unreachable-or-unknown-condition' | 'dynamic-call' | 'other';
}

// ---------- 全体 ----------

export interface IrInput {
  kind: 'github' | 'folder' | 'files' | 'zip';
  label: string; // URL・パス（秘密情報を含めない）
  commit?: string;
}

export interface IR {
  irVersion: typeof IR_VERSION;
  generatedAt: string; // ISO 8601
  input: IrInput;
  files: IrFile[];
  modules: Module[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  eventHandlers: EventHandler[];
  screens: Screen[];
  uiElements: UiElement[];
  rules: Rule[];
  boundaries: Boundary[];
  states: StateMachine[];
  errors: ErrorInfo[];
  integrations: Integration[];
  dataItems: DataItem[];
  defaults: DefaultValue[];
  dependencies: Dependency[];
  cssRules: CssRule[];
  globals: GlobalVar[];
  unknowns: Unknown[];
}

/** 空の IR を作る。analyze の出発点・テスト用 */
export function emptyIr(input: IrInput, generatedAt: string = new Date().toISOString()): IR {
  return {
    irVersion: IR_VERSION,
    generatedAt,
    input,
    files: [],
    modules: [],
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    eventHandlers: [],
    screens: [],
    uiElements: [],
    rules: [],
    boundaries: [],
    states: [],
    errors: [],
    integrations: [],
    dataItems: [],
    defaults: [],
    dependencies: [],
    cssRules: [],
    globals: [],
    unknowns: [],
  };
}
