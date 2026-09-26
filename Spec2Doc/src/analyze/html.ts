// HTML 解析（parse5）: ファイル＝画面。画面部品・制約属性・遷移先・境界・既定値・外部 script を抽出する。
// REQ-F-007・010・022・032・033・037。全要素 evidence='fact'。

import { parse } from 'parse5';
import type { Boundary, DefaultValue, EventHandler, IR, Screen, SourceRef, UiElement, UiKind, Unknown } from '../ir/schema.ts';

export interface SourceFile {
  path: string;
  abs: string;
  text: string;
}

/** 外部 script の読み込み（依存の抽出に渡す） */
export interface ScriptRef {
  src: string;
  line: number;
}

/** HTML 内に直接書いた script・style。line は要素の開始行（本文 1 行目＝この行） */
export interface InlineBlock {
  kind: 'script' | 'style';
  text: string;
  line: number;
}

export interface Heading {
  level: 1 | 2 | 3;
  text: string;
  line: number;
}

/** 用語集の材料として h1〜h3 の見出しを持つ画面。schema は変えず、Screen の上位互換として IR に載る */
export type ScreenWithHeadings = Screen & { headings: Heading[] };

export type HtmlResult = Pick<IR, 'uiElements' | 'boundaries' | 'defaults' | 'eventHandlers' | 'unknowns'> & {
  screens: ScreenWithHeadings[];
  scripts: ScriptRef[];
  inline: InlineBlock[];
};

const JS_TYPES = new Set(['', 'module', 'text/javascript']);

interface PNode {
  nodeName: string;
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: PNode[];
  content?: PNode;
  value?: string;
  sourceCodeLocation?: { startLine: number; endLine: number } | null;
}

interface Ctx {
  formId?: string;
  formAction?: string;
  labelText?: string;
}

const CONSTRAINT_ATTRS = ['type', 'required', 'min', 'max', 'maxlength', 'minlength', 'pattern', 'step', 'value'] as const;
const STATE_CLASS = /^(is-|has-)|^(error|active|open|hidden|disabled|selected|invalid)$/;

export const slug = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '_');
const attr = (n: PNode, name: string): string | undefined => n.attrs?.find((a) => a.name === name)?.value;
const lineOf = (n: PNode): number => n.sourceCodeLocation?.startLine ?? 1;
const children = (n: PNode): PNode[] => (n.nodeName === 'template' ? (n.content?.childNodes ?? []) : (n.childNodes ?? []));

function textOf(n: PNode): string {
  if (n.nodeName === '#text') return n.value ?? '';
  if (n.nodeName === 'script' || n.nodeName === 'style') return '';
  return children(n).map(textOf).join(' ');
}
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

function walk(n: PNode, fn: (el: PNode, ctx: Ctx) => Ctx | void, ctx: Ctx = {}): void {
  const next = n.tagName ? (fn(n, ctx) ?? ctx) : ctx;
  for (const c of children(n)) walk(c, fn, next);
}

function kindOf(el: PNode): UiKind | null {
  const t = el.tagName ?? '';
  if (t === 'input') return attr(el, 'type') === 'submit' || attr(el, 'type') === 'button' ? 'button' : 'input';
  if (t === 'select' || t === 'textarea' || t === 'button' || t === 'form' || t === 'output') return t;
  if (t === 'a' && attr(el, 'href') !== undefined) return 'link';
  const role = attr(el, 'role');
  if (role === 'alert' || role === 'status' || attr(el, 'aria-live') !== undefined) return 'output';
  const classes = (attr(el, 'class') ?? '').split(/\s+/).filter(Boolean);
  if (attr(el, 'id') && classes.some((c) => STATE_CLASS.test(c))) return 'output';
  return null;
}

