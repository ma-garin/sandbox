// 業務ルール（if・switch・三項・計算式）と境界値・数値（REQ-F-009・010・033・034・036）。
import ts from 'typescript';
import type { Boundary, Condition, Rule, RuleCase } from '../ir/schema.ts';
import {
  type FileCtx,
  calleeName,
  enclosingFn,
  fmtNum,
  fnIdOf,
  fnNameOf,
  isConfigExpr,
  isFnLike,
  isStringy,
  lineOf,
  makeId,
  pointOf,
  resolveNumber,
  srcOf,
  textOf,
  toCondition,
  unitFromName,
  unparen,
  walk,
} from './js-util.ts';

const KIND_JA: Readonly<Record<Rule['kind'], string>> = {
  if: '条件分岐',
  switch: '場合分け',
  ternary: '三項演算',
  formula: '計算式',
};

function summarizeList(ctx: FileCtx, sts: readonly ts.Statement[]): string {
  const body = sts.filter((s) => !ts.isBreakStatement(s));
  if (body.length === 0) return '（処理なし）';
  const parts = body.slice(0, 3).map((s) => textOf(ctx, s, 100));
  return parts.join(' / ') + (body.length > 3 ? ' …' : '');
}

function summarize(ctx: FileCtx, st: ts.Statement): string {
  return summarizeList(ctx, ts.isBlock(st) ? st.statements : [st]);
}

function pushRule(ctx: FileCtx, node: ts.Node, kind: Rule['kind'], cases: RuleCase[], formula?: string): void {
  const fn = fnNameOf(ctx, node);
  const line = lineOf(ctx, node);
  ctx.out.rules.push({
    id: makeId(ctx, 'RULE', `${fn.startsWith('<') ? 'anonymous' : fn}-${kind}`, line),
    source: [srcOf(ctx, node)],
    evidence: 'fact',
    functionId: fnIdOf(ctx, node),
    name: `${fn} の${KIND_JA[kind]}（${line} 行）`,
    kind,
    cases,
    formula,
  });
}

function ifRule(ctx: FileCtx, n: ts.IfStatement): void {
  const cases: RuleCase[] = [];
  let cur: ts.Statement | undefined = n;
  while (cur && ts.isIfStatement(cur)) {
    cases.push({ condition: toCondition(ctx, cur.expression), result: summarize(ctx, cur.thenStatement), source: [pointOf(ctx, cur)] });
    cur = cur.elseStatement;
  }
  if (cur) cases.push({ condition: null, result: summarize(ctx, cur), source: [pointOf(ctx, cur)] });
  pushRule(ctx, n, 'if', cases);
}

function switchRule(ctx: FileCtx, n: ts.SwitchStatement): void {
  const subj = textOf(ctx, n.expression);
  const cases: RuleCase[] = [];
  let pending: Condition[] = [];
  for (const cl of n.caseBlock.clauses) {
    if (ts.isCaseClause(cl)) {
      pending.push({ op: 'leaf', text: `${subj} === ${textOf(ctx, cl.expression)}`, source: pointOf(ctx, cl) });
      if (cl.statements.length === 0) continue; // 次の case へ落ちる
    }
    const condition: Condition | null = ts.isDefaultClause(cl)
      ? null
      : pending.length === 1 && pending[0]
        ? pending[0]
        : { op: 'or', items: pending };
    cases.push({ condition, result: summarizeList(ctx, cl.statements), source: [pointOf(ctx, cl)] });
    pending = [];
  }
  pushRule(ctx, n, 'switch', cases);
}

function ternaryRule(ctx: FileCtx, n: ts.ConditionalExpression): void {
  const cases: RuleCase[] = [];
  let cur: ts.Expression = n;
  while (ts.isConditionalExpression(cur)) {
    cases.push({ condition: toCondition(ctx, cur.condition), result: textOf(ctx, cur.whenTrue, 100), source: [pointOf(ctx, cur)] });
    cur = unparen(cur.whenFalse);
  }
  cases.push({ condition: null, result: textOf(ctx, cur, 100), source: [pointOf(ctx, cur)] });
  pushRule(ctx, n, 'ternary', cases);
}

const ARITH = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
]);

function isArith(n: ts.Node): n is ts.BinaryExpression {
  return ts.isBinaryExpression(n) && ARITH.has(n.operatorToken.kind);
}

