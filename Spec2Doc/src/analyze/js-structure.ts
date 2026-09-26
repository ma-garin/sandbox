// JS/TS の構造: モジュール・関数・クラス・import/export・呼び出し・イベント登録・大域変数（REQ-F-006・024）。
import ts from 'typescript';
import type { ClassInfo, EventHandler, FunctionInfo, Module, Param, Unknown } from '../ir/schema.ts';
import {
  type FileCtx,
  calleeName,
  describeTarget,
  isAssign,
  isFnLike,
  isStrLit,
  lineOf,
  makeId,
  srcOf,
  textOf,
  unparen,
  walk,
  walkBody,
} from './js-util.ts';

export function moduleKind(file: string, sf: ts.SourceFile): Module['kind'] {
  if (/\.(ts|tsx|mts|cts)$/.test(file)) return 'typescript';
  if (ts.isExternalModule(sf)) return 'esmodule';
  if (/\brequire\s*\(|module\.exports|\bexports\.\w+\s*=/.test(sf.text)) return 'commonjs';
  return 'script';
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

function isDeclName(id: ts.Identifier): boolean {
  const p = id.parent as ts.Node & { name?: ts.Node };
  if (p.name !== id) return false;
  return (
    ts.isFunctionDeclaration(p) ||
    ts.isFunctionExpression(p) ||
    ts.isClassDeclaration(p) ||
    ts.isClassExpression(p) ||
    ts.isMethodDeclaration(p) ||
    ts.isGetAccessorDeclaration(p) ||
    ts.isSetAccessorDeclaration(p) ||
    ts.isVariableDeclaration(p) ||
    ts.isParameter(p) ||
    ts.isPropertyAssignment(p) ||
    ts.isPropertyDeclaration(p) ||
    ts.isPropertySignature(p) ||
    ts.isInterfaceDeclaration(p) ||
    ts.isTypeAliasDeclaration(p) ||
    ts.isEnumDeclaration(p) ||
    ts.isEnumMember(p) ||
    ts.isImportSpecifier(p) ||
    ts.isImportClause(p) ||
    ts.isNamespaceImport(p) ||
    ts.isExportSpecifier(p) ||
    ts.isBindingElement(p)
  );
}

function fnDeclaredName(ctx: FileCtx, node: ts.FunctionLikeDeclaration): string | undefined {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) return node.name.text;
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    return node.name.getText(ctx.sf);
  }
  const p = node.parent;
  if (ts.isVariableDeclaration(p) && p.initializer === node && ts.isIdentifier(p.name)) return p.name.text;
  if (ts.isPropertyAssignment(p) && p.initializer === node) return p.name.getText(ctx.sf);
  if (ts.isPropertyDeclaration(p) && p.initializer === node) return p.name.getText(ctx.sf);
  if (isAssign(p) && p.right === node) return textOf(ctx, p.left, 60);
  return undefined;
}

function complexityOf(node: ts.FunctionLikeDeclaration): number {
  let c = 1;
  walkBody(node.body, (n) => {
    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
        c++;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const k = (n as ts.BinaryExpression).operatorToken.kind;
        if (
          k === ts.SyntaxKind.AmpersandAmpersandToken ||
          k === ts.SyntaxKind.BarBarToken ||
          k === ts.SyntaxKind.QuestionQuestionToken
        ) {
          c++;
        }
        break;
      }
      default:
        break;
    }
  });
  return c;
}

function callsOf(ctx: FileCtx, node: ts.FunctionLikeDeclaration): string[] {
  const calls: string[] = [];
  walkBody(node.body, (n) => {
    if (!ts.isCallExpression(n)) return;
    const c = n.expression;
    const name = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? textOf(ctx, c, 80) : '';
    if (name !== '' && !calls.includes(name)) calls.push(name);
  });
  return calls;
}

const NOT_UI = new Set(['target', 'currentTarget', 'elements', 'style', 'dataset', 'classList', 'parentNode', 'parentElement']);
const VALUE_PROPS = /^(value|valueAsNumber|valueAsDate|checked|files|selectedIndex)$/;

