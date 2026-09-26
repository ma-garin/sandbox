// 状態・連携・エラー（REQ-F-011・012・013）。
import ts from 'typescript';
import type { ErrorInfo, Integration, StateMachine, StateTransition, Unknown } from '../ir/schema.ts';
import {
  type FileCtx,
  calleeName,
  conditionAbove,
  describeTarget,
  enclosingFn,
  evalString,
  evalUrl,
  fnIdOf,
  fnNameOf,
  isAssign,
  isFnLike,
  isStrLit,
  isStringy,
  lineOf,
  localInit,
  makeId,
  pointOf,
  resolveNumber,
  srcOf,
  textOf,
  unparen,
  walk,
  walkBody,
} from './js-util.ts';

const STATEISH = /state|status|mode|phase|step|stage/i;

// ---------- 状態 ----------

interface Hit {
  value: string;
  node: ts.Node;
  via?: string;
}

/** 引数 1 つをそのまま状態変数へ代入する関数（setState(next) { state = next }） */
function findSetters(ctx: FileCtx): Map<string, string> {
  const setters = new Map<string, string>();
  walk(ctx.sf, (n) => {
    if (!isFnLike(n) || n.parameters.length !== 1) return;
    const p = n.parameters[0];
    const name = ctx.fnNames.get(n);
    if (!p || !ts.isIdentifier(p.name) || !name || name.startsWith('<')) return;
    const pn = p.name.text;
    walkBody(n.body, (m) => {
      if (isAssign(m) && ts.isIdentifier(m.left)) {
        const r = unparen(m.right);
        if (ts.isIdentifier(r) && r.text === pn) setters.set(name, m.left.text);
      }
    });
  });
  return setters;
}

function fromState(ctx: FileCtx, node: ts.Node, variable: string): string {
  const re = new RegExp(`\\b${variable}\\s*===?\\s*['"\`]([^'"\`]+)['"\`]`);
  for (let p = node.parent; p && !isFnLike(p); p = p.parent) {
    if (ts.isIfStatement(p)) {
      const m = re.exec(textOf(ctx, p.expression, 400));
      if (m?.[1]) return m[1];
    }
    if (ts.isCaseClause(p) && textOf(ctx, p.parent.parent.expression) === variable && isStrLit(p.expression)) return p.expression.text;
  }
  // 起動時（DOMContentLoaded・load）に登録された関数の中なら、遷移元は起動時
  const fn = enclosingFn(node);
  const fnName = fn ? ctx.fnNames.get(fn) : undefined;
  const fnId = fn ? ctx.fnIds.get(fn) : undefined;
  const startup = ctx.out.eventHandlers.some((h) => /^(DOMContentLoaded|load)$/.test(h.event) && (h.handler === fnName || h.handler === fnId));
  return startup ? '（起動時）' : '*';
}

function transition(ctx: FileCtx, h: Hit, variable: string, action?: string): StateTransition {
  return {
    from: fromState(ctx, h.node, variable),
    trigger: fnNameOf(ctx, h.node),
    condition: conditionAbove(ctx, h.node),
    to: h.value,
    action,
    source: [pointOf(ctx, h.node)],
  };
}

function pushState(ctx: FileCtx, node: ts.Node, sm: Omit<StateMachine, 'id' | 'source' | 'evidence'>): void {
  ctx.out.states.push({
    id: makeId(ctx, 'STATE', sm.variable, lineOf(ctx, node)),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    ...sm,
  });
}

function variableStates(ctx: FileCtx): void {
  const setters = findSetters(ctx);
  const vars = new Map<string, { declared?: Hit; hits: Hit[] }>();
  const get = (name: string): { declared?: Hit; hits: Hit[] } => {
    const v = vars.get(name) ?? { hits: [] };
    vars.set(name, v);
    return v;
  };
  walk(ctx.sf, (n) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      isStrLit(n.initializer) &&
      ts.isVariableDeclarationList(n.parent) &&
      (n.parent.flags & ts.NodeFlags.Const) === 0
    ) {
      get(n.name.text).declared = { value: n.initializer.text, node: n };
    } else if (isAssign(n) && ts.isIdentifier(n.left)) {
      const r = unparen(n.right);
      if (isStrLit(r)) get(n.left.text).hits.push({ value: r.text, node: n });
    } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && setters.has(n.expression.text)) {
      const a = n.arguments[0];
      const v = setters.get(n.expression.text);
      if (a && isStrLit(a) && v) get(v).hits.push({ value: a.text, node: n, via: `${n.expression.text}('${a.text}')` });
    }
  });
  for (const [variable, v] of vars) {
    const values = [...new Set([v.declared?.value, ...v.hits.map((h) => h.value)].filter((x): x is string => x !== undefined))];
    if (v.hits.length === 0 || (values.length < 2 && !STATEISH.test(variable))) continue;
    for (const h of v.hits) {
      const fnId = fnIdOf(ctx, h.node);
      if (fnId) ctx.stateAfterFn.set(fnId, h.value);
    }
    pushState(ctx, v.declared?.node ?? v.hits[0]?.node ?? ctx.sf, {
      variable,
      mechanism: 'variable',
      values,
      initial: v.declared?.value,
      transitions: v.hits.map((h) => transition(ctx, h, variable, h.via)),
    });
  }
}

