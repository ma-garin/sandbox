// データ項目（保存域キー・型定義・レコードレイアウト）と既定値（REQ-F-014・037）。
import ts from 'typescript';
import type { DataField, DataItem, DefaultValue, Integration, SourceRef } from '../ir/schema.ts';
import {
  type FileCtx,
  calleeName,
  enclosingFn,
  evalString,
  fnIdOf,
  fnNameOf,
  isAssign,
  isFnLike,
  isStrLit,
  lineOf,
  localInit,
  makeId,
  resolveNumber,
  srcOf,
  textOf,
  unparen,
  walk,
} from './js-util.ts';

function pushData(ctx: FileCtx, node: ts.Node, d: Omit<DataItem, 'id' | 'source' | 'evidence'>): void {
  const same = ctx.out.dataItems.find((x) => x.kind === d.kind && x.name === d.name && d.kind !== 'layout');
  if (same) {
    same.source.push(srcOf(ctx, node));
    same.example ??= d.example;
    if (same.fields.length === 0 && d.fields.length > 0) same.fields = d.fields;
    return;
  }
  ctx.out.dataItems.push({ id: makeId(ctx, 'DATA', `${d.kind}-${d.name}`, lineOf(ctx, node)), source: [srcOf(ctx, node)], evidence: 'fact', ...d });
}

function fieldsOf(ctx: FileCtx, members: ts.NodeArray<ts.TypeElement>): DataField[] {
  return members.filter(ts.isPropertySignature).map((m) => {
    const comment = (ts.getTrailingCommentRanges(ctx.sf.text, m.end) ?? [])
      .map((r) => ctx.sf.text.slice(r.pos, r.end))
      .join(' ');
    const len = /(\d+)\s*桁/.exec(comment);
    return {
      name: m.name.getText(ctx.sf),
      type: m.type ? textOf(ctx, m.type) : undefined,
      length: len ? Number(len[1]) : undefined,
      optional: m.questionToken ? true : undefined,
    };
  });
}

/** 桁を決める式（padStart(N)・slice(0, N)）なら桁数 */
function lengthOf(ctx: FileCtx, e: ts.Expression, depth = 0): { name: string; length: number } | undefined {
  const x = unparen(e);
  if (ts.isIdentifier(x) && depth < 2) {
    const init = localInit(x);
    const r = init ? lengthOf(ctx, init, depth + 1) : undefined;
    return r ? { name: x.text, length: r.length } : undefined;
  }
  if (!ts.isCallExpression(x) || !ts.isPropertyAccessExpression(x.expression)) return undefined;
  const m = x.expression.name.text;
  const inner = x.expression.expression;
  const innerName = ts.isCallExpression(inner) && calleeName(inner) === 'String' && inner.arguments[0] ? textOf(ctx, inner.arguments[0]) : textOf(ctx, inner, 40);
  if ((m === 'padStart' || m === 'padEnd') && x.arguments[0]) {
    const n = resolveNumber(ctx, x.arguments[0]);
    return n ? { name: innerName, length: n.value } : undefined;
  }
  if (/^(slice|substring|substr)$/.test(m) && x.arguments.length === 2 && x.arguments[1]) {
    const from = x.arguments[0] ? resolveNumber(ctx, x.arguments[0]) : undefined;
    const to = resolveNumber(ctx, x.arguments[1]);
    if (from?.value === 0 && to) return { name: innerName, length: to.value };
  }
  return undefined;
}

function flattenPlus(e: ts.Expression): ts.Expression[] {
  const x = unparen(e);
  if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...flattenPlus(x.left), ...flattenPlus(x.right)];
  return [x];
}

function layout(ctx: FileCtx, bin: ts.BinaryExpression): void {
  const parts = flattenPlus(bin);
  const fields: DataField[] = [];
  const seps: string[] = [];
  let example = '';
  for (const p of parts) {
    if (isStrLit(p) && /^[^A-Za-z0-9]{1,3}$/.test(p.text)) {
      seps.push(p.text);
      example += p.text;
      continue;
    }
    const len = lengthOf(ctx, p);
    fields.push(len ? { name: len.name, length: len.length } : { name: textOf(ctx, p, 40) });
    example += len ? '9'.repeat(len.length) : '…';
  }
  if (fields.filter((f) => f.length !== undefined).length === 0 || fields.length + seps.length < 2) return;
  pushData(ctx, bin, {
    kind: 'layout',
    name: `${fnNameOf(ctx, bin)} の組み立て`,
    fields,
    separator: seps.length > 0 ? [...new Set(seps)].join(' ') : undefined,
    example,
  });
}

