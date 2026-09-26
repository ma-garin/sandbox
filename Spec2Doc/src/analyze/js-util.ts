// JS/TS 解析の共通部品: 出力の器・ID・位置・文字列化・条件木・定数の解決。
import ts from 'typescript';
import type { Condition, IR, SourceRef } from '../ir/schema.ts';

export type JsOut = Pick<
  IR,
  | 'modules'
  | 'functions'
  | 'classes'
  | 'imports'
  | 'exports'
  | 'eventHandlers'
  | 'rules'
  | 'boundaries'
  | 'states'
  | 'errors'
  | 'integrations'
  | 'dataItems'
  | 'defaults'
  | 'globals'
  | 'unknowns'
>;

export const OUT_KEYS = [
  'modules',
  'functions',
  'classes',
  'imports',
  'exports',
  'eventHandlers',
  'rules',
  'boundaries',
  'states',
  'errors',
  'integrations',
  'dataItems',
  'defaults',
  'globals',
  'unknowns',
] as const satisfies readonly (keyof JsOut)[];

export function newOut(): JsOut {
  return {
    modules: [],
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    eventHandlers: [],
    rules: [],
    boundaries: [],
    states: [],
    errors: [],
    integrations: [],
    dataItems: [],
    defaults: [],
    globals: [],
    unknowns: [],
  };
}

/** 1 ファイル分の解析文脈 */
export interface FileCtx {
  readonly file: string;
  readonly sf: ts.SourceFile;
  readonly moduleId: string;
  readonly out: JsOut;
  readonly ids: Set<string>;
  readonly fnIds: Map<ts.Node, string>;
  readonly fnNames: Map<ts.Node, string>;
  readonly classIds: Map<ts.Node, string>;
  readonly consts: Map<string, ts.Expression>;
  readonly refs: Map<string, number>;
  readonly netFns: Set<string>;
  readonly stateAfterFn: Map<string, string>;
  /** 単位の読めない数値（ファイル末尾で unknowns 1 件に集約） */
  readonly numbers: { label: string; line: number; value: string; category: 'unit-unknown' | 'magic-number'; relatedId?: string }[];
}

export function fileKey(file: string): string {
  return file.replace(/[^A-Za-z0-9_.-]+/g, '_');
}

function safe(name: string): string {
  const s = name.replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 60);
  return s === '' ? '_' : s;
}

/** 安定 ID: <PREFIX>-<file>-<name>。重複時は行番号、さらに連番を付ける */
export function makeId(ctx: FileCtx, prefix: string, name: string, line: number): string {
  const base = `${prefix}-${fileKey(ctx.file)}-${safe(name)}`;
  let id = base;
  if (ctx.ids.has(id)) id = `${base}-L${line}`;
  let n = 2;
  while (ctx.ids.has(id)) id = `${base}-L${line}-${n++}`;
  ctx.ids.add(id);
  return id;
}

export function lineOf(ctx: FileCtx, node: ts.Node): number {
  return ctx.sf.getLineAndCharacterOfPosition(node.getStart(ctx.sf)).line + 1;
}

export function srcOf(ctx: FileCtx, node: ts.Node): SourceRef {
  const line = lineOf(ctx, node);
  const endLine = ctx.sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
  return endLine > line ? { file: ctx.file, line, endLine } : { file: ctx.file, line };
}

export function pointOf(ctx: FileCtx, node: ts.Node): SourceRef {
  return { file: ctx.file, line: lineOf(ctx, node) };
}

export function textOf(ctx: FileCtx, node: ts.Node, max = 160): string {
  const t = node.getText(ctx.sf).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function unparen(e: ts.Expression): ts.Expression {
  let cur = e;
  while (ts.isParenthesizedExpression(cur)) cur = cur.expression;
  return cur;
}

export function isFnLike(n: ts.Node): n is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  );
}

export function isAssign(n: ts.Node): n is ts.BinaryExpression {
  return ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken;
}

export function isStrLit(e: ts.Node): e is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e);
}

export function walk(root: ts.Node, visit: (n: ts.Node) => void): void {
  const rec = (n: ts.Node): void => {
    visit(n);
    ts.forEachChild(n, rec);
  };
  rec(root);
}