function typeStates(ctx: FileCtx): void {
  for (const st of ctx.sf.statements) {
    if (ts.isTypeAliasDeclaration(st) && STATEISH.test(st.name.text) && ts.isUnionTypeNode(st.type)) {
      const values = st.type.types.flatMap((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? [t.literal.text] : []));
      if (values.length === st.type.types.length && values.length >= 2) {
        pushState(ctx, st, { variable: st.name.text, mechanism: 'union-type', values, transitions: [] });
      }
    } else if (ts.isEnumDeclaration(st) && STATEISH.test(st.name.text)) {
      pushState(ctx, st, {
        variable: st.name.text,
        mechanism: 'enum-object',
        values: st.members.map((m) => m.name.getText(ctx.sf)),
        transitions: [],
      });
    }
  }
}

function classListStates(ctx: FileCtx): void {
  const groups = new Map<string, { node: ts.Node; values: Set<string>; transitions: StateTransition[]; adds: number }>();
  walk(ctx.sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const cl = n.expression.expression;
    const m = n.expression.name.text;
    if (!ts.isPropertyAccessExpression(cl) || cl.name.text !== 'classList' || !/^(add|remove|toggle|replace)$/.test(m)) return;
    const target = describeTarget(ctx, cl.expression);
    const g = groups.get(target) ?? { node: n, values: new Set<string>(), transitions: [], adds: 0 };
    groups.set(target, g);
    for (const a of n.arguments) if (isStrLit(a)) g.values.add(a.text);
    if (m === 'add' || m === 'toggle') {
      g.adds++;
      for (const a of n.arguments) g.transitions.push(transition(ctx, { value: evalString(ctx, a), node: n }, target, `classList.${m}`));
    }
  });
  for (const [target, g] of groups) {
    if (g.adds === 0) continue;
    pushState(ctx, g.node, {
      variable: `${target}.classList`,
      mechanism: 'classList',
      values: [...g.values],
      transitions: g.transitions,
    });
  }
}

export function collectStates(ctx: FileCtx): void {
  variableStates(ctx);
  typeStates(ctx);
  classListStates(ctx);
}

// ---------- 連携 ----------

type IntPart = Omit<Integration, 'id' | 'source' | 'evidence' | 'functionId' | 'timing' | 'failureConditions'> &
  Partial<Pick<Integration, 'failureConditions' | 'timing'>>;

function objProp(ctx: FileCtx, e: ts.Expression | undefined, name: string): ts.Expression | undefined {
  const o = e ? unparen(e) : undefined;
  if (!o || !ts.isObjectLiteralExpression(o)) return undefined;
  for (const p of o.properties) if (ts.isPropertyAssignment(p) && p.name.getText(ctx.sf) === name) return p.initializer;
  return undefined;
}

/** 呼び出しを含む関数から、応答・異常条件・タイムアウト・再試行を読む */
/** 異常条件の行ごとのソース位置（追加欄 failureSources。failureConditions と同じ並び） */
type FailureDetails = Pick<Integration, 'response' | 'failureConditions' | 'timeoutMs' | 'retries'> & { failureSources: SourceLoc[] };
type SourceLoc = Integration['source'][number];

