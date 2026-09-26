// CSS 解析（postcss）: メディアクエリの境界幅と、状態クラスに紐づく表示・非表示の規則（REQ-F-008）。

import postcss, { type AtRule, type Rule } from 'postcss';
import type { CssRule, IR } from '../ir/schema.ts';
import type { SourceFile } from './html.ts';

const slug = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '_');

/** 状態を表すクラス・属性・擬似クラス */
const STATE_CLASS = /\.((?:is|has)-[\w-]+|error|active|open|hidden|disabled|selected|invalid|show|hide)(?![\w-])/g;
const STATE_ATTR = /\[(hidden|aria-hidden(?:=[^\]]*)?|aria-expanded(?:=[^\]]*)?|disabled|aria-invalid(?:=[^\]]*)?)\]/g;
const STATE_PSEUDO = /:(invalid|disabled|checked|focus-visible)(?![\w-])/g;

function declarationsOf(rule: Rule): Record<string, string> {
  const out: Record<string, string> = {};
  rule.walkDecls((d) => {
    out[d.prop] = d.value + (d.important ? ' !important' : '');
  });
  return out;
}

function effectOf(decls: Record<string, string>): 'show' | 'hide' | 'other' {
  const display = decls['display']?.replace(/\s*!important$/, '').trim();
  const visibility = decls['visibility']?.replace(/\s*!important$/, '').trim();
  if (display === 'none' || visibility === 'hidden' || visibility === 'collapse') return 'hide';
  if (display !== undefined || visibility === 'visible') return 'show';
  return 'other';
}

function stateTokens(selector: string): string[] {
  const out = new Set<string>();
  for (const re of [STATE_CLASS, STATE_ATTR, STATE_PSEUDO]) {
    for (const m of selector.matchAll(re)) out.add(re === STATE_CLASS ? m[1]! : m[0]);
  }
  return [...out];
}

/** `(max-width: 767px)`・`(width < 768px)`・`(768px <= width)` を境界に分解する */
export function parseMediaParams(params: string): { feature: string; value: string; inclusive: boolean }[] {
  const out: { feature: string; value: string; inclusive: boolean }[] = [];
  for (const m of params.matchAll(/\(\s*((?:min|max)-(?:width|height|aspect-ratio|resolution))\s*:\s*([^)]+?)\s*\)/g)) {
    out.push({ feature: m[1]!, value: m[2]!, inclusive: true });
  }
  for (const m of params.matchAll(/\(\s*(width|height)\s*(<=|>=|<|>)\s*([^)]+?)\s*\)/g)) {
    out.push({ feature: `${m[2]!.startsWith('<') ? 'max' : 'min'}-${m[1]}`, value: m[3]!, inclusive: m[2]!.endsWith('=') });
  }
  for (const m of params.matchAll(/\(\s*([^()<>=\s]+)\s*(<=|>=|<|>)\s*(width|height)\s*\)/g)) {
    out.push({ feature: `${m[2]!.startsWith('<') ? 'min' : 'max'}-${m[3]}`, value: m[1]!, inclusive: m[2]!.endsWith('=') });
  }
  return out;
}

function mediaRules(file: SourceFile, at: AtRule): CssRule[] {
  const line = at.source?.start?.line ?? 1;
  const inner: Rule[] = [];
  at.walkRules((r) => {
    inner.push(r);
  });
  const declarations: Record<string, string> = {};
  for (const r of inner) {
    for (const [prop, value] of Object.entries(declarationsOf(r))) declarations[`${r.selector} { ${prop} }`] = value;
  }
  return parseMediaParams(at.params).map((media, i) => ({
    id: `CSS-${slug(file.path)}-L${line}-media${i + 1}`,
    source: [{ file: file.path, line, endLine: at.source?.end?.line }],
    evidence: 'fact',
    kind: 'media',
    media,
    selector: `@media ${at.params}`,
    declarations,
  }));
}

function stateRules(file: SourceFile, rule: Rule): CssRule[] {
  const line = rule.source?.start?.line ?? 1;
  const declarations = declarationsOf(rule);
  const effect = effectOf(declarations);
  const out: CssRule[] = [];
  rule.selectors.forEach((selector, si) => {
    stateTokens(selector).forEach((token, ti) => {
      out.push({
        id: `CSS-${slug(file.path)}-L${line}-s${si + 1}-${ti + 1}`,
        source: [{ file: file.path, line, endLine: rule.source?.end?.line }],
        evidence: 'fact',
        kind: 'stateClass',
        className: token,
        selector,
        effect,
        declarations,
      });
    });
  });
  return out;
}

/** CSS 構文エラーは例外として投げる（呼び出し側で failed にする） */
export function analyzeCss(file: SourceFile): Pick<IR, 'cssRules'> {
  const root = postcss.parse(file.text, { from: file.path });
  const cssRules: CssRule[] = [];
  root.walkAtRules('media', (at) => {
    cssRules.push(...mediaRules(file, at));
  });
  root.walkRules((rule) => {
    cssRules.push(...stateRules(file, rule));
  });
  return { cssRules };
}