/** label[for]・包む label・aria-label・aria-labelledby・placeholder・テキストの順で表示語を決める */
function labelOf(el: PNode, ctx: Ctx, labelsFor: Map<string, string>, byId: Map<string, PNode>): string | undefined {
  const id = attr(el, 'id');
  const byFor = id ? labelsFor.get(id) : undefined;
  const labelledBy = attr(el, 'aria-labelledby')
    ?.split(/\s+/)
    .map((x) => (byId.get(x) ? clean(textOf(byId.get(x)!)) : ''))
    .join(' ')
    .trim();
  const own = el.tagName === 'select' || el.tagName === 'textarea' ? '' : clean(textOf(el));
  const candidates = [byFor, ctx.labelText, attr(el, 'aria-label'), labelledBy, attr(el, 'placeholder'), own, attr(el, 'title')];
  if (el.tagName === 'input' && ['submit', 'button'].includes(attr(el, 'type') ?? '')) candidates.push(attr(el, 'value'));
  return candidates.map((c) => (c ? clean(c) : '')).find((c) => c !== '');
}

function constraintsOf(el: PNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of CONSTRAINT_ATTRS) {
    const v = attr(el, name);
    if (v !== undefined) out[name] = name === 'required' ? 'true' : v;
  }
  if (el.tagName === 'select') {
    const opts: string[] = [];
    walk(el, (o) => {
      if (o.tagName === 'option') opts.push(attr(o, 'value') ?? clean(textOf(o)));
    });
    if (opts.length > 0) out['options'] = opts.join(',');
  }
  return out;
}

function navigationOf(el: PNode, kind: UiKind, ctx: Ctx): string | undefined {
  if (kind === 'link') return attr(el, 'href');
  if (kind === 'form') return attr(el, 'action');
  if (kind !== 'button') return undefined;
  const type = attr(el, 'type') ?? (el.tagName === 'button' ? 'submit' : 'button');
  if (type !== 'submit' || !ctx.formId) return undefined;
  return attr(el, 'formaction') ?? ctx.formAction;
}

// ---------- 境界（REQ-F-010・033） ----------

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function patternRegex(p: string): RegExp | null {
  for (const flags of ['v', 'u']) {
    try {
      return new RegExp(`^(?:${p})$`, flags);
    } catch {
      /* 次のフラグで試す */
    }
  }
  return null;
}

const SAMPLE_CHARS = ['a', 'A', '0', '.', '-', '_', '@', ' ', 'z', 'Z', '9'];

/** 単純な正規表現（文字クラス・エスケープ・量指定子）から一致する例を作る。作れなければ null */
function sampleFor(p: string): string | null {
  let out = '';
  let i = 0;
  let last = '';
  while (i < p.length) {
    const ch = p[i]!;
    if ('()|^$'.includes(ch)) return null;
    if (ch === '[') {
      const end = p.indexOf(']', i + 2);
      if (end < 0) return null;
      const cls = p.slice(i, end + 1);
      const re = patternRegex(cls);
      const inner = cls.slice(1, -1).replace(/\\./g, '');
      last = [...SAMPLE_CHARS, ...inner].find((c) => re?.test(c)) ?? '';
      if (last === '') return null;
      i = end + 1;
    } else if (ch === '\\') {
      const e = p[i + 1] ?? '';
      last = e === 'd' ? '0' : e === 'w' ? 'a' : e === 's' ? ' ' : /[A-Za-z]/.test(e) ? '' : e;
      if (last === '') return null;
      i += 2;
    } else if (ch === '{') {
      const m = /^\{(\d+)(,\d*)?\}/.exec(p.slice(i));
      if (!m) return null;
      out += last.repeat(Math.max(0, Number(m[1]) - 1));
      i += m[0].length;
      continue;
    } else if (ch === '*' || ch === '?') {
      out = out.slice(0, out.length - last.length);
      i += 1;
      continue;
    } else if (ch === '+') {
      i += 1;
      continue;
    } else {
      last = ch === '.' ? 'a' : ch;
      i += 1;
    }
    out += last;
  }
  return out;
}