function formulaRule(ctx: FileCtx, bin: ts.BinaryExpression): void {
  for (let p = bin.parent; p && !ts.isStatement(p) && !isFnLike(p); p = p.parent) if (isArith(p)) return;
  const fn = enclosingFn(bin);
  if (!fn) return;
  const params = new Set(fn.parameters.flatMap((p) => (ts.isIdentifier(p.name) ? [p.name.text] : [])));
  let usesInput = false;
  let stringy = false;
  walk(bin, (n) => {
    if (ts.isIdentifier(n) && params.has(n.text)) usesInput = true;
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'value') usesInput = true;
    if (isArith(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && (isStringy(ctx, n.left) || isStringy(ctx, n.right))) stringy = true;
    if (ts.isCallExpression(n) && /^(String|toString|padStart|padEnd|join|slice)$/.test(calleeName(n))) stringy = true;
  });
  if (!usesInput || stringy) return;
  const p = bin.parent;
  const target = ts.isReturnStatement(p)
    ? '戻り値'
    : ts.isVariableDeclaration(p)
      ? p.name.getText(ctx.sf)
      : ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken
        ? textOf(ctx, p.left)
        : undefined;
  pushRule(ctx, bin, 'formula', [], target ? `${target} = ${textOf(ctx, bin)}` : textOf(ctx, bin));
}

// ---------- 境界 ----------

type Op = 'lt' | 'le' | 'gt' | 'ge';
type Sem = 'accept' | 'reject' | 'other';
const FLIP: Readonly<Record<Op, Op>> = { lt: 'gt', le: 'ge', gt: 'lt', ge: 'le' };
/** 否定（弾く条件 → 受け付ける条件） */
const NEG: Readonly<Record<Op, Op>> = { lt: 'ge', le: 'gt', gt: 'le', ge: 'lt' };

function opOf(k: ts.SyntaxKind): Op | undefined {
  if (k === ts.SyntaxKind.LessThanToken) return 'lt';
  if (k === ts.SyntaxKind.LessThanEqualsToken) return 'le';
  if (k === ts.SyntaxKind.GreaterThanToken) return 'gt';
  if (k === ts.SyntaxKind.GreaterThanEqualsToken) return 'ge';
  return undefined;
}

function isLogical(n: ts.Node): boolean {
  return (
    ts.isBinaryExpression(n) &&
    (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  );
}

function isNot(n: ts.Node): boolean {
  return ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken;
}

/** 分岐先が「不正として弾く」処理か（throw・エラー表示・errors.push・return false） */
function isRejecting(ctx: FileCtx, st: ts.Statement): boolean {
  let hit = false;
  walk(st, (n) => {
    if (ts.isThrowStatement(n)) hit = true;
    else if (ts.isReturnStatement(n) && n.expression?.kind === ts.SyntaxKind.FalseKeyword) hit = true;
    else if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      if (/error|alert|warn|invalid|fail|reject/i.test(name)) hit = true;
      if (name === 'push' && ts.isPropertyAccessExpression(n.expression) && /error/i.test(textOf(ctx, n.expression.expression))) hit = true;
    }
  });
  return hit;
}

interface Norm {
  subj: ts.Expression;
  valE: ts.Expression;
  op: Op;
}

function normalize(ctx: FileCtx, bin: ts.BinaryExpression): Norm | undefined {
  const op = opOf(bin.operatorToken.kind);
  if (!op) return undefined;
  const r = resolveNumber(ctx, bin.right) !== undefined || isConfigExpr(ctx, bin.right);
  const l = resolveNumber(ctx, bin.left) !== undefined || isConfigExpr(ctx, bin.left);
  if (r && !l) return { subj: bin.left, valE: bin.right, op };
  if (l && !r) return { subj: bin.right, valE: bin.left, op: FLIP[op] };
  return undefined;
}

function semanticsOf(ctx: FileCtx, bin: ts.BinaryExpression, subjText: string): Sem {
  let n: ts.Node = bin;
  let neg = 0;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || isNot(n.parent) || isLogical(n.parent))) {
    if (isNot(n.parent)) neg++;
    n = n.parent;
  }
  const top = n.parent;
  if (top && ts.isIfStatement(top) && top.expression === n && isRejecting(ctx, top.thenStatement)) {
    return neg % 2 === 0 ? 'reject' : 'accept';
  }
  let p: ts.Node = bin.parent;
  while (ts.isParenthesizedExpression(p)) p = p.parent;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    const other = unparen(p.left === bin || unparen(p.left) === bin ? p.right : p.left);
    const o = ts.isBinaryExpression(other) ? normalize(ctx, other) : undefined;
    if (o && textOf(ctx, o.subj) === subjText) return 'accept';
  }
  return 'other';
}