/** 追加欄（schema 外）: 関数本体（入れ子関数を含む）が読む画面部品の id/name。文字列リテラルで特定できるものだけ */
function readsUiIds(node: ts.FunctionLikeDeclaration): string[] {
  const ids: string[] = [];
  const add = (x: string): void => {
    if (x !== '' && !ids.includes(x)) ids.push(x);
  };
  if (!node.body) return ids;
  walk(node.body, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      const a = n.arguments[0];
      if (!a || !isStrLit(a)) return;
      if (m === 'getElementById' || m === 'getElementsByName') add(a.text);
      else if (m === 'namedItem' && /(^|\.)elements$/.test(n.expression.expression.getText())) add(a.text);
      else if (m === 'querySelector' || m === 'querySelectorAll') {
        const id = /^#([\w-]+)$/.exec(a.text.trim())?.[1] ?? /^\[name=["']?([\w-]+)["']?\]$/.exec(a.text.trim())?.[1];
        if (id) add(id);
      }
    } else if (ts.isPropertyAccessExpression(n)) {
      // form.elements.x / form.elements['x']
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'elements') add(n.name.text);
      // form.x.value・e.target.x.checked 等（A は識別子か *.target）
      const inner = n.expression;
      if (VALUE_PROPS.test(n.name.text) && ts.isPropertyAccessExpression(inner) && !NOT_UI.has(inner.name.text)) {
        const a = inner.expression;
        const base = ts.isIdentifier(a) || (ts.isPropertyAccessExpression(a) && /^(target|currentTarget|form)$/.test(a.name.text));
        if (base && !(ts.isIdentifier(a) && /^(document|window|this)$/.test(a.text))) add(inner.name.text);
      }
    } else if (ts.isElementAccessExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'elements') {
      if (isStrLit(n.argumentExpression)) add(n.argumentExpression.text);
    }
  });
  return ids;
}

function registerClass(ctx: FileCtx, node: ts.ClassLikeDeclaration): void {
  const line = lineOf(ctx, node);
  const p = node.parent;
  const name =
    node.name?.text ??
    (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : `<anonymous-class@${ctx.file}:${line}>`);
  const id = makeId(ctx, 'CLS', node.name || ts.isVariableDeclaration(p) ? name : `anonymous-L${line}`, line);
  ctx.classIds.set(node, id);
  const ext = node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0];
  const info: ClassInfo = {
    id,
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    name,
    moduleId: ctx.moduleId,
    extends: ext ? textOf(ctx, ext) : undefined,
    methods: [],
    properties: node.members.filter(ts.isPropertyDeclaration).map((m) => ({
      name: m.name.getText(ctx.sf),
      type: m.type ? textOf(ctx, m.type) : undefined,
    })),
    exported: hasModifier(node, ts.SyntaxKind.ExportKeyword),
    refCount: 0,
  };
  ctx.out.classes.push(info);
}

function registerFunction(ctx: FileCtx, node: ts.FunctionLikeDeclaration): void {
  const line = lineOf(ctx, node);
  const declared = fnDeclaredName(ctx, node);
  const name = declared ?? `<anonymous@${ctx.file}:${line}>`;
  const classId = ts.isClassLike(node.parent) ? ctx.classIds.get(node.parent) : undefined;
  const cls = classId ? ctx.out.classes.find((c) => c.id === classId) : undefined;
  const idName = declared ? (cls ? `${cls.name}.${declared}` : declared) : `anonymous-L${line}`;
  const id = makeId(ctx, 'FN', idName, line);
  ctx.fnIds.set(node, id);
  ctx.fnNames.set(node, name);
  const params: Param[] = node.parameters.map((p) => ({
    name: p.name.getText(ctx.sf),
    type: p.type ? textOf(ctx, p.type) : undefined,
    defaultValue: p.initializer ? textOf(ctx, p.initializer) : undefined,
  }));
  const info: FunctionInfo & { readsUiIds: string[] } = {
    readsUiIds: readsUiIds(node),
    id,
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    name,
    moduleId: ctx.moduleId,
    classId,
    params,
    returns: node.type ? textOf(ctx, node.type) : undefined,
    complexity: complexityOf(node),
    calls: callsOf(ctx, node),
    exported: hasModifier(node, ts.SyntaxKind.ExportKeyword),
    refCount: declared ? 0 : 1, // 無名関数はその場で渡されている
    async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    throws: [],
  };
  ctx.out.functions.push(info);
  cls?.methods.push(id);
}

