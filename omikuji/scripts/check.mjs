#!/usr/bin/env node
/**
 * 公開前の点検。ビルドツールを使わない構成なので、壊れても実行するまで分からない。
 * 実際に起きた事故を二度と通さないための関所。
 *
 *   1. Service Worker の先読み一覧に、実在しないファイルが混じっていないか
 *      → 逆に、新しく足したモジュールを一覧に入れ忘れるとオフラインで落ちる
 *   2. JS が参照している要素 id が HTML にあるか（$('...') の取りこぼし）
 *   3. モジュール間の import 名が、相手が実際に export しているか
 *      → 実際に「does not provide an export named 'hiddenIds'」で画面が死んだ
 *   4. 記録データの形（id の重複、date と type）
 *   5. CSS に env(safe-area-*) を直書きしていないか（値を差し替えられず検証不能になる）
 *
 * 使い方: node scripts/check.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const APP = resolve(here, '..', 'app');

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);
const note = (msg) => notes.push(msg);

const read = (rel) => readFileSync(join(APP, rel), 'utf8');

// ---------- 1. Service Worker の先読み一覧 ----------

const sw = read('sw.js');
const shellBlock = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
if (!shellBlock) {
  fail('sw.js に SHELL_FILES が見つからない');
} else {
  const listed = [...shellBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  listed.forEach((f) => {
    if (f === './') return;
    if (!existsSync(join(APP, f))) fail(`sw.js が先読みする ${f} が実在しない`);
  });

  // js/ 配下のモジュールが一覧から漏れていないか
  readdirSync(join(APP, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => {
    if (!listed.includes(`js/${f}`)) {
      fail(`js/${f} が sw.js の SHELL_FILES に入っていない（オフラインで落ちる）`);
    }
  });
  note(`先読み ${listed.length} 件を確認`);
}

// ---------- 2. JS が参照する id が HTML にあるか ----------

const html = read('index.html');
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

const appJs = read('js/app.js');
const usedIds = [...appJs.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
const missing = [...new Set(usedIds)].filter((id) => !htmlIds.has(id));
missing.forEach((id) => fail(`app.js が参照する id="${id}" が index.html にない`));
note(`参照 id ${new Set(usedIds).size} 件を確認`);

// ---------- 3. import 名が export されているか ----------

const modules = readdirSync(join(APP, 'js')).filter((f) => f.endsWith('.js'));
const exportsOf = new Map();
modules.forEach((f) => {
  const src = read(`js/${f}`);
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((part) => {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    });
  }
  exportsOf.set(f, names);
});

modules.forEach((f) => {
  const src = read(`js/${f}`);
  for (const m of src.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([^']+)'/g)) {
    const from = m[2];
    const provided = exportsOf.get(from);
    if (!provided) { fail(`${f} が読み込む ./${from} が js/ にない`); continue; }
    m[1].split(',').forEach((part) => {
      const raw = part.trim();
      if (!raw) return;
      const name = raw.split(/\s+as\s+/)[0].trim();
      if (name && !provided.has(name)) {
        fail(`${f} が ${from} から ${name} を読み込んでいるが、${from} は export していない`);
      }
    });
  }
});
note(`モジュール ${modules.length} 件の import/export を突き合わせ`);

// ---------- 4. 記録データ ----------

const data = JSON.parse(read('data/omikuji.json'));
const entries = data.entries;
if (!Array.isArray(entries) || !entries.length) fail('data/omikuji.json の entries が空');
const ids = entries.map((e) => e.id);
if (new Set(ids).size !== ids.length) fail('data/omikuji.json の id が重複している');
entries.forEach((e) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) fail(`${e.id}: date の形式が違う（${e.date}）`);
  if (!['omikuji', 'visit', 'other'].includes(e.type)) fail(`${e.id}: type が不正（${e.type}）`);
});
note(`記録 ${entries.length} 件を確認`);

// ---------- 5. CSS の env() 直書き ----------

const css = read('styles.css');
const envUses = [...css.matchAll(/env\(safe-area-inset-(top|bottom|left|right)[^)]*\)/g)];
const declared = [...css.matchAll(/--safe-(top|bottom):\s*env\(/g)].length;
if (envUses.length > declared) {
  fail(`styles.css で env(safe-area-*) を ${envUses.length - declared} 箇所で直書きしている（--safe-* 経由にする）`);
}
note(`safe-area の使用 ${envUses.length} 箇所（うち定義 ${declared}）`);

// ---------- 6. 物差しを通しているか ----------
//
// トークンを定義しても、使わなければ意味がない。実際に font-size 19種・
// gap 12種・border-radius 6種まで散らかった。直値を書いたら落とす。

const tokenBody = css.split('* { box-sizing')[1] || '';
const rawChecks = [
  ['font-size', /font-size:\s*[0-9.]+px/g, '--text-* を使う'],
  ['gap', /(?<!row-)gap:\s*[0-9]+px/g, '--space-* を使う'],
  ['border-radius', /border-radius:\s*[0-9]+px/g, '--r-* を使う'],
];
rawChecks.forEach(([label, re, hint]) => {
  const hits = tokenBody.match(re) || [];
  if (hits.length) {
    fail(`styles.css で ${label} を直値で書いている（${hits.length}箇所: ${[...new Set(hits)].slice(0, 4).join(', ')}）。${hint}`);
  }
});

// 同じ役割の部品が増えていないか。増えたら共通の .row / .surface へ寄せる。
// 見るのは「行の実体（背景・枠・余白）を自前で持っているか」で、
// 中の並べ方（grid-template-columns など）だけを足すのは重複ではない。
const ROW_BODY = /(background|border|padding)\s*:/;
['card', 'vrow', 'visit', 'shrine__day'].forEach((name) => {
  const m = css.match(new RegExp(`\\n\\.${name} \\{([^}]*)\\}`));
  if (m && ROW_BODY.test(m[1])) {
    fail(`.${name} が行の見た目を自前で持っている（背景・枠・余白）。.row に寄せる`);
  }
});
note(`直値の検査 ${rawChecks.length} 種と、部品の重複を確認`);

// ---------- 7. manifest ----------

const manifest = JSON.parse(read('manifest.webmanifest'));
['name', 'start_url', 'display', 'icons'].forEach((k) => {
  if (!manifest[k]) fail(`manifest に ${k} がない`);
});
const sizes = (manifest.icons || []).map((i) => i.sizes);
['192x192', '512x512'].forEach((s) => {
  if (!sizes.includes(s)) fail(`manifest のアイコンに ${s} がない`);
});
if (!(manifest.icons || []).some((i) => i.purpose === 'maskable')) fail('maskable アイコンがない');
(manifest.icons || []).concat(manifest.screenshots || []).forEach((i) => {
  if (i.src && !existsSync(join(APP, i.src))) fail(`manifest が指す ${i.src} が実在しない`);
});
note(`manifest のアイコン ${sizes.length} 件・スクリーンショット ${(manifest.screenshots || []).length} 件を確認`);

// ---------- 結果 ----------

notes.forEach((n) => console.log(`  ${n}`));
if (problems.length) {
  console.error(`\n${problems.length} 件の問題:`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('\nすべて通過');