function patternExamples(p: string): { inside: string; outside: string } {
  const re = patternRegex(p);
  const sample = sampleFor(p);
  const inside = re && sample !== null && re.test(sample) ? sample : '（例を生成できない）';
  const outs = ['!', ' ', '', `${inside}!`, 'あ'];
  const outside = (re && outs.find((o) => !re.test(o))) ?? '（例を生成できない）';
  return { inside, outside: outside === '' ? '（空文字）' : outside };
}

function boundariesOf(ui: UiElement, src: SourceRef[]): Boundary[] {
  const c = ui.constraints;
  const subject = ui.label ?? ui.name ?? ui.domId ?? ui.id;
  const base = { source: src, evidence: 'fact' as const, subject, uiElementId: ui.id, configurable: 'fixed' as const };
  const step = num(c['step']) ?? 1;
  const out: Boundary[] = [];
  const add = (key: string, b: Omit<Boundary, keyof typeof base | 'id'>) => out.push({ ...base, id: `BND-${ui.id}-${key}`, ...b });
  const numeric = c['type'] === 'number' || c['type'] === 'range';
  for (const [key, bound, sign] of [['min', 'lower', -1], ['max', 'upper', 1]] as const) {
    const raw = c[key];
    if (raw === undefined) continue;
    const n = num(raw);
    const outside = numeric && n !== null ? String(n + sign * step) : sign < 0 ? `${raw} より前` : `${raw} より後`;
    add(key, { bound, value: raw, inclusive: true, unit: numeric || !c['type'] ? null : c['type'], insideExample: raw, outsideExample: outside });
  }
  const maxlen = num(c['maxlength']);
  if (maxlen !== null) {
    add('maxlength', { bound: 'length', value: String(maxlen), inclusive: true, unit: '文字', insideExample: `${maxlen}文字`, outsideExample: `${maxlen + 1}文字` });
  }
  const minlen = num(c['minlength']);
  if (minlen !== null) {
    add('minlength', { bound: 'lower', value: String(minlen), inclusive: true, unit: '文字', insideExample: `${minlen}文字`, outsideExample: `${Math.max(0, minlen - 1)}文字` });
  }
  if (c['pattern'] !== undefined) {
    const ex = patternExamples(c['pattern']);
    add('pattern', { bound: 'pattern', value: c['pattern'], inclusive: null, unit: null, insideExample: ex.inside, outsideExample: ex.outside });
  }
  return out;
}

// ---------- 本体 ----------

function indexDocument(doc: PNode): { labelsFor: Map<string, string>; byId: Map<string, PNode>; title: string; headings: Heading[] } {
  const labelsFor = new Map<string, string>();
  const byId = new Map<string, PNode>();
  let title = '';
  let h1 = '';
  const headings: Heading[] = [];
  walk(doc, (el) => {
    const hm = /^h([123])$/.exec(el.tagName ?? '');
    const htext = hm ? clean(textOf(el)) : '';
    if (hm && htext) headings.push({ level: Number(hm[1]) as 1 | 2 | 3, text: htext, line: lineOf(el) });
    const id = attr(el, 'id');
    if (id) byId.set(id, el);
    const f = attr(el, 'for');
    if (el.tagName === 'label' && f) labelsFor.set(f, clean(textOf(el)));
    if (el.tagName === 'title' && !title) title = clean(textOf(el));
    if (el.tagName === 'h1' && !h1) h1 = clean(textOf(el));
  });
  return { labelsFor, byId, title: title || h1, headings };
}

