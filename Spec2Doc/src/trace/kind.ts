// リンクの種類（市販ツールの satisfies / verifies / derives 等）を、行の出どころ（文書・節）から決める。
import type { LinkKind, TraceLink } from './schema.ts';

/** 節の見出しの連なりの最上位が「機能」の節か（「非機能」は除く） */
function isFunctionSection(section: string): boolean {
  const top = section.split(' / ')[0] ?? '';
  return /機能/.test(top) && !/非機能/.test(top);
}

/** D02 の機能の節=satisfies、D13=verifies、D07 の影響分析の節=derives、それ以外（D11・D12 の関数・モジュールを含む）=describes */
export function linkKindOf(link: Pick<TraceLink, 'docId' | 'section'>): LinkKind {
  if (link.docId === 'D02' && isFunctionSection(link.section)) return 'satisfies';
  if (link.docId === 'D13') return 'verifies';
  if (link.docId === 'D07' && /影響/.test(link.section)) return 'derives';
  return 'describes';
}

export function withLinkKinds<T extends TraceLink>(links: readonly T[]): T[] {
  return links.map((l) => ({ ...l, kind: linkKindOf(l) }));
}
