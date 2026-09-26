// 依存ライブラリ（REQ-F-015）: package.json の dependencies / devDependencies と、HTML の CDN script。

import type { Dependency, IR } from '../ir/schema.ts';
import type { ScriptRef, SourceFile } from './html.ts';

const slug = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '_');

function lineOfKey(text: string, section: string, name: string): number {
  const start = Math.max(0, text.indexOf(`"${section}"`));
  const at = text.indexOf(`"${name}"`, start);
  const pos = at >= 0 ? at : start;
  return text.slice(0, pos).split('\n').length;
}

/** package.json を解析する。JSON として読めなければ例外（呼び出し側で failed にする） */
export function analyzePackageJson(file: SourceFile): Pick<IR, 'dependencies'> {
  const pkg: unknown = JSON.parse(file.text);
  if (typeof pkg !== 'object' || pkg === null) throw new Error('package.json がオブジェクトではない');
  const sections = [
    ['dependencies', 'package.json'],
    ['devDependencies', 'package.json(dev)'],
  ] as const;
  const dependencies: Dependency[] = [];
  for (const [section, loadedFrom] of sections) {
    const deps = (pkg as Record<string, unknown>)[section];
    if (typeof deps !== 'object' || deps === null) continue;
    for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
      dependencies.push({
        id: `DEP-${slug(file.path)}-${section === 'dependencies' ? 'prod' : 'dev'}-${slug(name)}`,
        source: [{ file: file.path, line: lineOfKey(file.text, section, name) }],
        evidence: 'fact',
        name,
        version: typeof version === 'string' ? version : null,
        loadedFrom,
      });
    }
  }
  return { dependencies };
}

export const isExternalScript = (src: string): boolean => /^(https?:)?\/\//i.test(src.trim());

/** CDN の URL から名前と版を読む（jsdelivr・unpkg・cdnjs・一般の `name@ver`・`name-1.2.3.js`） */
export function parseCdnUrl(src: string): { name: string; version: string | null } {
  const url = src.trim().replace(/^\/\//, 'https://');
  const npm = /(?:\/npm\/|unpkg\.com\/|esm\.sh\/|skypack\.dev\/)((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?/.exec(url);
  if (npm) return { name: npm[1]!, version: npm[2] ?? null };
  const cdnjs = /\/ajax\/libs\/([^/]+)\/([^/]+)\//.exec(url);
  if (cdnjs) return { name: cdnjs[1]!, version: cdnjs[2]! };
  const file = (url.split(/[?#]/)[0] ?? '').split('/').pop() ?? url;
  const base = file.replace(/(\.min)?\.m?js$/i, '');
  const ver = /[-.@]v?(\d+\.\d+(?:\.\d+)?(?:[-.][\w.]+)?)$/.exec(base);
  const pathVer = /\/v?(\d+\.\d+(?:\.\d+)?)\//.exec(url);
  return {
    name: ver ? base.slice(0, ver.index) : base,
    version: ver?.[1] ?? pathVer?.[1] ?? null,
  };
}

export function dependenciesFromScripts(htmlPath: string, scripts: ScriptRef[]): Dependency[] {
  return scripts
    .filter((s) => isExternalScript(s.src))
    .map((s, i) => {
      const { name, version } = parseCdnUrl(s.src);
      return {
        id: `DEP-${slug(htmlPath)}-cdn${i + 1}-${slug(name)}`,
        source: [{ file: htmlPath, line: s.line }],
        evidence: 'fact',
        name,
        version,
        loadedFrom: 'cdn',
        url: s.src,
      };
    });
}

/** 1 つの読み込み元（package.json の節・CDN の URL・import） */
export interface DependencyOrigin {
  loadedFrom: Dependency['loadedFrom'];
  version: string | null;
  url?: string;
  source: Dependency['source'];
}

/** 名前で 1 件にまとめた依存。schema は変えず、Dependency の上位互換として IR に載る */
export type MergedDependency = Dependency & { origins: DependencyOrigin[]; versions: string[] };

const ORIGIN_ORDER: readonly Dependency['loadedFrom'][] = ['package.json', 'package.json(dev)', 'cdn', 'import'];

/**
 * 同じ名前の依存を 1 件にまとめる。loadedFrom・url は優先順（package.json → dev → cdn → import）の先頭、
 * 全読み込み元は origins に、異なる版はすべて versions に残し、version は食い違えば ` / ` 区切りで併記する。
 */
export function mergeDependencies(deps: readonly Dependency[]): MergedDependency[] {
  const groups = new Map<string, Dependency[]>();
  for (const d of deps) groups.set(d.name, [...(groups.get(d.name) ?? []), d]);
  return [...groups.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => ORIGIN_ORDER.indexOf(a.loadedFrom) - ORIGIN_ORDER.indexOf(b.loadedFrom));
    const first = sorted[0]!;
    const origins: DependencyOrigin[] = sorted.map((d) => ({
      loadedFrom: d.loadedFrom,
      version: d.version,
      ...(d.url ? { url: d.url } : {}),
      source: d.source,
    }));
    const versions = [...new Set(sorted.map((d) => d.version).filter((v): v is string => v !== null))];
    const url = sorted.find((d) => d.url)?.url;
    return {
      id: `DEP-${slug(name)}`,
      source: sorted.flatMap((d) => d.source),
      evidence: 'fact',
      name,
      version: versions.length === 0 ? null : versions.join(' / '),
      loadedFrom: first.loadedFrom,
      ...(url ? { url } : {}),
      origins,
      versions,
    };
  });
}