function outboundDetails(ctx: FileCtx, call: ts.CallExpression): FailureDetails {
  const fn = enclosingFn(call);
  const failures: string[] = [];
  const failureSources: SourceLoc[] = [];
  let timeoutAt: SourceLoc | undefined;
  let catchAt: SourceLoc | undefined;
  let response: string | undefined;
  let timeoutMs: number | undefined;
  let abort = false;
  let hasCatch = false;
  walkBody(fn?.body ?? ctx.sf, (n) => {
    if (ts.isIfStatement(n)) {
      let throws = false;
      walk(n.thenStatement, (m) => {
        if (ts.isThrowStatement(m)) throws = true;
      });
      if (throws) {
        failures.push(textOf(ctx, n.expression));
        failureSources.push(srcOf(ctx, n));
      }
    } else if (ts.isCatchClause(n)) {
      hasCatch = true;
      catchAt ??= srcOf(ctx, n);
    }
    else if (ts.isNewExpression(n) && textOf(ctx, n.expression) === 'AbortController') abort = true;
    else if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      if (name === 'json' && n.arguments.length === 0) response = 'JSON（response.json()）';
      else if (name === 'text' && n.arguments.length === 0) response ??= 'テキスト（response.text()）';
      else if (name === 'setTimeout' && n.arguments[0] && /abort/.test(textOf(ctx, n.arguments[0])) && n.arguments[1]) {
        timeoutMs = resolveNumber(ctx, n.arguments[1])?.value;
        timeoutAt = srcOf(ctx, n);
      }
    }
  });
  if (abort && timeoutMs !== undefined && timeoutAt) {
    failures.push(`タイムアウト（${timeoutMs} ms で中断）`);
    failureSources.push(timeoutAt);
  }
  if (hasCatch && catchAt) {
    failures.push('通信例外（catch で捕捉）');
    failureSources.push(catchAt);
  }
  let retries: number | undefined;
  for (let p = call.parent; p && p !== fn; p = p.parent) {
    const cond = ts.isForStatement(p) ? p.condition : ts.isWhileStatement(p) || ts.isDoStatement(p) ? p.expression : undefined;
    const c = cond ? unparen(cond) : undefined;
    if (c && ts.isBinaryExpression(c)) {
      const v = resolveNumber(ctx, c.right);
      const k = c.operatorToken.kind;
      if (v && k === ts.SyntaxKind.LessThanEqualsToken) retries = v.value;
      else if (v && k === ts.SyntaxKind.LessThanToken) retries = v.value - 1;
      break;
    }
  }
  return { response, failureConditions: failures, failureSources, timeoutMs, retries };
}

/** evalString が値に置き換えられなかった部分（{式}）を含むか */
export function hasRuntimePart(url: string): boolean {
  return /\{[^}]+\}/.test(url);
}

function pushIntegration(ctx: FileCtx, node: ts.Node, part: IntPart): void {
  const timing = part.timing ?? fnNameOf(ctx, node);
  if (part.direction === 'outbound') ctx.netFns.add(fnNameOf(ctx, node));
  ctx.out.integrations.push({
    id: makeId(ctx, 'INT', `${part.mechanism}-${part.method}-${part.url}`, lineOf(ctx, node)),
    source: [srcOf(ctx, node)],
    // URL に実行時にしか決まらない部分（{引数名}）が残るものは、解析による対応付け＝推測
    evidence: hasRuntimePart(part.url) ? 'inference' : 'fact',
    functionId: fnIdOf(ctx, node),
    ...part,
    timing,
    failureConditions: part.failureConditions ?? [],
  });
}

const HTTP = /^(get|post|put|delete|patch|head|options|all)$/;

function expressRoute(ctx: FileCtx, n: ts.CallExpression, method: string, url: string): void {
  const handler = n.arguments[n.arguments.length - 1];
  let response: string | undefined;
  const failures: string[] = [];
  if (handler) {
    walk(handler, (m) => {
      if (!ts.isCallExpression(m) || !ts.isPropertyAccessExpression(m.expression)) return;
      const name = m.expression.name.text;
      if (/^(json|send|end|sendStatus|render)$/.test(name)) response ??= textOf(ctx, m, 100);
      if (name === 'status' || name === 'sendStatus') {
        const code = m.arguments[0] ? resolveNumber(ctx, m.arguments[0]) : undefined;
        if (code && code.value >= 400) failures.push(`HTTP ${code.value}${conditionAbove(ctx, m) ? `（${conditionAbove(ctx, m)}）` : ''}`);
      }
    });
  }
  pushIntegration(ctx, n, {
    direction: 'inbound',
    mechanism: 'express',
    method: method.toUpperCase(),
    url,
    timing: 'HTTP リクエスト受信時',
    response,
    failureConditions: failures,
  });
}