/** 入れ子の関数には降りない走査 */
export function walkBody(root: ts.Node | undefined, visit: (n: ts.Node) => void): void {
  if (!root) return;
  const rec = (n: ts.Node): void => {
    visit(n);
    ts.forEachChild(n, (c) => {
      if (!isFnLike(c)) rec(c);
    });
  };
  rec(root);
}

export function enclosingFn(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  for (let p = node.parent; p; p = p.parent) if (isFnLike(p)) return p;
  return undefined;
}

export function fnIdOf(ctx: FileCtx, node: ts.Node): string | undefined {
  const fn = enclosingFn(node);
  return fn ? ctx.fnIds.get(fn) : undefined;
}

export function fnNameOf(ctx: FileCtx, node: ts.Node): string {
  const fn = enclosingFn(node);
  return (fn && ctx.fnNames.get(fn)) ?? 'トップレベル';
}

/** 呼び出し先の末尾の名前（a.b.c() なら c） */
export function calleeName(call: ts.CallExpression): string {
  const c = call.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return '';
}

export function toCondition(ctx: FileCtx, expr: ts.Expression): Condition {
  const e = unparen(expr);
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken) {
      const op = k === ts.SyntaxKind.AmpersandAmpersandToken ? 'and' : 'or';
      const items = [e.left, e.right].flatMap((side) => {
        const c = toCondition(ctx, side);
        return c.op === op ? (c as { items: Condition[] }).items : [c];
      });
      return { op, items };
    }
  }
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) {
    return { op: 'not', item: toCondition(ctx, e.operand) };
  }
  return { op: 'leaf', text: textOf(ctx, e), source: pointOf(ctx, e) };
}

/** 文字列の組み立てを「リテラル＋{式}」で表す。定数は値に置き換える */
export function evalString(ctx: FileCtx, expr: ts.Expression, depth = 0): string {
  const e = unparen(expr);
  if (isStrLit(e)) return e.text;
  if (ts.isTemplateExpression(e)) {
    // 埋め込み式も + 連結と同じく、モジュール最上位の const 文字列は値に置き換え、それ以外は {式} で残す
    return e.head.text + e.templateSpans.map((s) => `${evalString(ctx, s.expression, depth + 1)}${s.literal.text}`).join('');
  }
  if (ts.isIdentifier(e) && depth < 3) {
    const c = ctx.consts.get(e.text);
    if (c && isStringy(ctx, c)) return evalString(ctx, c, depth + 1);
    return `{${e.text}}`;
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return evalString(ctx, e.left, depth) + evalString(ctx, e.right, depth);
  }
  return `{${textOf(ctx, e, 40)}}`;
}

/**
 * URL の組み立てを値に解決する。モジュール最上位の const 文字列は値に、実行時にしか決まらない部分は {名前} にする。
 * 名前は識別子名（a.b なら b）。関数呼び出しで包まれていれば（encodeURIComponent(id) 等）中の引数の名前
 */
export function evalUrl(ctx: FileCtx, expr: ts.Expression, depth = 0): string {
  const e = unparen(expr);
  if (isStrLit(e)) return e.text;
  if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => `${evalUrl(ctx, s.expression, depth + 1)}${s.literal.text}`).join('');
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return evalUrl(ctx, e.left, depth) + evalUrl(ctx, e.right, depth);
  if (ts.isIdentifier(e)) {
    const c = depth < 3 ? ctx.consts.get(e.text) : undefined;
    return c && isStringy(ctx, c) ? evalUrl(ctx, c, depth + 1) : `{${e.text}}`;
  }
  if (ts.isPropertyAccessExpression(e)) return `{${e.name.text}}`;
  if (ts.isCallExpression(e) && e.arguments[0] && depth < 5) return evalUrl(ctx, e.arguments[0], depth + 1);
  return `{${textOf(ctx, e, 40)}}`;
}

/** 文字列リテラルを含む式（+ 連結・テンプレート・文字列定数） */
export function isStringy(ctx: FileCtx, expr: ts.Expression, depth = 0): boolean {
  const e = unparen(expr);
  if (isStrLit(e) || ts.isTemplateExpression(e)) return true;
  if (ts.isIdentifier(e) && depth < 3) {
    const c = ctx.consts.get(e.text);
    return c !== undefined && isStringy(ctx, c, depth + 1);
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return isStringy(ctx, e.left, depth) || isStringy(ctx, e.right, depth);
  }
  return false;
}

