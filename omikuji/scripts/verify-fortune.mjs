/**
 * 占いの計算の検算。node scripts/verify-fortune.mjs
 *
 * 六星占術の運命数表は 1950〜2030 の 972 値すべてが
 *   運命数(年,月) = ((その月1日のJD mod 60) + 50) mod 60 + 1
 * で再現できることを確認した。つまり星数は生まれた日の干支そのもので、
 * 表を持つ必要がない。ここにはその根拠として、各年の1月の値81件と
 * 1985年の全12ヶ月を残す。規則が崩れたらここで落ちる。
 *
 * 出典: https://fortune.netoff.co.jp/rokusei/keisan/
 */

import { toJD, eto } from '../app/js/koyomi.js';
import { rokusei, honmeisei, kenki } from '../app/js/fortune.js';

let ng = 0;
const check = (label, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) { ng += 1; console.log(`  ${label}: ${got} ✗ 期待 ${want}`); }
  return ok;
};

// ---- 1. 運命数表との照合 ----

const FATE_JAN = [
  33, 38, 43, 49, 54, 59, 4, 10, 15, 20, 25, 31, 36, 41, 46, 52, 57, 2, 7, 13,
  18, 23, 28, 34, 39, 44, 49, 55, 60, 5, 10, 16, 21, 26, 31, 37, 42, 47, 52, 58,
  3, 8, 13, 19, 24, 29, 34, 40, 45, 50, 55, 1, 6, 11, 16, 22, 27, 32, 37, 43,
  48, 53, 58, 4, 9, 14, 19, 25, 30, 35, 40, 46, 51, 56, 1, 7, 12, 17, 22, 28, 33,
];
const FATE_1985 = [37, 8, 36, 7, 37, 8, 38, 9, 40, 10, 41, 11];

// 運命数は「その月の1日の星数」に当たる（星数 = 運命数 - 1 + 日）
const fateNumber = (y, m) => rokusei(y, m, 1).starNumber;

let janBad = 0;
FATE_JAN.forEach((want, i) => {
  if (fateNumber(1950 + i, 1) !== want) {
    janBad += 1;
    if (janBad <= 3) console.log(`  ${1950 + i}年1月: ${fateNumber(1950 + i, 1)} ✗ 期待 ${want}`);
  }
});
console.log(`運命数（各年1月 81件）: 不一致 ${janBad} 件 ${janBad === 0 ? '✓' : '✗'}`);
if (janBad) ng += 1;

let monBad = 0;
FATE_1985.forEach((want, i) => {
  if (fateNumber(1985, i + 1) !== want) {
    monBad += 1;
    console.log(`  1985年${i + 1}月: ${fateNumber(1985, i + 1)} ✗ 期待 ${want}`);
  }
});
console.log(`運命数（1985年 全12ヶ月）: 不一致 ${monBad} 件 ${monBad === 0 ? '✓' : '✗'}`);
if (monBad) ng += 1;

// ---- 2. 出典に載っていた例 ----
// 1985-08-15 → 運命数9、星数 9-1+15=23、火星人。1985は丑年なのでマイナス
const r = rokusei(1985, 8, 15);
check('1985-08-15 の星数', r.starNumber, 23);
check('1985-08-15 の運命星', r.name, '火星人マイナス');
check('1985-08-15 の霊合星人', r.reigo, false);   // 火星人−は未年のときだけ
console.log(`六星占術 1985-08-15: 星数${r.starNumber} ${r.name} 霊合${r.reigo ? '○' : '×'} / 日の干支 ${eto(1985, 8, 15)}`);

// 霊合星人の例。火星人マイナスかつ未年になる日を探す
let reigoFound = null;
for (let y = 1979; y <= 2015 && !reigoFound; y += 12) {          // 未年は12年おき
  for (let m = 1; m <= 12 && !reigoFound; m += 1) {
    for (let d = 1; d <= 28; d += 1) {
      const x = rokusei(y, m, d);
      if (x.reigo && x.star === '火星人') { reigoFound = `${y}-${m}-${d} ${x.name}`; break; }
    }
  }
}
console.log(`霊合星人（火星人−×未年）の実例: ${reigoFound || '見つからず'} ${reigoFound ? '✓' : '✗'}`);
if (!reigoFound) ng += 1;

// ---- 3. 九星の本命星 ----
// 11 - (西暦の数字根)、10 になったら 1。
// 期待値は9年周期で組んである。2000年＝九紫火星を起点に、年が1つ進むと星が
// 1つ戻る（九紫→八白→…→一白→九紫）。1964 は 2000 の36年前（9×4）で同じ九紫、
// 2026 は 2008＝一白の18年後（9×2）で同じ一白。
[[1985, '六白金星'], [2000, '九紫火星'], [1990, '一白水星'],
  [1964, '九紫火星'], [2001, '八白土星'], [1970, '三碧木星'], [2026, '一白水星']]
  .forEach(([y, want]) => check(`${y}年生まれの本命星`, honmeisei(y, 6, 1).name, want));

// 立春で切り替わるか。2026年の立春は2月4日
check('2026-02-03 は前年扱い', honmeisei(2026, 2, 3).year, 2025);
check('2026-02-04 は当年扱い', honmeisei(2026, 2, 4).year, 2026);
check('2026-01-20 は前年扱い', honmeisei(2026, 1, 20).year, 2025);
console.log(`九星: 5年分と立春の境（2026-02-03→${honmeisei(2026, 2, 3).name} / 02-04→${honmeisei(2026, 2, 4).name}）`);

// ---- 4. 繭気属性 ----
// 出典の例をそのまま使う
// minaoha: 1965年7月13日 A型 → 32 → 5、+1 = 6 → 地
// pit-shyaji: 1998年4月5日 O型 → 36 → 9、+4 = 13 → 4 → 風
check('1965-07-13 A型', kenki('1965-07-13', 'A').attr, '地');
check('1998-04-05 O型', kenki('1998-04-05', 'O').attr, '風');
check('不正な入力は null', kenki('1998-04-05', 'X'), null);
console.log(`繭気属性: 出典の2例と入力検査 ${ng === 0 ? '✓' : ''}`);

console.log(ng === 0 ? '\nすべて通過' : `\n${ng} 件の不一致`);
if (ng) process.exit(1);