export function collectIntegrations(ctx: FileCtx): void {
  const hasXhr = /new\s+XMLHttpRequest/.test(ctx.sf.text);
  const isExpress = ctx.out.imports.some((i) => i.from === 'express');
  walk(ctx.sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const c = n.expression;
    const name = calleeName(n);
    const objText = ts.isPropertyAccessExpression(c) ? textOf(ctx, c.expression) : '';
    const a0 = n.arguments[0];
    const a1 = n.arguments[1];
    if (name === 'fetch' && (ts.isIdentifier(c) || /^(window|globalThis|self)$/.test(objText))) {
      const m = objProp(ctx, a1, 'method');
      const body = objProp(ctx, a1, 'body');
      pushIntegration(ctx, n, {
        direction: 'outbound',
        mechanism: 'fetch',
        method: m ? evalString(ctx, m).toUpperCase() : 'GET',
        url: a0 ? evalUrl(ctx, a0) : '',
        requestData: body ? textOf(ctx, body) : undefined,
        ...outboundDetails(ctx, n),
      });
    } else if (hasXhr && name === 'open' && a0 && a1 && ts.isPropertyAccessExpression(c)) {
      pushIntegration(ctx, n, {
        direction: 'outbound',
        mechanism: 'xhr',
        method: evalString(ctx, a0).toUpperCase(),
        url: evalUrl(ctx, a1),
        ...outboundDetails(ctx, n),
      });
    } else if ((ts.isIdentifier(c) && c.text === 'axios') || (objText === 'axios' && (HTTP.test(name) || name === 'request'))) {
      const cfg = ts.isIdentifier(c) || name === 'request' ? a0 : n.arguments[n.arguments.length - 1];
      const m = HTTP.test(name) ? name : objProp(ctx, cfg, 'method');
      const u = ts.isIdentifier(c) || name === 'request' ? objProp(ctx, a0, 'url') : a0;
      const to = objProp(ctx, cfg, 'timeout');
      const details = outboundDetails(ctx, n);
      pushIntegration(ctx, n, {
        direction: 'outbound',
        mechanism: 'axios',
        method: typeof m === 'string' ? m.toUpperCase() : m ? evalString(ctx, m).toUpperCase() : 'GET',
        url: u ? evalUrl(ctx, u) : '',
        requestData: /^(post|put|patch)$/.test(name) && a1 ? textOf(ctx, a1) : undefined,
        ...details,
        timeoutMs: (to ? resolveNumber(ctx, to)?.value : undefined) ?? details.timeoutMs,
      });
    } else if (isExpress && ts.isPropertyAccessExpression(c) && HTTP.test(name) && a0 && isStrLit(a0) && a0.text.startsWith('/')) {
      expressRoute(ctx, n, name, a0.text);
    }
  });
  callSiteIntegrations(ctx);
}

/**
 * URL の一部が関数の引数で決まるラッパー（例 postWithRetry(url)）は、同じファイルの呼び出し箇所で
 * 文字列リテラル・解決できる const が渡されていれば、呼び出し箇所ごとに解決済み URL の連携を足す。
 * 追加欄 wrapperOf で元の連携と対応づけ、根拠は推測（呼び出し元の位置を先頭に置く）
 */
/** 呼び出し箇所で渡したオプション（object literal。変数経由を含む）の method。const は値に解決する */
function callSiteMethod(ctx: FileCtx, call: ts.CallExpression): string | undefined {
  for (const a of call.arguments) {
    const x = unparen(a);
    const o = ts.isIdentifier(x) ? (localInit(x) ?? x) : x;
    const m = objProp(ctx, o, 'method');
    if (m && isStringy(ctx, m)) return evalString(ctx, m).toUpperCase();
  }
  return undefined;
}