/** setItem の値が JSON.stringify(オブジェクト or その配列) なら、オブジェクトの項目名 */
function storedFields(value: ts.Expression): DataField[] {
  let v = unparen(value);
  if (ts.isCallExpression(v) && textOfCallee(v) === 'JSON.stringify' && v.arguments[0]) v = unparen(v.arguments[0]);
  if (ts.isArrayLiteralExpression(v)) {
    const el = [...v.elements].reverse().find((e) => !ts.isSpreadElement(e));
    if (!el) return [];
    v = unparen(el);
  }
  if (ts.isIdentifier(v)) v = localInit(v) ?? v;
  if (!ts.isObjectLiteralExpression(v)) return [];
  return v.properties.flatMap((p) => (p.name && (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) ? [{ name: p.name.getText() }] : []));
}

function textOfCallee(c: ts.CallExpression): string {
  return c.expression.getText().replace(/\s+/g, '');
}

// ---------- CRUD（関数ごとの作成・参照・更新・削除） ----------

/** CRUD の操作。'C/U' は setItem で新規キーか既存キーかを区別できないもの（推測） */
export type CrudOp = 'C' | 'R' | 'U' | 'D' | 'C/U';

/**
 * DataItem・Integration に載せる追加欄 `access`（schema 外）。
 * functionId はトップレベルのコードなら Module.id。evidence='inference' は解析による対応付け
 */
export interface DataAccess {
  functionId: string;
  op: CrudOp;
  source: SourceRef;
  evidence: 'fact' | 'inference';
}

function addAccess(target: DataItem | Integration, a: DataAccess): void {
  const t = target as { access?: DataAccess[] };
  t.access = [...(t.access ?? []), a];
}

function isStorageCall(ctx: FileCtx, n: ts.Node, store: string, key: string, method: string): n is ts.CallExpression {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== method) return false;
  const a0 = n.arguments[0];
  return new RegExp(`(^|\\.)${store}$`).test(textOf(ctx, n.expression.expression)) && a0 !== undefined && evalString(ctx, a0) === key;
}

/** `!getItem(k)`・`getItem(k) === null` のようにキーが無いことを確かめる式か */
function isAbsentCheck(x: ts.Node): boolean {
  const p = x.parent;
  if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
  if (!ts.isBinaryExpression(p) || !/^={2,3}$/.test(p.operatorToken.getText())) return false;
  return /^(null|undefined)$/.test((p.left === x ? p.right : p.left).getText());
}

/**
 * setItem の C／U を推定する（どれも推測）。
 * キーが無いことを確かめた if の中なら C、同じ関数で先に既定値なしで読んでいれば U、それ以外は C/U
 */
function setOp(ctx: FileCtx, call: ts.CallExpression, store: string, key: string): CrudOp {
  for (let p: ts.Node = call.parent; p && !isFnLike(p); p = p.parent) {
    if (!ts.isIfStatement(p) || call.pos < p.thenStatement.pos || call.end > p.thenStatement.end) continue;
    let guard = false;
    walk(p.expression, (x) => {
      if (isStorageCall(ctx, x, store, key, 'getItem') && isAbsentCheck(x)) guard = true;
    });
    if (guard) return 'C';
  }
  let read = false;
  let fallback = false;
  walk(enclosingFn(call) ?? ctx.sf, (x) => {
    if (x.getStart() >= call.getStart() || !isStorageCall(ctx, x, store, key, 'getItem')) return;
    read = true;
    let q: ts.Node = x.parent;
    while (ts.isParenthesizedExpression(q)) q = q.parent;
    const k = ts.isBinaryExpression(q) ? q.operatorToken.kind : undefined;
    if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) fallback = true;
  });
  return read && !fallback ? 'U' : 'C/U';
}

const STORAGE_OP: Readonly<Record<string, CrudOp>> = { getItem: 'R', removeItem: 'D' };

