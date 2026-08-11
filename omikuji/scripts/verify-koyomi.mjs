/**
 * 旧暦と暦注の検算。node scripts/verify-koyomi.mjs
 *
 * 期待値の出どころは高野英明 QREKI.AWK の Python 移植（qreki_py）。
 * 2021-01-01〜2130-12-31 の全 40,176 日を突き合わせて不一致 0 を確認した上で、
 * ここにはその代表を残している。
 */

import {
  toKyureki, rokuyou, eto, setsuIndex, isIchiryuManbaibi, isTenshabi,
  moonEvent, longitudeOfSun, longitudeOfMoon,
} from '../app/js/koyomi.js';

let ng = 0;
const fail = (msg) => { ng += 1; console.log(`  ${msg}`); };

// ---- 1. 黄経が原典と一致するか ----
//
// t が負（2000年以前）の点を必ず含める。JS の % は負の符号を残すため、
// ここを正規化し忘れると黄経が負になり、朔の分岐判定が狂って
// 旧暦が1朔ぶんずれる（実際に起きた）。
// 引数で別のサンプル列を渡せば、そちらを使う。
const DEFAULT_SAMPLES = [
  [-0.5, 280.0108039354, 61.4111172447],
  [0.0, 280.3773624988, 223.3139267251],
  [0.2, 280.5281398765, 352.0753529793],
  [0.2612, 325.1219677598, 282.2280272572],
  [1.3, 281.3337298786, 182.5119094895],
  [1.30117, 324.7876997414, 36.4212307203],
];
const sunSamples = process.argv[2] ? JSON.parse(process.argv[2]) : DEFAULT_SAMPLES;
let worstS = 0;
let worstM = 0;
for (const [t, s, m] of sunSamples) {
  worstS = Math.max(worstS, Math.abs(longitudeOfSun(t) - s));
  worstM = Math.max(worstM, Math.abs(longitudeOfMoon(t) - m));
}
const TOL = 1e-6;
if (worstS > TOL || worstM > TOL) fail(`黄経が原典とずれている（太陽 ${worstS} / 月 ${worstM}）`);
console.log(`黄経の差   太陽 ${worstS.toExponential(2)}°  月 ${worstM.toExponential(2)}°`);

// ---- 2. 六曜（市販カレンダーとの照合） ----
[['2026-03-05', '大安'], ['2026-07-19', '大安']].forEach(([d, want]) => {
  const [y, m, dd] = d.split('-').map(Number);
  const got = rokuyou(y, m, dd);
  if (got !== want) fail(`六曜 ${d}: ${got} ≠ ${want}`);
  console.log(`六曜 ${d}: ${got} ${got === want ? '✓' : '✗'}`);
});

// ---- 3. 天赦日（2026年の4日） ----
[['2026-03-05', '戊寅'], ['2026-07-19', '甲午'], ['2026-10-01', '戊申'], ['2026-12-16', '甲子']]
  .forEach(([d, want]) => {
    const [y, m, dd] = d.split('-').map(Number);
    const e = eto(y, m, dd);
    const t = isTenshabi(y, m, dd);
    if (e !== want || !t) fail(`天赦 ${d}: 干支${e}（期待${want}） 天赦${t ? '○' : '×'}`);
    console.log(`天赦 ${d}: 干支${e} ${e === want ? '✓' : '✗'} / 天赦${t ? '○' : '×'} / 一粒${isIchiryuManbaibi(y, m, dd) ? '○' : '×'}`);
  });

// ---- 4. 2026年の一粒万倍日の数 ----
let n = 0;
for (let m = 1; m <= 12; m += 1) {
  const last = new Date(2026, m, 0).getDate();
  for (let d = 1; d <= last; d += 1) if (isIchiryuManbaibi(2026, m, d)) n += 1;
}
if (n !== 64) fail(`2026年の一粒万倍日が ${n} 日（期待 64）`);
console.log(`2026年の一粒万倍日: ${n}日 ${n === 64 ? '✓' : '✗'}`);