function callSiteIntegrations(ctx: FileCtx): void {
  const derived: Integration[] = [];
  for (const i of ctx.out.integrations) {
    const fn = ctx.out.functions.find((f) => f.id === i.functionId);
    if (!fn || !hasRuntimePart(i.url)) continue;
    const idx = fn.params.flatMap((p, k) => (i.url.includes(`{${p.name}}`) ? [k] : []));
    if (idx.length === 0) continue;
    const short = fn.name.split('.').pop() ?? fn.name;
    walk(ctx.sf, (n) => {
      if (!ts.isCallExpression(n) || calleeName(n) !== short) return;
      // 渡された式に固定の部分があれば代入する（実行時にしか決まらない部分は {名前} のまま）
      const url = idx.reduce((u, k) => {
        const a = n.arguments[k];
        const v = a && isStringy(ctx, a) ? evalUrl(ctx, a) : undefined;
        return v !== undefined && v.replace(/\{[^}]*\}/g, '') !== '' ? u.split(`{${fn.params[k]?.name}}`).join(v) : u;
      }, i.url);
      if (url === i.url) return;
      const at = srcOf(ctx, n);
      const method = callSiteMethod(ctx, n) ?? i.method;
      derived.push({
        ...i,
        id: makeId(ctx, 'INT', `${i.mechanism}-${method}-${url}`, lineOf(ctx, n)),
        method,
        url,
        source: [at, ...i.source],
        evidence: 'inference',
        functionId: fnIdOf(ctx, n) ?? i.functionId,
        timing: fnNameOf(ctx, n),
        wrapperOf: i.id,
      } as Integration);
    });
  }
  ctx.out.integrations.push(...derived);
}

// ---------- エラー ----------

