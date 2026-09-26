// 生成層の共通部: GenCtx・D09 採番・Provenance を付けた部品（REQ-F-017・025）。
// D04〜D08・D11・D12 の担当もここを import する。公開 API を変えるときは全担当に知らせる。

import type { Condition, EventHandler, Evidence, FunctionInfo, IR, IrNode, SourceRef, Unknown } from '../ir/schema.ts';
import type { Boundary, ErrorInfo, Integration } from '../ir/schema.ts';
import {
  DOC_TITLES,
  type Block,
  type DocId,
  type Document,
  type ListItem,
  type ParagraphBlock,
  type Provenance,
  type Section,
  type TableBlock,
  type TableRow,
} from '../doc/model.ts';
import type { ExplainRequest, ExplainResult, LlmClient } from '../llm/index.ts';

// ---------- D09 登録簿 ----------

export interface D09Entry {
  /** D09 番号（`D09-1` から採番） */
  no: string;
  topic: string;
  question: string;
  category: Unknown['category'] | 'zero-result';
  relatedIds: string[];
  source: SourceRef[];
  /** 最初に登録した文書（D02 等）。IR 由来は 'IR' */
  origin: DocId | 'IR';
  /** 同じ対象・同じ区分としてまとめた事項の参照元（重複なし、登録順） */
  origins?: (DocId | 'IR')[];
  /** 事項が解消済み（例: LLM が全文書で説明文を生成した）。D09 の行は番号だけ残し「該当なし」とする */
  resolved?: boolean;
}

export interface D09Input {
  topic: string;
  question: string;
  category?: D09Entry['category'];
  relatedIds?: string[];
  source?: SourceRef[];
  origin: DocId | 'IR';
  /** 同じ事項を二重登録しないためのキー。省略時は topic+question */
  key?: string;
  /** 番号の予約だけ行う（使用した文書として記録しない） */
  reserve?: boolean;
}

/** 不明事項を登録して D09 番号を返す。同じキーは同じ番号を返す（再実行で番号が変わらない: REQ-F-032） */
export class D09Registry {
  #entries: D09Entry[] = [];
  #byKey = new Map<string, string>();
  #uses = new Map<string, readonly (DocId | 'IR')[]>();