// ---- 5. 節の切り替わり ----
[[2026, 2, 3, 11], [2026, 2, 4, 0], [2026, 3, 4, 0], [2026, 3, 5, 1]].forEach(([y, m, d, want]) => {
  const got = setsuIndex(y, m, d);
  if (got !== want) fail(`節 ${y}-${m}-${d}: ${got} ≠ ${want}`);
});
console.log(`節の境（立春 2026-02-04 / 啓蟄 03-05）: ${setsuIndex(2026, 2, 3)}→${setsuIndex(2026, 2, 4)} / ${setsuIndex(2026, 3, 4)}→${setsuIndex(2026, 3, 5)}`);

// ---- 6. 旧暦（原典との照合） ----
//
// 閏月の朔日10件と、年またぎ・端の代表。
// 満月＝旧暦15日という当てはめは検算に使えない。朔から望までは
// 月の運動が不均一なため 14〜17 日に散る（2026-09-27 は原典でも 8月17日）。
const KYUREKI_CASES = [
  ['2023-03-22', 2023, 2, 1, 1],
  ['2025-07-25', 2025, 6, 1, 1],
  ['2028-06-23', 2028, 5, 1, 1],
  ['2031-04-22', 2031, 3, 1, 1],
  ['2033-08-25', 2033, 7, 1, 1],
  ['2033-12-22', 2033, 11, 1, 1],
  ['2036-07-23', 2036, 6, 1, 1],
  ['2039-06-22', 2039, 5, 1, 1],
  ['2042-03-22', 2042, 2, 1, 1],
  ['2044-08-23', 2044, 7, 1, 1],
  ['2021-01-01', 2020, 11, 0, 18],
  ['2026-01-01', 2025, 11, 0, 13],
  ['2026-09-27', 2026, 8, 0, 17],
  ['2030-06-15', 2030, 5, 0, 15],
  ['2050-03-20', 2050, 2, 0, 27],
  ['2100-12-31', 2100, 12, 0, 1],
  ['2130-12-31', 2130, 12, 0, 2],
];
let ok = 0;
for (const [iso, wy, wm, wl, wd] of KYUREKI_CASES) {
  const [y, m, dd] = iso.split('-').map(Number);
  const k = toKyureki(y, m, dd);
  if (k.year === wy && k.month === wm && (k.leap ? 1 : 0) === wl && k.day === wd) ok += 1;
  else fail(`${iso} → ${k.year}/${k.leap ? '閏' : ''}${k.month}/${k.day} ≠ ${wy}/${wl ? '閏' : ''}${wm}/${wd}`);
}
console.log(`旧暦（閏月10件を含む）: ${ok}/${KYUREKI_CASES.length} ${ok === KYUREKI_CASES.length ? '✓' : '✗'}`);

// ---- 7. 朔弦望が旧暦の日付と噛み合うか ----
//
// 新月は必ず旧暦1日。ほかは月の運動が不均一なので幅を持つ。
// moon() の「いちばん近い相」で節目を出すと朔の2日前が新月になる（実際に起きた）。
const PHASE_RANGE = { 新月: [1, 1], 上弦: [6, 9], 満月: [14, 17], 下弦: [21, 24] };
const counts = { 新月: 0, 上弦: 0, 満月: 0, 下弦: 0 };
for (let m = 1; m <= 12; m += 1) {
  const last = new Date(2026, m, 0).getDate();
  for (let d = 1; d <= last; d += 1) {
    const name = moonEvent(2026, m, d);
    if (!name) continue;
    counts[name] += 1;
    const k = toKyureki(2026, m, d);
    const [lo, hi] = PHASE_RANGE[name];
    if (k.day < lo || k.day > hi) {
      fail(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${name} → 旧暦${k.month}/${k.day}（期待 ${lo}〜${hi}日）`);
    }
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (total < 48) fail(`2026年の朔弦望が ${total} 回しかない（48回以上あるはず）`);
console.log(`2026年の朔弦望: ${JSON.stringify(counts)} 計${total}回`);

console.log(ng === 0 ? '\nすべて通過' : `\n${ng} 件の不一致`);
if (ng) process.exit(1);