export function analyzeHtml(file: SourceFile): HtmlResult {
  const doc = parse(file.text, { sourceCodeLocationInfo: true }) as unknown as PNode;
  const { labelsFor, byId, title, headings } = indexDocument(doc);
  const screenId = `SCR-${slug(file.path)}`;
  const res: HtmlResult = { screens: [], uiElements: [], boundaries: [], defaults: [], eventHandlers: [], unknowns: [], scripts: [], inline: [] };
  const used = new Set<string>();
  const kindCount = new Map<string, number>();

  walk(doc, (el, ctx) => {
    const src: SourceRef[] = [{ file: file.path, line: lineOf(el), endLine: el.sourceCodeLocation?.endLine }];
    const scriptSrc = el.tagName === 'script' ? attr(el, 'src') : undefined;
    if (scriptSrc) res.scripts.push({ src: scriptSrc, line: lineOf(el) });
    const scriptType = (attr(el, 'type') ?? '').trim().toLowerCase();
    if ((el.tagName === 'script' && !scriptSrc && JS_TYPES.has(scriptType)) || el.tagName === 'style') {
      const text = children(el).map((c) => c.value ?? '').join('');
      if (text.trim() !== '') res.inline.push({ kind: el.tagName === 'style' ? 'style' : 'script', text, line: lineOf(el) });
    }
    const kind = kindOf(el);
    const next: Ctx = el.tagName === 'label' && !attr(el, 'for') ? { ...ctx, labelText: clean(textOf(el)) } : ctx;
    if (!kind) return next;

    const domId = attr(el, 'id');
    const name = attr(el, 'name');
    const n = (kindCount.get(kind) ?? 0) + 1;
    kindCount.set(kind, n);
    const baseId = `UI-${slug(file.path)}-${slug(domId ?? name ?? `${kind}${n}`)}`;
    let id = baseId;
    for (let k = 2; used.has(id); k++) id = `${baseId}-${k}`;
    used.add(id);

    const ui: UiElement = {
      id,
      source: src,
      evidence: 'fact',
      screenId,
      kind,
      constraints: constraintsOf(el),
      ...(domId ? { domId } : {}),
      ...(name ? { name } : {}),
    };
    const label = kind === 'form' ? undefined : labelOf(el, ctx, labelsFor, byId);
    const nav = navigationOf(el, kind, ctx);
    const full: UiElement = { ...ui, ...(label ? { label } : {}), ...(nav !== undefined ? { navigatesTo: nav } : {}) };
    res.uiElements.push(full);
    res.boundaries.push(...boundariesOf(full, src));
    if (full.constraints['value'] !== undefined && (kind === 'input' || kind === 'textarea')) {
      res.defaults.push({ id: `DEF-${id}`, source: src, evidence: 'fact', subject: label ?? name ?? domId ?? id, value: full.constraints['value'], context: 'input', uiElementId: id } satisfies DefaultValue);
    }
    for (const a of el.attrs ?? []) {
      if (!a.name.startsWith('on')) continue;
      res.eventHandlers.push({ id: `EVH-${id}-${a.name}`, source: src, evidence: 'fact', target: domId ? `#${domId}` : id, uiElementId: id, event: a.name.slice(2), handler: a.value.trim() } satisfies EventHandler);
    }
    return kind === 'form' ? { ...next, formId: id, formAction: attr(el, 'action') } : next;
  });

  const unitless = res.boundaries.filter((b) => b.unit === null && (b.bound === 'lower' || b.bound === 'upper'));
  const unitIds = [...new Set(unitless.map((b) => b.uiElementId ?? b.id))];
  if (unitIds.length > 0) {
    res.unknowns.push({
      id: `UNK-${screenId}-unit`,
      source: unitless.flatMap((b) => b.source),
      evidence: 'unknown',
      topic: '数値入力の単位',
      question: `次の入力項目の min/max の単位がソースから読めない: ${unitless.map((b) => `${b.subject}（${b.value}）`).join('、')}`,
      relatedIds: unitIds,
      category: 'unit-unknown',
    } satisfies Unknown);
  }

  const screen: ScreenWithHeadings = {
    id: screenId,
    source: [{ file: file.path, line: 1 }],
    evidence: 'fact',
    file: file.path,
    title: title || file.path,
    isErrorView: /(^|[/_.-])(error|errors|404|500|fail|failure)([/_.-]|$)/i.test(file.path),
    elementIds: res.uiElements.map((u) => u.id),
    headings,
  };
  return { ...res, screens: [screen] };
}
