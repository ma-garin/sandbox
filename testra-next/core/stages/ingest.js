// ステージ1: ドキュメント取込（ingest）
// 仕様書テキスト・仕様書URL・apk メタ情報を、後続ステージ共通の文書モデルへ正規化する。
//
// 純粋関数として保つため、URL の実フェッチや apk の実解析は
// ランタイム層（CLI/web）で行い、取得済みテキスト/メタをここへ渡す契約とする。

import { stableId } from '../util/id.js';
import { toParagraphs, toLines, stripBullet, hasAny } from '../util/text.js';

// 要件らしい行を見分けるための助動詞・語尾（日本語仕様書の慣習）
const REQUIREMENT_MARKERS = [
  'できる', 'すること', 'しなければ', 'する必要', 'とする', 'を表示', 'へ遷移',
  'を許可', 'を禁止', 'を保存', 'を送信', 'を受信', 'ロック', 'must', 'shall', 'should',
];

/**
 * 1ソース（仕様テキスト）を節と要件行へ分解する。
 * @param {{name:string, text:string, url?:string, kind:string}} src
 */
function parseSpecSource(src) {
  const paras = toParagraphs(src.text);
  const sections = paras.map((body, i) => {
    const lines = toLines(body);
    // 先頭行が見出しっぽい（短い/末尾に句点なし）なら heading として扱う
    const first = lines[0] || '';
    const isHeading = first.length <= 30 && !/[。.！!？?]$/.test(first);
    const heading = isHeading ? first : `節${i + 1}`;
    const text = isHeading ? lines.slice(1).join('\n') : body;
    return {
      id: stableId('SEC', src.name, i, heading),
      source: src.name,
      heading,
      text,
      lines: toLines(text),
    };
  });

  const requirements = [];
  for (const sec of sections) {
    for (const raw of sec.lines) {
      const line = stripBullet(raw);
      if (line.length >= 6 && hasAny(line, REQUIREMENT_MARKERS)) {
        requirements.push({
          id: stableId('REQ', src.name, line),
          source: src.name,
          section: sec.heading,
          text: line,
        });
      }
    }
  }
  return { sections, requirements };
}

/**
 * apk メタからフィーチャー種となる観測事実を作る（ルールベース）。
 * 実バイナリ解析（activities/permissions 抽出）はランタイム層で行い meta として渡す。
 */
function parseApkSource(src) {
  const meta = src.meta || {};
  const permissions = meta.permissions || [];
  const activities = meta.activities || [];
  const lines = [
    `パッケージ: ${meta.package || src.name}`,
    activities.length ? `画面(Activity): ${activities.join(', ')}` : '',
    permissions.length ? `要求権限: ${permissions.join(', ')}` : '',
  ].filter(Boolean);
  return {
    sections: [
      {
        id: stableId('SEC', src.name, 'apk'),
        source: src.name,
        heading: `APK: ${meta.package || src.name}`,
        text: lines.join('\n'),
        lines,
        apk: { permissions, activities, package: meta.package || src.name },
      },
    ],
    // 権限は非機能（セキュリティ/プライバシ）要件の種になる
    requirements: permissions.map((p) => ({
      id: stableId('REQ', src.name, p),
      source: src.name,
      section: 'permissions',
      text: `権限 ${p} が適切に要求・利用されること`,
      kind: 'nfr',
    })),
  };
}

/**
 * ingest ステージ本体。
 * @param {{sources: Array}} input
 * @returns {object} document モデル
 */
export function ingest(input = {}) {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const sections = [];
  const requirements = [];

  for (const src of sources) {
    const parsed = src.kind === 'apk' ? parseApkSource(src) : parseSpecSource(src);
    sections.push(...parsed.sections);
    requirements.push(...parsed.requirements);
  }

  return {
    title: input.title || sources[0]?.name || 'untitled',
    sources: sources.map((s) => ({
      name: s.name,
      kind: s.kind || 'spec',
      url: s.url || null,
      hasText: Boolean(s.text) || Boolean(s.meta),
    })),
    sections,
    requirements,
    stats: {
      sourceCount: sources.length,
      sectionCount: sections.length,
      requirementCount: requirements.length,
    },
  };
}