/** 1 巡目: 定数・クラス・関数・識別子の参照回数 */
export function collectDeclarations(ctx: FileCtx): void {
  for (const st of ctx.sf.statements) {
    if (!ts.isVariableStatement(st) || (st.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) ctx.consts.set(d.name.text, d.initializer);
    }
  }
  walk(ctx.sf, (n) => {
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) registerClass(ctx, n);
    else if (isFnLike(n) && n.body) registerFunction(ctx, n);
    else if (ts.isIdentifier(n) && !isDeclName(n)) ctx.refs.set(n.text, (ctx.refs.get(n.text) ?? 0) + 1);
  });
}

function addImport(ctx: FileCtx, node: ts.Node, from: string, names: string[]): void {
  const line = lineOf(ctx, node);
  ctx.out.imports.push({
    id: makeId(ctx, 'IMP', from, line),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    moduleId: ctx.moduleId,
    from,
    names,
    external: !/^[./]/.test(from),
  });
}

function localTarget(ctx: FileCtx, name: string): string | undefined {
  return (
    ctx.out.functions.find((f) => f.name === name && f.moduleId === ctx.moduleId && !f.classId)?.id ??
    ctx.out.classes.find((c) => c.name === name && c.moduleId === ctx.moduleId)?.id
  );
}

function addExport(ctx: FileCtx, node: ts.Node, name: string, targetId?: string): void {
  ctx.out.exports.push({
    id: makeId(ctx, 'EXP', name, lineOf(ctx, node)),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    moduleId: ctx.moduleId,
    name,
    targetId,
    refCount: 0,
  });
}

function addHandler(ctx: FileCtx, node: ts.Node, target: string, event: string, handlerExpr?: ts.Expression): void {
  const h = handlerExpr ? unparen(handlerExpr) : undefined;
  const handler = h ? ((isFnLike(h) ? ctx.fnIds.get(h) : undefined) ?? textOf(ctx, h, 80)) : '(不明)';
  const fnNode = h && isFnLike(h) ? h : h && ts.isIdentifier(h) ? [...ctx.fnNames].find(([, name]) => name === h.text)?.[0] : undefined;
  // 追加欄（schema 外）: ハンドラ本体が引数の event に preventDefault() を呼ぶか。関数が読めなければ載せない
  const entry: EventHandler & { preventsDefault?: boolean } = {
    id: makeId(ctx, 'EVT', `${target}-${event}`, lineOf(ctx, node)),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    target,
    event,
    handler,
  };
  if (fnNode && isFnLike(fnNode)) entry.preventsDefault = preventsDefault(fnNode);
  ctx.out.eventHandlers.push(entry);
}

function preventsDefault(fn: ts.FunctionLikeDeclaration): boolean {
  const p = fn.parameters[0];
  if (!p || !ts.isIdentifier(p.name)) return false;
  const name = p.name.text;
  let hit = false;
  walkBody(fn.body, (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'preventDefault' &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === name
    ) {
      hit = true;
    }
  });
  return hit;
}

function addGlobal(ctx: FileCtx, node: ts.Node, name: string, kind: 'var' | 'let' | 'const' | 'window'): void {
  if (ctx.out.globals.some((g) => g.name === name)) return;
  ctx.out.globals.push({
    id: makeId(ctx, 'GLB', name, lineOf(ctx, node)),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    name,
    kind,
  });
}

function exportsOfStatement(ctx: FileCtx, st: ts.Statement): void {
  if (!hasModifier(st, ts.SyntaxKind.ExportKeyword)) return;
  const isDefault = hasModifier(st, ts.SyntaxKind.DefaultKeyword);
  if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) {
    const target = ts.isFunctionDeclaration(st) ? ctx.fnIds.get(st) : ctx.classIds.get(st);
    addExport(ctx, st, isDefault ? 'default' : (st.name?.text ?? 'default'), target);
  } else if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      const init = d.initializer ? unparen(d.initializer) : undefined;
      addExport(ctx, d, d.name.text, init && isFnLike(init) ? ctx.fnIds.get(init) : undefined);
    }
  } else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) {
    addExport(ctx, st, st.name.text);
  }
}