function messageFrom(ctx: FileCtx, arg: ts.Expression | undefined): string | undefined {
  if (!arg) return undefined;
  const e = unparen(arg);
  if (isStringy(ctx, e)) return evalString(ctx, e);
  if (
    ts.isBinaryExpression(e) &&
    (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return messageFrom(ctx, e.right) ?? messageFrom(ctx, e.left);
  }
  return undefined;
}

function inNetworkCatch(ctx: FileCtx, node: ts.Node): boolean {
  for (let p = node.parent; p && !isFnLike(p); p = p.parent) {
    if (!ts.isCatchClause(p)) continue;
    let net = false;
    walk(p.parent.tryBlock, (m) => {
      if (ts.isCallExpression(m) && /^(fetch|axios|send)$|^(get|post|put|delete|patch)$/.test(calleeName(m)) && /fetch|axios|xhr|send/i.test(textOf(ctx, m.expression))) net = true;
      if (ts.isCallExpression(m) && ctx.netFns.has(calleeName(m))) net = true;
    });
    return net;
  }
  return false;
}

function pushError(ctx: FileCtx, node: ts.Node, message: string, kind: ErrorInfo['kind'], afterState?: string): void {
  const fn = fnNameOf(ctx, node);
  const functionId = fnIdOf(ctx, node);
  const id = makeId(ctx, 'ERR', `${fn.startsWith('<') ? 'anonymous' : fn}-${kind}`, lineOf(ctx, node));
  let condition = conditionAbove(ctx, node);
  let unknownId: string | undefined;
  if (condition === undefined) {
    const exit = afterLoop(ctx, node);
    if (exit?.condition) condition = exit.condition;
    else if (exit?.reason) {
      // 追加欄（schema 外）: 発生条件が取れない・到達しないエラーは unknowns に理由を積み、その ID を参照する
      unknownId = makeId(ctx, 'UNK', `cond-${fn.startsWith('<') ? 'anonymous' : fn}`, lineOf(ctx, node));
      condition = `発生条件を確定できない（${exit.unreachable ? '到達しない可能性が高い' : '要確認'}。${unknownId}）`;
      ctx.out.unknowns.push({
        id: unknownId,
        source: [srcOf(ctx, node)],
        evidence: 'unknown',
        topic: `エラー「${message}」の発生条件`,
        question: exit.reason,
        relatedIds: [id],
        category: 'unreachable-or-unknown-condition' as Unknown['category'],
      });
    } else condition = `${fn} を実行すると常に発生（条件分岐なし）`;
  }
  ctx.out.errors.push({
    id,
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    message,
    condition,
    afterState,
    kind,
    functionId,
    ...(unknownId ? { unknownId } : {}),
  } as ErrorInfo);
  if (kind === 'throw' && functionId) ctx.out.functions.find((f) => f.id === functionId)?.throws.push(id);
}

/** ループの後ろにある文なら、ループの抜け方から発生条件を読む */
function afterLoop(ctx: FileCtx, node: ts.Node): { condition?: string; reason?: string; unreachable?: boolean } | undefined {
  let st: ts.Node = node;
  while (st.parent && !ts.isBlock(st.parent) && !ts.isSourceFile(st.parent)) {
    if (isFnLike(st.parent)) return undefined;
    st = st.parent;
  }
  const block = st.parent;
  if (!block || !(ts.isBlock(block) || ts.isSourceFile(block))) return undefined;
  const stmts: readonly ts.Statement[] = block.statements;
  const loop = stmts
    .slice(0, stmts.indexOf(st as ts.Statement))
    .reverse()
    .find((s) => ts.isForStatement(s) || ts.isWhileStatement(s) || ts.isDoStatement(s) || ts.isForOfStatement(s) || ts.isForInStatement(s));
  if (!loop) return undefined;
  const cond = ts.isForStatement(loop) ? loop.condition : ts.isWhileStatement(loop) || ts.isDoStatement(loop) ? loop.expression : undefined;
  const last = neverExits(ctx, loop as ts.IterationStatement, cond);
  if (last) {
    return {
      unreachable: true,
      reason: `${lineOf(ctx, loop)} 行のループは最終回（${last}）に catch が例外を再送出し、try は return で終わるため、ループを正常に抜ける経路が無い。この文には到達しない可能性が高い。到達させる意図があるか確認する`,
    };
  }
  if (cond) return { condition: `ループ（${textOf(ctx, cond)}）を最後まで回り、条件が偽になったとき` };
  return { reason: `${lineOf(ctx, loop)} 行のループを抜けた後に到達するかをソースから確定できない` };
}

/** 「x <= B」のループで、本体の try が return で終わり、catch が x === B のとき必ず throw するなら、その比較の文字列 */
function neverExits(ctx: FileCtx, loop: ts.IterationStatement, cond: ts.Expression | undefined): string | undefined {
  const c = cond ? unparen(cond) : undefined;
  if (!c || !ts.isBinaryExpression(c) || c.operatorToken.kind !== ts.SyntaxKind.LessThanEqualsToken) return undefined;
  const last = `${textOf(ctx, c.left)} === ${textOf(ctx, c.right)}`;
  const body: readonly ts.Statement[] = ts.isBlock(loop.statement) ? loop.statement.statements : [loop.statement];
  let hasBreak = false;
  walkBody(loop.statement, (n) => {
    if (ts.isBreakStatement(n)) hasBreak = true;
  });
  if (hasBreak) return undefined;
  const tryStmt = body.find((s): s is ts.TryStatement => ts.isTryStatement(s));
  const tail = tryStmt?.tryBlock.statements[tryStmt.tryBlock.statements.length - 1];
  if (!tryStmt?.catchClause || !tail || !ts.isReturnStatement(tail)) return undefined;
  let rethrows = false;
  walkBody(tryStmt.catchClause.block, (n) => {
    if (!ts.isThrowStatement(n)) return;
    const above = conditionAbove(ctx, n);
    if (above === undefined || (above.includes(last) && !above.endsWith('ではない'))) rethrows = true;
  });
  return rethrows ? last : undefined;
}

export function collectErrors(ctx: FileCtx): void {
  walk(ctx.sf, (n) => {
    if (ts.isThrowStatement(n) && n.expression) {
      const e = unparen(n.expression);
      if (ts.isNewExpression(e)) pushError(ctx, n, messageFrom(ctx, e.arguments?.[0]) ?? textOf(ctx, e), 'throw');
      else if (isStringy(ctx, e)) pushError(ctx, n, evalString(ctx, e), 'throw');
    } else if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      const c = n.expression;
      const full = ts.isPropertyAccessExpression(c) ? textOf(ctx, c) : name;
      const isPush = name === 'push' && ts.isPropertyAccessExpression(c) && /error|message|warn/i.test(textOf(ctx, c.expression));
      const isDisplay = !isPush && !full.startsWith('console.') && (name === 'alert' || /error|alert|warn|toast|notify/i.test(name));
      if (!isPush && !isDisplay) return;
      const msg = messageFrom(ctx, n.arguments[0]);
      if (msg === undefined) return;
      const callee = ts.isIdentifier(c) ? ctx.out.functions.find((f) => f.name === c.text && f.moduleId === ctx.moduleId) : undefined;
      const after = callee ? ctx.stateAfterFn.get(callee.id) : undefined;
      pushError(ctx, n, msg, isPush ? 'validation' : inNetworkCatch(ctx, n) ? 'network' : 'display', after);
    } else if (isAssign(n) && ts.isPropertyAccessExpression(n.left) && /^(textContent|innerText|innerHTML)$/.test(n.left.name.text)) {
      const target = describeTarget(ctx, n.left.expression);
      if (/error|alert|warn/i.test(target) && isStringy(ctx, n.right) && evalString(ctx, n.right) !== '') {
        pushError(ctx, n, evalString(ctx, n.right), 'display');
      }
    }
  });
}
