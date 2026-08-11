import { toKyureki, rokuyou, eto, setsuIndex, isIchiryuManbaibi, isTenshabi, moonEvent, longitudeOfSun, longitudeOfMoon } from '../app/js/koyomi.js';

// ---- 1. 黄経が原典と一致するか ----
//
// 期待値は qreki_py に出させたもの。t が負（2000年以前）の点を必ず含める。
// JS の % は負の符号を残すため、ここを正規化し忘れると黄経が負になり、
// 朔の分岐判定が狂って旧暦が1朔ぶんずれる（実際に起きた）。
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
let worstS = 0, worstM = 0;
for (const [t, s, m] of sunSamples) {
  worstS = Math.max(worstS, Math.abs(longitudeOfSun(t) - s));
  worstM = Math.max(worstM, Math.abs(longitudeOfMoon(t) - m));
}
console.log(`黄経の差   太陽 ${worstS.toExponential(2)}°  月 ${worstM.toExponential(2)}°`);

// ---- 2. 六曜（市販カレンダーとの照合） ----
const rokuCases = [['2026-03-05','大安'], ['2026-07-19','大安']];
for (const [d, want] of rokuCases) {
  const [y,m,dd] = d.split('-').map(Number);
  const got = rokuyou(y,m,dd);
  console.log(`六曜 ${d}: ${got} ${got===want?'✓':'✗ 期待 '+want}`);
}

// ---- 3. 天赦日（2026年の4日） ----
const tensha = [['2026-03-05','戊寅'],['2026-07-19','甲午'],['2026-10-01','戊申'],['2026-12-16','甲子']];
for (const [d, want] of tensha) {
  const [y,m,dd] = d.split('-').map(Number);
  const e = eto(y,m,dd), t = isTenshabi(y,m,dd), i = isIchiryuManbaibi(y,m,dd);
  console.log(`天赦 ${d}: 干支${e} ${e===want?'✓':'✗ 期待'+want} / 天赦${t?'○':'×'} / 一粒${i?'○':'×'}`);
}

// ---- 4. 2026年の一粒万倍日の数 ----
let n = 0;
for (let m = 1; m <= 12; m++) {
  const last = new Date(2026, m, 0).getDate();
  for (let d = 1; d <= last; d++) if (isIchiryuManbaibi(2026, m, d)) n++;
}
console.log(`2026年の一粒万倍日: ${n}日 ${n===64?'✓':'✗ 期待 64'}`);

// ---- 5. 節の切り替わり ----
console.log(`節 2026-02-03: ${setsuIndex(2026,2,3)} → 2026-02-04(立春): ${setsuIndex(2026,2,4)} ${setsuIndex(2026,2,3)===11&&setsuIndex(2026,2,4)===0?'✓':'✗'}`);
console.log(`節 2026-03-04: ${setsuIndex(2026,3,4)} → 2026-03-05(啓蟄): ${setsuIndex(2026,3,5)} ${setsuIndex(2026,3,4)===0&&setsuIndex(2026,3,5)===1?'✓':'✗'}`);

// ---- 6. 旧暦（原典との照合） ----
//
// 期待値は qreki_py（高野英明 QREKI.AWK の Python 移植）に出させたもの。
// 2021-01-01〜2130-12-31 の全 40,176 日で突き合わせて不一致 0 を確認済み。
// ここに残すのは、その中から閏月の朔日10件と年またぎ・端の代表を抜いた分。
//
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
  if (k.year === wy && k.month === wm && (k.leap ? 1 : 0) === wl && k.day === wd) ok++;
  else console.log(`  ${iso} → ${k.year}/${k.leap ? '閏' : ''}${k.month}/${k.day} ✗ 期待 ${wy}/${wl ? '閏' : ''}${wm}/${wd}`);
}
console.log(`旧暦（閏月10件を含む）: ${ok}/${KYUREKI_CASES.length} ${ok === KYUREKI_CASES.length ? '✓' : '✗'}`);

// ---- 7. 朔弦望が旧暦の日付と噛み合うか ----
//
// 新月は必ず旧暦1日。ほかは月の運動が不均一なので幅を持つ。
// moon() の「いちばん近い相」で節目を出すと朔の2日前が新月になる（実際に起きた）。
const PHASE_RANGE = { 新月: [1, 1], 上弦: [6, 9], 満月: [14, 17], 下弦: [21, 24] };
const counts = { 新月: 0, 上弦: 0, 満月: 0, 下弦: 0 };
let phaseBad = 0;
for (let m = 1; m <= 12; m += 1) {
  const last = new Date(2026, m, 0).getDate();
  for (let d = 1; d <= last; d += 1) {
    const name = moonEvent(2026, m, d);
    if (!name) continue;
    counts[name] += 1;
    const k = toKyureki(2026, m, d);
    const [lo, hi] = PHASE_RANGE[name];
    if (k.day < lo || k.day > hi) {
      phaseBad += 1;
      console.log(`  2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${name} → 旧暦${k.month}/${k.day} ✗ 期待 ${lo}〜${hi}日`);
    }
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`2026年の朔弦望: ${JSON.stringify(counts)} 計${total}回  範囲外 ${phaseBad} 件 ${phaseBad === 0 && total >= 48 ? '✓' : '✗'}`);