export interface NumRef {
  value: number;
  constName?: string;
  constNode?: ts.Node;
}

export function resolveNumber(ctx: FileCtx, expr: ts.Expression, depth = 0): NumRef | undefined {
  const e = unparen(expr);
  if (ts.isNumericLiteral(e)) return { value: Number(e.text.replace(/_/g, '')) };
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(e.operand)) {
    return { value: -Number(e.operand.text.replace(/_/g, '')) };
  }
  if (ts.isIdentifier(e) && depth < 3) {
    const c = ctx.consts.get(e.text);
    const r = c ? resolveNumber(ctx, c, depth + 1) : undefined;
    if (r) return { value: r.value, constName: e.text, constNode: c };
  }
  return undefined;
}

export function fmtNum(n: number): string {
  return String(Number(n.toFixed(6)));
}

/** 名前から読める単位だけを返す。読めなければ null（D09 へ） */
export function unitFromName(name: string): string | null {
  if (/(_ms|Ms|MS|millis\w*)$/.test(name) || /millisec/i.test(name)) return 'ms';
  if (/(_sec|Sec|SEC|_seconds|Seconds|SECONDS)$/.test(name)) return '秒';
  if (/retr|attempt/i.test(name)) return '回';
  return null;
}

/** 設定値から読む式か（config.x・settings.x・process.env.X 等） */
export function isConfigExpr(ctx: FileCtx, expr: ts.Expression, depth = 0): boolean {
  const e = unparen(expr);
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
    return /\b(config|conf|settings|options|opts|env)\b/i.test(textOf(ctx, e));
  }
  if (ts.isIdentifier(e) && depth < 3) {
    const c = ctx.consts.get(e.text);
    return c !== undefined && isConfigExpr(ctx, c, depth + 1);
  }
  return false;
}

/** 近い分岐条件（if・case・catch・三項）を文にする。関数の外へは出ない */
export function conditionAbove(ctx: FileCtx, node: ts.Node): string | undefined {
  let n: ts.Node = node;
  for (let p = n.parent; p; n = p, p = p.parent) {
    if (isFnLike(p)) return undefined;
    if (ts.isIfStatement(p)) {
      if (n === p.thenStatement) return textOf(ctx, p.expression);
      if (n === p.elseStatement) return `${textOf(ctx, p.expression)} ではない`;
    }
    if (ts.isCaseClause(p)) return `${textOf(ctx, p.parent.parent.expression)} === ${textOf(ctx, p.expression)}`;
    if (ts.isDefaultClause(p)) return `${textOf(ctx, p.parent.parent.expression)} がどの case にも該当しない`;
    if (ts.isCatchClause(p)) return '例外を捕捉したとき';
    if (ts.isConditionalExpression(p)) {
      if (n === p.whenTrue) return textOf(ctx, p.condition);
      if (n === p.whenFalse) return `${textOf(ctx, p.condition)} ではない`;
    }
  }
  return undefined;
}

/** 同じ関数（なければファイル）内の変数宣言の初期値 */
export function localInit(id: ts.Identifier): ts.Expression | undefined {
  const scope: ts.Node = enclosingFn(id)?.body ?? id.getSourceFile();
  let found: ts.Expression | undefined;
  walk(scope, (n) => {
    if (!found && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === id.text && n.initializer) {
      found = n.initializer;
    }
  });
  return found;
}

/** 要素を指す式を読みやすく（getElementById('x') → #x） */
export function describeTarget(ctx: FileCtx, expr: ts.Expression, depth = 0): string {
  const e = unparen(expr);
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
    const m = e.expression.name.text;
    const a = e.arguments[0];
    if (a && isStrLit(a)) {
      if (m === 'getElementById') return `#${a.text}`;
      if (m === 'querySelector' || m === 'querySelectorAll') return a.text;
    }
  }
  if (ts.isIdentifier(e) && depth < 3) {
    const init = localInit(e);
    if (init && init !== e) return describeTarget(ctx, init, depth + 1);
  }
  return textOf(ctx, e, 60);
}