function interpret(op: Op, sem: Sem): { bound: Boundary['bound']; inclusive: boolean } {
  if (sem === 'other') return { bound: 'threshold', inclusive: op === 'le' || op === 'ge' };
  const accept: Record<Op, { bound: 'lower' | 'upper'; inclusive: boolean }> = {
    ge: { bound: 'lower', inclusive: true },
    gt: { bound: 'lower', inclusive: false },
    le: { bound: 'upper', inclusive: true },
    lt: { bound: 'upper', inclusive: false },
  };
  return accept[sem === 'accept' ? op : NEG[op]];
}

/** 内側（満たす）・外側（満たさない）の例 */
function examples(op: Op, sem: Sem, bound: Boundary['bound'], inclusive: boolean, v: number): [number, number] {
  const s = Number.isInteger(v) ? 1 : 0.1;
  if (sem === 'other') {
    if (op === 'lt') return [v - s, v];
    if (op === 'le') return [v, v + s];
    if (op === 'gt') return [v + s, v];
    return [v, v - s];
  }
  if (bound === 'lower') return inclusive ? [v, v - s] : [v + s, v];
  return inclusive ? [v, v + s] : [v - s, v];
}

function namedBound(name: string): Boundary['bound'] | undefined {
  if (/retr|attempt/i.test(name)) return 'retry';
  if (/timeout|delay/i.test(name)) return 'timeout';
  if (/interval|tick|period/i.test(name)) return 'interval';
  return undefined;
}

export function pushBoundary(ctx: FileCtx, node: ts.Node, b: Omit<Boundary, 'id' | 'source' | 'evidence'> & { appliesWhen?: string }, extra: ts.Node[] = []): void {
  const line = lineOf(ctx, node);
  const id = makeId(ctx, 'BND', `${b.subject}-${b.bound}`, line);
  ctx.out.boundaries.push({ id, source: [srcOf(ctx, node), ...extra.map((e) => srcOf(ctx, e))], evidence: 'fact', ...b });
  if (b.unit === null && b.bound !== 'pattern') {
    ctx.numbers.push({ label: `${b.subject}=${b.value}`, line, value: b.value, category: 'unit-unknown', relatedId: id });
  }
}

function comparisonBoundary(ctx: FileCtx, bin: ts.BinaryExpression): void {
  const norm = normalize(ctx, bin);
  if (!norm) return;
  const { subj, valE, op } = norm;
  const s = unparen(subj);
  const isLen = ts.isPropertyAccessExpression(s) && s.name.text === 'length';
  const subject = isLen ? textOf(ctx, s.expression) : textOf(ctx, s);
  const sem = semanticsOf(ctx, bin, textOf(ctx, subj));
  const num = resolveNumber(ctx, valE);
  let { bound, inclusive } = interpret(op, sem);
  const named = num?.constName ? namedBound(num.constName) : undefined;
  const lenUnit = isLen && sem !== 'other';
  if (named) bound = named;
  else if (lenUnit && bound === 'upper') bound = 'length';
  const unit = lenUnit ? '文字' : unitFromName(num?.constName ?? subject);
  const fmt = (x: number): string => (lenUnit ? `${fmtNum(x)} 文字` : fmtNum(x));
  let inside = '（設定値に依存）';
  let outside = '（設定値に依存）';
  if (num) {
    const bKind = bound === 'lower' ? 'lower' : 'upper';
    [inside, outside] = examples(op, sem, bKind, inclusive, num.value).map(fmt) as [string, string];
  }
  const cfg = num ? undefined : valE;
  const applies = appliesWhen(ctx, bin, subject);
  pushBoundary(
    ctx,
    bin,
    {
      ...(applies ? { appliesWhen: applies } : {}),
      subject,
      bound,
      value: num ? fmtNum(num.value) : textOf(ctx, valE),
      inclusive,
      unit,
      insideExample: inside,
      outsideExample: outside,
      configurable: cfg ? 'config' : 'fixed',
      configSource: cfg ? srcOf(ctx, cfg) : undefined,
    },
    num?.constNode ? [num.constNode] : [],
  );
}