function storageAccess(ctx: FileCtx, n: ts.CallExpression, store: 'localStorage' | 'sessionStorage', key: string, m: string): void {
  const item = ctx.out.dataItems.find((x) => x.kind === store && x.name === key);
  if (!item) return;
  const op = m === 'setItem' ? setOp(ctx, n, store, key) : STORAGE_OP[m];
  if (!op) return;
  addAccess(item, { functionId: fnIdOf(ctx, n) ?? ctx.moduleId, op, source: srcOf(ctx, n), evidence: m === 'setItem' ? 'inference' : 'fact' });
}

const IDB_OP: Readonly<Record<string, CrudOp>> = {
  add: 'C',
  put: 'C/U',
  get: 'R',
  getAll: 'R',
  getAllKeys: 'R',
  getKey: 'R',
  count: 'R',
  openCursor: 'R',
  delete: 'D',
  clear: 'D',
};

/** `tx.objectStore('name')`（変数経由を含む）ならストア名 */
function objectStoreName(ctx: FileCtx, e: ts.Expression): string | undefined {
  let x = unparen(e);
  if (ts.isIdentifier(x)) x = localInit(x) ?? x;
  if (!ts.isCallExpression(x) || !ts.isPropertyAccessExpression(x.expression) || x.expression.name.text !== 'objectStore') return undefined;
  return x.arguments[0] ? evalString(ctx, x.arguments[0]) : undefined;
}

const HTTP_OP: Readonly<Record<string, CrudOp>> = { POST: 'C', GET: 'R', HEAD: 'R', PUT: 'U', PATCH: 'U', DELETE: 'D' };

/** Express のルート登録（同じ行の呼び出しの最後の引数）から処理関数の id */
function routeHandlerId(ctx: FileCtx, i: Integration): string | undefined {
  const line = i.source[0]?.line;
  const found: string[] = [];
  walk(ctx.sf, (n) => {
    if (found.length > 0 || !ts.isCallExpression(n) || lineOf(ctx, n) !== line) return;
    const last = n.arguments[n.arguments.length - 1];
    const id = !last ? undefined : isFnLike(last) ? ctx.fnIds.get(last) : ts.isIdentifier(last) ? ctx.out.functions.find((f) => f.name === last.text)?.id : undefined;
    if (id) found.push(id);
  });
  return found[0];
}

/** API のリソース名: オリジンとクエリを除いたパス */
function resourceOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '') || url;
}

function integrationAccess(ctx: FileCtx): void {
  for (const i of ctx.out.integrations) {
    const op = HTTP_OP[i.method.toUpperCase()];
    const src = i.source[0];
    if (!op || !src || (i as { access?: unknown }).access) continue;
    // 呼び出し箇所ごとの連携（wrapperOf）があるラッパーは、そちらに操作を任せて二重に数えない
    if (ctx.out.integrations.some((x) => (x as { wrapperOf?: unknown }).wrapperOf === i.id)) continue;
    const fid = i.functionId ?? (i.mechanism === 'express' ? routeHandlerId(ctx, i) : undefined) ?? ctx.moduleId;
    Object.assign(i, { resource: resourceOf(i.url) });
    addAccess(i, { functionId: fid, op, source: src, evidence: i.evidence === 'inference' ? 'inference' : 'fact' });
  }
}