function onCall(ctx: FileCtx, n: ts.CallExpression): void {
  const a0 = n.arguments[0];
  if (ts.isIdentifier(n.expression) && n.expression.text === 'require' && a0 && isStrLit(a0)) {
    const p = n.parent;
    const names =
      ts.isVariableDeclaration(p) && ts.isObjectBindingPattern(p.name)
        ? p.name.elements.map((e) => (e.propertyName ?? e.name).getText(ctx.sf))
        : ['default'];
    addImport(ctx, n, a0.text, names);
  } else if (n.expression.kind === ts.SyntaxKind.ImportKeyword && a0 && isStrLit(a0)) {
    addImport(ctx, n, a0.text, []);
  } else if (calleeName(n) === 'addEventListener' && ts.isPropertyAccessExpression(n.expression) && a0) {
    const event = isStrLit(a0) ? a0.text : textOf(ctx, a0);
    addHandler(ctx, n, describeTarget(ctx, n.expression.expression), event, n.arguments[1]);
  }
}

function onAssign(ctx: FileCtx, n: ts.BinaryExpression): void {
  const left = n.left;
  if (!ts.isPropertyAccessExpression(left)) return;
  const prop = left.name.text;
  const obj = textOf(ctx, left.expression);
  if (/^on[a-z]+$/.test(prop)) addHandler(ctx, n, describeTarget(ctx, left.expression), prop.slice(2), n.right);
  else if (obj === 'window' || obj === 'globalThis') addGlobal(ctx, n, prop, 'window');
  if (obj === 'module' && prop === 'exports') {
    const r = unparen(n.right);
    if (ts.isObjectLiteralExpression(r)) {
      for (const p of r.properties) if (p.name) addExport(ctx, p, p.name.getText(ctx.sf), localTarget(ctx, p.name.getText(ctx.sf)));
    } else {
      addExport(ctx, n, 'module.exports', ts.isIdentifier(r) ? localTarget(ctx, r.text) : isFnLike(r) ? ctx.fnIds.get(r) : undefined);
    }
  } else if (obj === 'exports' || obj === 'module.exports') {
    const r = unparen(n.right);
    addExport(ctx, n, prop, ts.isIdentifier(r) ? localTarget(ctx, r.text) : isFnLike(r) ? ctx.fnIds.get(r) : undefined);
  }
}

/** 2 巡目: import/export・イベント登録・大域変数 */
// ---------- 動的な呼び出し（呼び出し先を静的解析で確定できない箇所。D08「静的解析の限界」） ----------

export const DYNAMIC_CALL_KINDS = {
  computed: '計算されたメンバ呼び出し（obj[key]()）',
  importExpr: '動的 import（import(式)）',
  newFunction: 'new Function',
  eval: 'eval',
  stringTimer: '文字列を渡した setTimeout・setInterval',
} as const;

function isLiteral(e: ts.Expression | undefined): boolean {
  return e !== undefined && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isNumericLiteral(e));
}

function isStringLike(e: ts.Expression | undefined): boolean {
  return e !== undefined && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e));
}

/** 大域の関数名（`eval`・`window.eval`・`globalThis.setTimeout` 等）。それ以外は空 */
function globalCallee(e: ts.Expression): string {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && /^(window|globalThis|self)$/.test(e.expression.text)) return e.name.text;
  return '';
}