/** 追加欄（schema 外）: 同じ && の中で、対象を含まない条件（例: ticketType === 'annual' && qty > 1 の前半） */
function appliesWhen(ctx: FileCtx, bin: ts.BinaryExpression, subject: string): string | undefined {
  let top: ts.Node = bin;
  while (
    ts.isParenthesizedExpression(top.parent) ||
    (ts.isBinaryExpression(top.parent) && top.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
  ) {
    top = top.parent;
  }
  if (top === bin) return undefined;
  const flat = (e: ts.Expression): ts.Expression[] => {
    const x = unparen(e);
    return ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [...flat(x.left), ...flat(x.right)] : [x];
  };
  const others = flat(top as ts.Expression).filter((e) => e !== bin && !new RegExp(`\\b${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(textOf(ctx, e)));
  return others.length > 0 ? others.map((e) => textOf(ctx, e)).join(' かつ ') : undefined;
}

// ---------- 正規表現 ----------

function classSample(body: string): string | null {
  let re: RegExp;
  try {
    re = new RegExp(`[${body}]`);
  } catch {
    return null;
  }
  return ['a', 'A', '0', '1', 'x', '_', '-', '.', ' '].find((c) => re.test(c)) ?? null;
}

function genExample(src: string): string | null {
  let i = 0;
  let out = '';
  while (i < src.length) {
    const c = src[i] as string;
    let atom: string | null;
    if (c === '^' || c === '$') {
      i++;
      continue;
    }
    if (c === '(' || c === ')' || c === '|') return null;
    if (c === '[') {
      let j = i + 1;
      while (j < src.length && src[j] !== ']') j += src[j] === '\\' ? 2 : 1;
      if (j >= src.length) return null;
      atom = classSample(src.slice(i + 1, j));
      i = j + 1;
    } else if (c === '\\') {
      const d = src[i + 1] ?? '';
      atom = ({ d: '1', D: 'a', w: 'a', W: '!', s: ' ', S: 'a' } as Record<string, string>)[d] ?? d;
      i += 2;
    } else {
      atom = c === '.' ? 'a' : c;
      i++;
    }
    if (atom === null) return null;
    let n = 1;
    const q = src[i];
    if (q === '+') i++;
    else if (q === '*' || q === '?') {
      n = 0;
      i++;
    } else if (q === '{') {
      const m = /^\{(\d+)(,\d*)?\}/.exec(src.slice(i));
      if (m) {
        n = Number(m[1]);
        i += m[0].length;
      }
    }
    if (src[i] === '?') i++;
    out += atom.repeat(n);
  }
  return out;
}

export function regexExamples(literal: string): { inside: string; outside: string } {
  const fail = { inside: '（例を生成できず）', outside: '（例を生成できず）' };
  const m = /^\/(.*)\/([a-z]*)$/s.exec(literal);
  if (!m) return fail;
  let re: RegExp;
  try {
    re = new RegExp(m[1] ?? '', (m[2] ?? '').replace(/[gy]/g, ''));
  } catch {
    return fail;
  }
  const inside = genExample(m[1] ?? '');
  if (inside === null || !re.test(inside)) return fail;
  const outside = [inside.slice(0, -1), inside + inside.slice(-1), '', '!', ' '].find((c) => !re.test(c));
  return { inside, outside: outside ?? fail.outside };
}

function patternBoundary(ctx: FileCtx, call: ts.CallExpression): void {
  if (!ts.isPropertyAccessExpression(call.expression)) return;
  const m = call.expression.name.text;
  let reNode: ts.Expression | undefined;
  let subj: ts.Expression | undefined;
  if (m === 'test' || m === 'exec') {
    reNode = call.expression.expression;
    subj = call.arguments[0];
  } else if (m === 'match' || m === 'search' || m === 'matchAll') {
    reNode = call.arguments[0];
    subj = call.expression.expression;
  }
  if (!reNode || !subj) return;
  let re: ts.Expression | undefined = unparen(reNode);
  if (ts.isIdentifier(re)) re = ctx.consts.get(re.text);
  if (!re || !ts.isRegularExpressionLiteral(re)) return;
  const ex = regexExamples(re.text);
  pushBoundary(ctx, call, {
    subject: textOf(ctx, subj),
    bound: 'pattern',
    value: re.text,
    inclusive: null,
    unit: null,
    insideExample: ex.inside,
    outsideExample: ex.outside,
    configurable: 'fixed',
  });
}

/** 名前付きの数値定数（TIMEOUT_MS・MAX_RETRIES・MAX_x・MIN_x・THRESHOLD） */
function constBoundaries(ctx: FileCtx): void {
  for (const [name, init] of ctx.consts) {
    const num = resolveNumber(ctx, init);
    if (!num) continue;
    const bound =
      namedBound(name) ??
      (/(^|_)(MAX|LIMIT)(_|$)|^max[A-Z]|Limit$/.test(name)
        ? 'upper'
        : /(^|_)MIN(_|$)|^min[A-Z]/.test(name)
          ? 'lower'
          : /threshold/i.test(name)
            ? 'threshold'
            : undefined);
    if (!bound) continue;
    const unit = unitFromName(name);
    const s = Number.isInteger(num.value) ? 1 : 0.1;
    const u = unit ? ` ${unit}` : '';
    pushBoundary(ctx, init.parent, {
      subject: name,
      bound,
      value: fmtNum(num.value),
      inclusive: null,
      unit,
      insideExample: `${fmtNum(num.value)}${u}`,
      outsideExample: `${fmtNum(bound === 'lower' ? num.value - s : num.value + s)}${u}`,
      configurable: isConfigExpr(ctx, init) ? 'config' : 'fixed',
    });
  }
}

const NUM_ARG_CALLS = /^(padStart|padEnd|slice|substring|substr|toFixed|toPrecision|parseInt|splice|charAt|at|repeat)$/;

/** 関数内の意味の読めない数値（0・1 と境界・添字・桁指定を除く） */
function magicNumbers(ctx: FileCtx): void {
  const seen = new Set<string>();
  walk(ctx.sf, (n) => {
    if (!ts.isNumericLiteral(n) || !enclosingFn(n)) return;
    const v = Number(n.text.replace(/_/g, ''));
    if (v === 0 || v === 1) return;
    let top: ts.Node = n;
    while (ts.isParenthesizedExpression(top.parent) || ts.isPrefixUnaryExpression(top.parent)) top = top.parent;
    const p: ts.Node = top.parent;
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return;
    if (ts.isCallExpression(p) && NUM_ARG_CALLS.test(calleeName(p))) return;
    if (ts.isBinaryExpression(p)) {
      if (opOf(p.operatorToken.kind)) return; // 境界として扱い済み
      if (/status/i.test(textOf(ctx, p.left === top ? p.right : p.left))) return;
    }
    const fn = fnNameOf(ctx, n);
    const key = `${fn}:${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    const fnId = fnIdOf(ctx, n);
    ctx.numbers.push({ label: `${fn} の ${n.text}`, line: lineOf(ctx, n), value: fmtNum(v), category: 'magic-number', relatedId: fnId });
  });
}

export function collectRules(ctx: FileCtx): void {
  walk(ctx.sf, (n) => {
    if (ts.isIfStatement(n)) {
      if (!(ts.isIfStatement(n.parent) && n.parent.elseStatement === n)) ifRule(ctx, n);
    } else if (ts.isSwitchStatement(n)) switchRule(ctx, n);
    else if (ts.isConditionalExpression(n)) {
      if (!(ts.isConditionalExpression(n.parent) && n.parent.whenFalse === n)) ternaryRule(ctx, n);
    } else if (ts.isBinaryExpression(n)) {
      if (isArith(n)) formulaRule(ctx, n);
      else if (opOf((n as ts.BinaryExpression).operatorToken.kind)) comparisonBoundary(ctx, n as ts.BinaryExpression);
    } else if (ts.isCallExpression(n)) patternBoundary(ctx, n);
  });
  constBoundaries(ctx);
  magicNumbers(ctx);
  unitSummary(ctx);
}

const SUMMARY = {
  'magic-number': { topic: '意味の読めない数値', question: '名前が無く意味を読み取れない数値' },
  'unit-unknown': { topic: '単位の読めない数値', question: 'ソースから単位を読み取れない数値' },
} as const;

/** 単位不明（unit-unknown）と意味不明（magic-number）を区分ごと・ファイルごとに 1 件へ集約する。
 *  同じ行・同じ値が両方に当たるときは magic-number だけに載せる */
function unitSummary(ctx: FileCtx): void {
  const magic = new Set(ctx.numbers.filter((x) => x.category === 'magic-number').map((x) => `${x.line}:${x.value}`));
  for (const category of ['unit-unknown', 'magic-number'] as const) {
    const items = ctx.numbers
      .filter((x) => x.category === category && (category === 'magic-number' || !magic.has(`${x.line}:${x.value}`)))
      .sort((a, b) => a.line - b.line);
    if (items.length === 0) continue;
    const list = items.map((x) => `${x.label}（${x.line} 行）`).join('、');
    ctx.out.unknowns.push({
      id: makeId(ctx, 'UNK', category, 1),
      source: items.map((x) => ({ file: ctx.file, line: x.line })),
      evidence: 'unknown',
      topic: `${ctx.file} の${SUMMARY[category].topic} ${items.length} 件`,
      question: `${SUMMARY[category].question}: ${list}。それぞれの単位・意味と、固定値か設定値かを確認する`,
      relatedIds: [...new Set(items.flatMap((x) => (x.relatedId ? [x.relatedId] : [])))],
      category,
    });
  }
}