export function collectData(ctx: FileCtx): void {
  const clears: { store: 'localStorage' | 'sessionStorage'; node: ts.CallExpression }[] = [];
  walk(ctx.sf, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      const obj = textOf(ctx, n.expression.expression);
      const a0 = n.arguments[0];
      const store = /(^|\.)(localStorage|sessionStorage)$/.exec(obj)?.[2] as 'localStorage' | 'sessionStorage' | undefined;
      const idbStore = IDB_OP[m] ? objectStoreName(ctx, n.expression.expression) : undefined;
      if (store && /^(getItem|setItem|removeItem)$/.test(m) && a0) {
        const a1 = n.arguments[1];
        const fields = m === 'setItem' && a1 ? storedFields(a1) : [];
        const name = evalString(ctx, a0);
        pushData(ctx, n, { kind: store, name, fields, example: m === 'setItem' && a1 ? textOf(ctx, a1, 100) : undefined });
        storageAccess(ctx, n, store, name, m);
      } else if (store && m === 'clear' && n.arguments.length === 0) {
        clears.push({ store, node: n });
      } else if (idbStore !== undefined) {
        pushData(ctx, n, { kind: 'indexedDB', name: idbStore, fields: [] });
        const item = ctx.out.dataItems.find((x) => x.kind === 'indexedDB' && x.name === idbStore);
        const op = IDB_OP[m];
        if (item && op) addAccess(item, { functionId: fnIdOf(ctx, n) ?? ctx.moduleId, op, source: srcOf(ctx, n), evidence: op === 'C/U' ? 'inference' : 'fact' });
      } else if ((obj.endsWith('indexedDB') && m === 'open') || m === 'createObjectStore') {
        if (a0) pushData(ctx, n, { kind: 'indexedDB', name: evalString(ctx, a0), fields: [] });
      }
    } else if (ts.isInterfaceDeclaration(n)) {
      pushData(ctx, n, { kind: 'interface', name: n.name.text, fields: fieldsOf(ctx, n.members) });
    } else if (ts.isTypeAliasDeclaration(n)) {
      pushData(ctx, n, {
        kind: 'typeAlias',
        name: n.name.text,
        fields: ts.isTypeLiteralNode(n.type) ? fieldsOf(ctx, n.type.members) : [],
        example: ts.isTypeLiteralNode(n.type) ? undefined : textOf(ctx, n.type),
      });
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      let p: ts.Node = n.parent;
      while (ts.isParenthesizedExpression(p)) p = p.parent;
      if (!(ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken)) layout(ctx, n);
    }
  });
  // clear() は同じファイルで見つかった同じ保存域のキーすべての削除とみなす（推測）
  for (const c of clears) {
    for (const d of ctx.out.dataItems.filter((x) => x.kind === c.store)) {
      addAccess(d, { functionId: fnIdOf(ctx, c.node) ?? ctx.moduleId, op: 'D', source: srcOf(ctx, c.node), evidence: 'inference' });
    }
  }
  integrationAccess(ctx);
}

// ---------- 既定値 ----------

/** リテラル、または `x || 'lit'`・`x ?? 'lit'` の既定側 */
function literalOf(e: ts.Expression): string | undefined {
  const x = unparen(e);
  if (isStrLit(x) || ts.isNumericLiteral(x)) return x.text;
  if (x.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (x.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (ts.isPrefixUnaryExpression(x) && x.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(x.operand)) return `-${x.operand.text}`;
  if (
    ts.isBinaryExpression(x) &&
    (x.operatorToken.kind === ts.SyntaxKind.BarBarToken || x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return literalOf(x.right);
  }
  return undefined;
}

function pushDefault(ctx: FileCtx, node: ts.Node, d: Omit<DefaultValue, 'id' | 'source' | 'evidence'>): void {
  ctx.out.defaults.push({ id: makeId(ctx, 'DEF', d.subject, lineOf(ctx, node)), source: [srcOf(ctx, node)], evidence: 'fact', ...d });
}

const INIT_FN = /^(init|setup|reset|load|start|bootstrap|main|initialize)/i;

export function collectDefaults(ctx: FileCtx): void {
  for (const st of ctx.sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const isConst = (st.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const d of st.declarationList.declarations) {
      const v = d.initializer ? literalOf(d.initializer) : undefined;
      if (!ts.isIdentifier(d.name) || v === undefined) continue;
      const context = isConst && /^[A-Z0-9_]+$/.test(d.name.text) ? 'config' : 'variable';
      pushDefault(ctx, d, { subject: d.name.text, value: v, context });
    }
  }
  walk(ctx.sf, (n) => {
    if (isAssign(n) && ts.isIdentifier(n.left)) {
      const fn = enclosingFn(n);
      const v = literalOf(n.right);
      if (fn && v !== undefined && INIT_FN.test(fnNameOf(ctx, n))) pushDefault(ctx, n, { subject: n.left.text, value: v, context: 'init' });
    } else if (ts.isParameter(n) && n.initializer && ts.isIdentifier(n.name)) {
      const v = literalOf(n.initializer);
      if (v !== undefined) pushDefault(ctx, n, { subject: `${fnNameOf(ctx, n.name)} の引数 ${n.name.text}`, value: v, context: 'variable' });
    }
  });
}