  register(input: D09Input): string {
    const key = input.key ?? `${input.topic}\u0000${input.question}`;
    if (!input.reserve) this.#uses.set(key, [...(this.#uses.get(key) ?? []), input.origin]);
    const found = this.#byKey.get(key);
    if (found) {
      if (!input.reserve) this.#addOrigin(found, input.origin);
      return found;
    }
    const same = input.reserve ? undefined : this.#sameSubject(input);
    if (same) {
      // 同じ対象・同じ区分の事項は 1 件にまとめ、関連 ID・根拠位置・参照元を足す（検証 P3 #6・#11）
      this.#byKey.set(key, same.no);
      this.#entries = this.#entries.map((e) =>
        e.no === same.no
          ? {
              ...e,
              relatedIds: [...new Set([...e.relatedIds, ...(input.relatedIds ?? [])])],
              source: uniqueSources([...e.source, ...(input.source ?? [])]),
            }
          : e,
      );
      this.#addOrigin(same.no, input.origin);
      return same.no;
    }
    const no = `D09-${this.#entries.length + 1}`;
    this.#entries = [
      ...this.#entries,
      {
        no,
        topic: input.topic,
        question: input.question,
        category: input.category ?? 'other',
        relatedIds: [...(input.relatedIds ?? [])],
        source: uniqueSources(input.source ?? []),
        origin: input.origin,
        origins: input.reserve ? [] : [input.origin],
      },
    ];
    this.#byKey.set(key, no);
    return no;
  }

  /** まとめる対象: 区分が同じで（その他・検出なしを除く）、関連 ID か根拠位置（ファイル・行）が重なる事項 */
  #sameSubject(input: D09Input): D09Entry | undefined {
    const category = input.category ?? 'other';
    if (category === 'other' || category === 'zero-result') return undefined;
    const ids = new Set(input.relatedIds ?? []);
    const locs = new Set((input.source ?? []).map((s) => `${s.file}:${s.line}`));
    return this.#entries.find(
      (e) =>
        e.category === category &&
        !e.resolved &&
        (e.relatedIds.some((id) => ids.has(id)) || e.source.some((s) => locs.has(`${s.file}:${s.line}`))),
    );
  }

  #addOrigin(no: string, origin: DocId | 'IR'): void {
    this.#entries = this.#entries.map((e) => {
      if (e.no !== no) return e;
      const origins = e.origins ?? [];
      return origins.includes(origin) ? e : { ...e, origins: [...origins, origin] };
    });
  }

  /** IR の Unknown を登録する（キーは Unknown.id） */
  registerUnknown(u: Unknown, by: DocId | 'IR' = 'IR'): string {
    return this.register({
      key: `ir:${u.id}`,
      topic: u.topic,
      question: u.question,
      category: u.category,
      relatedIds: u.relatedIds,
      source: u.source,
      origin: by,
    });
  }

  /** IR の Unknown の D09 番号（未登録なら undefined） */
  lookupUnknown(unknownId: string): string | undefined {
    return this.#byKey.get(`ir:${unknownId}`);
  }

  /** キーの事項を登録した文書（予約は含まない） */
  usedBy(key: string): readonly (DocId | 'IR')[] {
    return [...(this.#uses.get(key) ?? [])];
  }

  /** 番号を変えずに事項の内容を差し替える */
  replace(no: string, patch: Partial<Omit<D09Entry, 'no'>>): void {
    this.#entries = this.#entries.map((e) => (e.no === no ? { ...e, ...patch, no } : e));
  }

  entries(): readonly D09Entry[] {
    return [...this.#entries];
  }
}

/** 根拠位置の重複を除く（同じファイル・行・終了行） */
export function uniqueSources(source: readonly SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return source.filter((s) => {
    const k = `${s.file}:${s.line}:${s.endLine ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface GenCtx {
  llm: LlmClient;
  /** 不明事項を登録して D09 番号を返す */
  d09: D09Registry;
  generatedAt: string;
  commit?: string;
  /** 入力元の表示（Revision.source。絶対パスを含めない） */
  inputSource?: string;
}

export type DocBuilder = (ir: IR, ctx: GenCtx) => Document | Promise<Document>;

// ---------- Provenance ----------

/** IR 要素から根拠を作る。evidence='unknown' の要素は D09 に登録して番号を付ける */
export function provOf(node: IrNode, ctx: GenCtx, origin: DocId, topic = node.id): Provenance {
  const evidence: Evidence = node.evidence ?? 'fact';
  if (evidence === 'inference') return { evidence, source: [...node.source], irIds: [node.id], origin: 'analysis' };
  if (evidence !== 'unknown') return { evidence, source: [...node.source], irIds: [node.id] };
  const d09Ref = ctx.d09.register({
    key: `node:${node.id}`,
    topic,
    question: `${topic} の内容をソースから確定できない`,
    relatedIds: [node.id],
    source: node.source,
    origin,
  });
  return { evidence, source: [...node.source], irIds: [node.id], d09Ref };
}

export function factProv(source: SourceRef[], irIds: string[] = []): Provenance {
  return { evidence: 'fact', source: [...source], irIds: [...irIds] };
}

export function unknownProv(d09Ref: string, irIds: string[] = [], source: SourceRef[] = []): Provenance {
  return { evidence: 'unknown', source: [...source], irIds: [...irIds], d09Ref };
}

/** 複数要素の根拠をまとめる（unknown が 1 つでもあれば unknown、次に inference） */
export function mergeProv(provs: Provenance[]): Provenance {
  const seen = new Set<string>();
  const source = provs.flatMap((p) => p.source).filter((s) => {
    const k = `${s.file}:${s.line}:${s.endLine ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const irIds = [...new Set(provs.flatMap((p) => p.irIds ?? []))];
  const unk = provs.find((p) => p.evidence === 'unknown');
  if (unk) return { evidence: 'unknown', source, irIds, ...(unk.d09Ref ? { d09Ref: unk.d09Ref } : {}) };
  const inferred = provs.filter((p) => p.evidence === 'inference');
  if (inferred.length === 0) return { evidence: 'fact', source, irIds };
  return { evidence: 'inference', source, irIds, origin: inferred.some((p) => p.origin === 'llm') ? 'llm' : 'analysis' };
}

/** 連携に結び付く境界値か（REQ-F-013）。対象名が連携 ID・URL・関数 ID に一致するか、
 *  timeout・retry で連携と同じファイルにあり、値が連携の数値（timeoutMs・retries）と一致するもの */
export function boundaryMatchesIntegration(b: Boundary, i: Integration): boolean {
  if (b.subject === i.id || b.subject === i.url || (i.functionId !== undefined && b.subject === i.functionId)) return true;
  const raw = b.bound === 'timeout' ? i.timeoutMs : b.bound === 'retry' ? i.retries : undefined;
  if (raw === undefined || b.value !== String(raw)) return false;
  const files = new Set(i.source.map((s) => s.file));
  return b.source.some((s) => files.has(s.file));
}

// ---------- エラーの発生条件（検証 P3 #4） ----------

/**
 * エラーの発生条件の表示。解析が確定できなかった条件は ErrorInfo.unknownId（IR の Unknown の id）で示され、
 * その D09 番号で「不明（D09-n）」とする。条件が空のときも不明として D09 に登録する
 */
export function errorCondition(e: ErrorInfo, ctx: GenCtx, origin: DocId, ir?: IR): { text: string; d09Ref?: string } {
  const unknownId = (e as ErrorInfo & { unknownId?: unknown }).unknownId;
  const c = e.condition.trim();
  if (typeof unknownId !== 'string' && c !== '') return { text: c };
  const known = typeof unknownId === 'string' ? ir?.unknowns.find((u) => u.id === unknownId) : undefined;
  const d09Ref = known
    ? ctx.d09.registerUnknown(known, origin)
    : ctx.d09.register({
        key: `error-condition:${e.id}`,
        topic: `エラー「${e.message}」の発生条件`,
        question: `「${e.message}」を出す条件をソースから確定できない（到達するかを含めて確認してください）`,
        category: 'unknown-value',
        relatedIds: [e.id],
        source: e.source,
        origin,
      });
  return { text: `不明（${d09Ref}）`, d09Ref };
}

/** エラー行の根拠。条件が不明なら「不明」と D09 番号を付ける */
export function errorProv(e: ErrorInfo, ctx: GenCtx, origin: DocId, ir?: IR): { cond: string; prov: Provenance } {
  const base = provOf(e, ctx, origin, `エラー ${e.message}`);
  const c = errorCondition(e, ctx, origin, ir);
  return { cond: c.text, prov: c.d09Ref && base.evidence !== 'unknown' ? { ...base, evidence: 'unknown', d09Ref: c.d09Ref } : base };
}

// ---------- 表示名 ----------

const ANONYMOUS = /<anonymous@([^>]+)>/g;

/** 無名関数の内部名 `<anonymous@app.js:24>` を「無名関数（app.js:24）」にする（ID は変えない） */
export function displayName(text: string): string {
  return text.replace(ANONYMOUS, '無名関数（$1）');
}

// ---------- 部品 ----------

export function para(text: string, prov: Provenance): ParagraphBlock {
  return { type: 'paragraph', text, ...prov };
}

export function row(cells: string[], prov: Provenance): TableRow {
  return { cells: [...cells], ...prov };
}

export function table(columns: string[], rows: TableRow[], caption?: string): TableBlock {
  return { type: 'table', columns: [...columns], rows, ...(caption ? { caption } : {}) };
}

export function item(text: string, prov: Provenance, children?: ListItem[]): ListItem {
  return { text, ...prov, ...(children && children.length > 0 ? { children } : {}) };
}

export function section(heading: string, level: Section['level'], blocks: Block[]): Section {
  return { heading, level, blocks };
}

export function srcText(source: SourceRef[]): string {
  return source.map((s) => `${s.file}:${s.line}${s.endLine && s.endLine !== s.line ? `-${s.endLine}` : ''}`).join(', ');
}

/** 0 件の節の本文。抽出して 0 件なら「検出なし」、抽出できない（解析失敗あり）なら「不明」。どちらも D09 に登録する */
export function zeroResult(
  ctx: GenCtx,
  origin: DocId,
  topic: string,
  opts: { uncertain: boolean; relatedIds?: string[]; source?: SourceRef[] },
): ParagraphBlock {
  const d09Ref = ctx.d09.register({
    topic,
    question: opts.uncertain
      ? `${topic}: 解析できなかったファイルがあり、有無を確定できない。仕様の有無を確認してください`
      : `${topic}: ソース上に検出なし。仕様として存在しないか確認してください`,
    category: opts.uncertain ? 'unknown-value' : 'zero-result',
    relatedIds: opts.relatedIds ?? [],
    source: opts.source ?? [],
    origin,
  });
  const text = opts.uncertain
    ? `不明（${d09Ref}）`
    : `ソース上に検出なし（抽出した結果 0 件。仕様として存在しないかは ${d09Ref} で確認）`;
  return para(text, unknownProv(d09Ref, opts.relatedIds ?? [], opts.source ?? []));
}

/** 解析に失敗したファイルがあるか（0 件を「不明」とするかの判断） */
export function hasFailedFiles(ir: IR): boolean {
  return ir.files.some((f) => f.status === 'failed');
}

/** LLM の説明文を段落にする。無効時は LLM_DISABLED_TEXT（evidence='unknown'） */
export async function explainPara(ctx: GenCtx, origin: DocId, req: ExplainRequest): Promise<ParagraphBlock> {
  const r = await ctx.llm.explain(req);
  return para(r.text, llmProv(ctx, origin, factProv([], [req.targetId]), r));
}

/**
 * LLM の結果の根拠。推測なら LLM の参照位置（無ければ base の位置）。
 * 無効・未生成なら「不明」とし、共通の D09 事項（説明文未生成）に結び付ける
 */
export const LLM_D09_KEY = 'llm-disabled';
export const LLM_ALL_GENERATED_TEXT = '該当なし（説明文はすべて生成済み）';
const LLM_D09_TOPIC = '説明文（業務上の意味）';
const LLM_D09_QUESTION = 'LLM 無効のため説明文を生成していない。業務上の意味は保守者が確認する';

/** 「説明文未生成」の D09 番号を先に予約する（LLM の有効・無効で番号がずれないように） */
export function reserveLlmD09(ctx: GenCtx): string {
  return ctx.d09.register({ key: LLM_D09_KEY, topic: LLM_D09_TOPIC, question: LLM_D09_QUESTION, origin: 'D01', reserve: true });
}

export function llmProv(ctx: GenCtx, origin: DocId, base: Provenance, r: ExplainResult): Provenance {
  if (r.evidence === 'inference') {
    return { evidence: 'inference', source: r.source.length > 0 ? [...r.source] : [...base.source], irIds: [...(base.irIds ?? [])], origin: 'llm' };
  }
  const d09Ref = ctx.d09.register({ key: LLM_D09_KEY, topic: LLM_D09_TOPIC, question: LLM_D09_QUESTION, origin });
  return { evidence: 'unknown', source: [...base.source], irIds: [...(base.irIds ?? [])], d09Ref };
}

/** 表の行の根拠。LLM が推測を返したら行全体を「推測」、そうでなければ base のまま */
export function rowProvWithLlm(base: Provenance, r: ExplainResult): Provenance {
  if (r.evidence !== 'inference') return base;
  return { evidence: 'inference', source: r.source.length > 0 ? [...r.source] : [...base.source], irIds: [...(base.irIds ?? [])], origin: 'llm' };
}

// ---------- 文書 ----------

export function revisionSection(ctx: GenCtx): Section {
  return section('改版履歴', 2, [
    ...(ctx.inputSource ? [para(`入力元: ${ctx.inputSource}`, factProv([]))] : []),
    table(
      ['版', '生成日時', '入力コミット', '変更箇所'],
      [row(['1', ctx.generatedAt, ctx.commit ?? '（なし）', '初版'], factProv([]))],
    ),
  ]);
}

/** 文書を組み立てる。見出し 1 と末尾の改版履歴を付ける */
/**
 * 見出しの段を揃える: 最上位の章を level 1 にずらし、親子の差を 1 に詰める（段を飛ばさない）。
 * 同格の章（1. 2. …）は同じ level のまま保たれる
 */
export function normalizeLevels(sections: readonly Section[]): Section[] {
  if (sections.length === 0) return [];
  const shift = Math.min(...sections.map((s) => s.level)) - 1;
  const out: Section[] = [];
  let prev = 0;
  for (const s of sections) {
    const level = Math.max(1, Math.min(s.level - shift, prev + 1, 4)) as Section['level'];
    out.push(level === s.level ? s : { ...s, level });
    prev = level;
  }
  return out;
}

export function makeDocument(id: DocId, ctx: GenCtx, body: Section[]): Document {
  return {
    id,
    title: DOC_TITLES[id], // 描画側が `${id} ${title}` を見出しにする
    sections: normalizeLevels([...body, revisionSection(ctx)]),
    revision: [
      {
        generatedAt: ctx.generatedAt,
        ...(ctx.commit ? { commit: ctx.commit } : {}),
        ...(ctx.inputSource ? { source: ctx.inputSource } : {}),
        changedSections: [],
      },
    ],
  };
}

/** builder が無い文書の代わり */
export function notImplementedDoc(id: DocId, ctx: GenCtx): Document {
  const d09Ref = ctx.d09.register({
    key: `not-implemented:${id}`,
    topic: `${id} ${DOC_TITLES[id]}`,
    question: `${id} の生成器が未実装のため内容を出力していない`,
    origin: id,
  });
  return makeDocument(id, ctx, [section('未実装', 2, [para(`${id} ${DOC_TITLES[id]} は未実装（${d09Ref}）`, unknownProv(d09Ref))])]);
}

// ---------- 並び・ID（文書をまたいで一意。入力が同じなら変わらない: REQ-F-032） ----------

export function bySource<T extends IrNode>(a: T, b: T): number {
  const sa = a.source[0];
  const sb = b.source[0];
  const fa = sa?.file ?? '';
  const fb = sb?.file ?? '';
  if (fa !== fb) return fa < fb ? -1 : 1;
  const la = sa?.line ?? 0;
  const lb = sb?.line ?? 0;
  if (la !== lb) return la - lb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function seqIds<T extends IrNode>(nodes: readonly T[], prefix: string): Map<string, string> {
  return new Map([...nodes].sort(bySource).map((n, i) => [n.id, `${prefix}-${String(i + 1).padStart(3, '0')}`]));
}

export interface Feature {
  /** 機能 ID（F-001〜） */
  no: string;
  fn: FunctionInfo;
  handlers: EventHandler[];
  category: string;
}

export interface IdMaps {
  features: Feature[];
  /** FunctionInfo.id → F-nnn */
  feature: Map<string, string>;
  /** Screen.id → S-nnn */
  screen: Map<string, string>;
  /** UiElement.id → P-nnn */
  part: Map<string, string>;
  /** ErrorInfo.id → E-nnn */
  error: Map<string, string>;
}

const idCache = new WeakMap<IR, IdMaps>();

function handlersOf(ir: IR, fn: FunctionInfo): EventHandler[] {
  return ir.eventHandlers.filter((h) => h.handler === fn.id || h.handler === fn.name);
}

/**
 * 機能 = イベントハンドラとして登録された関数と公開（export）関数。
 * どちらも無ければ名前付きの関数すべて（無ければ全関数）
 */
function deriveFeatures(ir: IR): Feature[] {
  const named = ir.functions.filter((f) => !f.name.startsWith('<anonymous'));
  const entry = ir.functions.filter((f) => f.exported || handlersOf(ir, f).length > 0);
  const base = entry.length > 0 ? entry : named.length > 0 ? named : ir.functions;
  return [...base].sort(bySource).map((fn, i) => {
    const handlers = handlersOf(ir, fn);
    const category =
      handlers.length > 0 ? `画面操作（${[...new Set(handlers.map((h) => h.event))].join('・')}）` : fn.exported ? '公開関数' : '内部処理';
    return { no: `F-${String(i + 1).padStart(3, '0')}`, fn, handlers, category };
  });
}

export function idMaps(ir: IR): IdMaps {
  const cached = idCache.get(ir);
  if (cached) return cached;
  const features = deriveFeatures(ir);
  const screen = seqIds(ir.screens, 'S');
  const screenOrder = (id: string): string => screen.get(id) ?? 'S-999';
  const parts = [...ir.uiElements].sort((a, b) => {
    const sa = screenOrder(a.screenId);
    const sb = screenOrder(b.screenId);
    return sa !== sb ? (sa < sb ? -1 : 1) : bySource(a, b);
  });
  const maps: IdMaps = {
    features,
    feature: new Map(features.map((f) => [f.fn.id, f.no])),
    screen,
    part: new Map(parts.map((p, i) => [p.id, `P-${String(i + 1).padStart(3, '0')}`])),
    error: seqIds(ir.errors, 'E'),
  };
  idCache.set(ir, maps);
  return maps;
}

// ---------- 条件の列挙展開（REQ-F-036） ----------

export function conditionItem(c: Condition, prov: Provenance): ListItem {
  switch (c.op) {
    case 'leaf':
      return item(c.text, c.source ? { ...prov, source: [c.source] } : prov);
    case 'and':
      return item('次のすべてを満たす', prov, c.items.map((x) => conditionItem(x, prov)));
    case 'or':
      return item('次のいずれかを満たす', prov, c.items.map((x) => conditionItem(x, prov)));
    case 'not':
      return item('次を満たさない', prov, [conditionItem(c.item, prov)]);
  }
}

// ---------- 標準 API の判定（D08・D12 が使う） ----------

/** ECMAScript 組み込み・DOM・Web API のグローバル名 */
const STANDARD_GLOBALS = new Set(
  ('document window console Math JSON Number String Boolean Array Object Date Promise parseInt parseFloat isNaN isFinite fetch ' +
    'setTimeout setInterval clearTimeout clearInterval localStorage sessionStorage navigator location history Intl Symbol Map Set ' +
    'WeakMap WeakSet RegExp Error TypeError RangeError encodeURIComponent decodeURIComponent encodeURI decodeURI alert confirm prompt ' +
    'requestAnimationFrame cancelAnimationFrame URL URLSearchParams FormData Headers Response Request AbortController Blob File ' +
    'FileReader crypto structuredClone queueMicrotask globalThis performance Reflect BigInt atob btoa event Event CustomEvent XMLHttpRequest').split(' '),
);

/** 組み込み型・DOM・Web API のメソッド名（受け手の型が分からないメンバー呼び出しの判定に使う） */
const STANDARD_METHODS = new Set(
  ('push pop shift unshift slice splice map filter reduce forEach find findIndex some every includes indexOf join concat sort reverse ' +
    'flat flatMap keys values entries trim trimStart trimEnd toUpperCase toLowerCase replace replaceAll split padStart padEnd startsWith ' +
    'endsWith test exec match matchAll toFixed toString toISOString getDay getDate getMonth getFullYear getHours getMinutes getTime ' +
    'json text then catch finally abort add remove toggle contains getItem setItem removeItem addEventListener removeEventListener ' +
    'preventDefault stopPropagation querySelector querySelectorAll getElementById getElementsByClassName appendChild removeChild ' +
    'insertBefore append prepend setAttribute getAttribute removeAttribute focus blur click submit reset closest matches get set has delete clear').split(' '),
);

/**
 * 呼び出しが標準 API（ECMAScript 組み込み・DOM・Web API）か。自前の関数に解決できた呼び出し・同名の自前関数があるものは対象外。
 * 判定: リテラルへのメソッド呼び出し／new と先頭の識別子が標準のグローバル／メンバー呼び出しのメソッド名が標準のメソッド
 */
export function isStandardApiCall(call: string, ownNames: ReadonlySet<string> = new Set()): boolean {
  const c = call.trim();
  if (/^[[/'"`\d]/.test(c)) return true;
  const head = /^(?:new\s+)?([A-Za-z_$][\w$]*)/.exec(c)?.[1];
  if (head === undefined || ownNames.has(head)) return false;
  if (STANDARD_GLOBALS.has(head)) return true;
  const beforeArgs = c.split('(')[0] ?? c;
  if (!beforeArgs.includes('.')) return false;
  const method = beforeArgs.split('.').at(-1) ?? '';
  return !ownNames.has(method) && STANDARD_METHODS.has(method);
}

// ---------- 範囲の注記（先行研究の示唆: Chikofsky & Cross 1990・Call Me Maybe 2025） ----------

/** 設計意図は復元できない旨（D01・D02・D11・D12 の冒頭）。LLM が有効でも同じ */
export const DESIGN_INTENT_NOTE =
  '本書はソースから確定できる事実を記述する。設計の意図・業務上の背景・値の選定理由はソースから復元できないため記述せず、D09（確認事項）に回す。LLM の説明文（推測）はこれらを補うものではない（出典: E. Chikofsky, J. Cross, "Reverse Engineering and Design Recovery: A Taxonomy", IEEE Software, 1990, DOI: 10.1109/52.43044）';

export const STATIC_LIMIT_HEADING = '静的解析の限界';

/** D08「静的解析の限界」の冒頭 2 文と出典 */
export const STATIC_LIMIT_NOTE =
  'JavaScript の呼び出し関係は静的解析では完全に復元できない（動的な呼び出し・eval・実行時に決まる値）。本書の呼び出し関係・影響分析は下表の箇所を含まない（出典: M.H.M. Bhuiyan, G. De Stefano, G. Pellegrino, C.-A. Staicu, "Call Me Maybe: Enhancing JavaScript Call Graph Construction using Graph Neural Networks", 2025, arXiv:2506.18191）';

export const DYNAMIC_CALL_NOTE_SUFFIX = '（D08『静的解析の限界』）';

/** 注記の根拠: 事実だが、ソース位置・IR 要素・D09 番号を持たない（トレーサビリティの link にならない） */
export function noteProv(): Provenance {
  return { evidence: 'fact', source: [] };
}

export function designIntentNote(): ParagraphBlock {
  return para(DESIGN_INTENT_NOTE, noteProv());
}

/** 呼び出し関係図・モジュール依存図の直後の注記。件数は D08「静的解析の限界」の内訳 */
export function dynamicCallNote(counts: { dynamic: number; untraced: number }): ParagraphBlock {
  return para(`図は次を含まない: 動的な呼び出し ${counts.dynamic} 件・呼び出し元をたどれない関数 ${counts.untraced} 件${DYNAMIC_CALL_NOTE_SUFFIX}`, noteProv());
}

/** 範囲の注記か（確度・自動度の集計から除く） */
export function isScopeNote(b: Block): boolean {
  return b.type === 'paragraph' && (b.text === DESIGN_INTENT_NOTE || b.text === STATIC_LIMIT_NOTE || b.text.endsWith(DYNAMIC_CALL_NOTE_SUFFIX));
}