function dynamicKind(n: ts.Node): string | undefined {
  if (ts.isNewExpression(n)) return globalCallee(n.expression) === 'Function' ? DYNAMIC_CALL_KINDS.newFunction : undefined;
  if (!ts.isCallExpression(n)) return undefined;
  const c = unparen(n.expression);
  if (c.kind === ts.SyntaxKind.ImportKeyword) return isLiteral(n.arguments[0]) ? undefined : DYNAMIC_CALL_KINDS.importExpr;
  if (ts.isElementAccessExpression(c)) return isLiteral(c.argumentExpression) ? undefined : DYNAMIC_CALL_KINDS.computed;
  const name = globalCallee(c);
  if (name === 'eval') return DYNAMIC_CALL_KINDS.eval;
  if (name === 'Function') return DYNAMIC_CALL_KINDS.newFunction;
  if ((name === 'setTimeout' || name === 'setInterval') && isStringLike(n.arguments[0])) return DYNAMIC_CALL_KINDS.stringTimer;
  return undefined;
}

/** 動的な呼び出しを呼び出し箇所ごとに unknowns（区分 dynamic-call・topic に種類）へ積む */
function recordDynamicCall(ctx: FileCtx, n: ts.Node): void {
  const kind = dynamicKind(n);
  if (kind === undefined) return;
  const line = lineOf(ctx, n);
  ctx.out.unknowns.push({
    id: makeId(ctx, 'UNK', `dynamic-call-L${line}`, line),
    source: [srcOf(ctx, n)],
    evidence: 'unknown',
    topic: kind,
    question: `${textOf(ctx, n, 80)} の呼び出し先を静的解析で確定できない（実行時に決まる）`,
    relatedIds: [],
    category: 'dynamic-call' as Unknown['category'],
  });
}

export function collectModuleItems(ctx: FileCtx, kind: Module['kind']): void {
  for (const st of ctx.sf.statements) {
    exportsOfStatement(ctx, st);
    if (ts.isExportAssignment(st)) {
      const e = unparen(st.expression);
      addExport(ctx, st, 'default', ts.isIdentifier(e) ? localTarget(ctx, e.text) : isFnLike(e) ? ctx.fnIds.get(e) : undefined);
    } else if (ts.isExportDeclaration(st)) {
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          const local = (el.propertyName ?? el.name).getText(ctx.sf);
          addExport(ctx, el, el.name.getText(ctx.sf), st.moduleSpecifier ? undefined : localTarget(ctx, local));
        }
      } else {
        addExport(ctx, st, '*');
      }
    } else if (ts.isImportDeclaration(st) && isStrLit(st.moduleSpecifier)) {
      const c = st.importClause;
      const names: string[] = [];
      if (c?.name) names.push('default');
      if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) names.push('*');
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const el of c.namedBindings.elements) names.push((el.propertyName ?? el.name).getText(ctx.sf));
      }
      addImport(ctx, st, st.moduleSpecifier.text, names);
    } else if (!ts.isExternalModule(ctx.sf) && kind !== 'commonjs' && ts.isVariableStatement(st)) {
      // import/export を含まないスクリプトの最上位宣言は、var・let・const とも大域
      const flags = st.declarationList.flags;
      const vk = flags & ts.NodeFlags.Const ? 'const' : flags & ts.NodeFlags.Let ? 'let' : 'var';
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) addGlobal(ctx, d, d.name.text, vk);
    }
  }
  walk(ctx.sf, (n) => {
    recordDynamicCall(ctx, n);
    if (ts.isCallExpression(n)) onCall(ctx, n);
    else if (isAssign(n)) onAssign(ctx, n);
    else if (ts.isJsxAttribute(n) && /^on[A-Z]/.test(n.name.getText(ctx.sf)) && n.initializer) {
      const init = n.initializer;
      const expr = ts.isJsxExpression(init) ? init.expression : undefined;
      const el = n.parent.parent;
      const tag = ts.isJsxOpeningElement(el) || ts.isJsxSelfClosingElement(el) ? el.tagName.getText(ctx.sf) : 'JSX';
      addHandler(ctx, n, tag, n.name.getText(ctx.sf).slice(2).toLowerCase(), expr);
    }
  });
  for (const ex of ctx.out.exports) {
    const fn = ctx.out.functions.find((f) => f.id === ex.targetId);
    if (fn) fn.exported = true;
    const cls = ctx.out.classes.find((c) => c.id === ex.targetId);
    if (cls) cls.exported = true;
  }
}
