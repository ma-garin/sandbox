/**
 * 旧暦と暦注。六曜・一粒万倍日・天赦日・不成就日・月の満ち欠けを出す。
 *
 * 旧暦は簡易式では求まらない。太陽と月の黄経を計算し、朔（新月）と中気を
 * 反復で解いて初めて月日が決まる。ここは高野英明「QREKI.AWK」の手順を
 * そのまま移した（係数は koyomi-terms.js に機械抽出したものを置いてある）。
 *
 * 精度について:
 *   原典が「天保暦法で厳密に計算した日付と1日前後する可能性がある」と
 *   自認している。天保暦は京都の真太陽時と経験定数を使うのに対し、
 *   こちらは JST と天体力学の略算式を使うため。直せる種類の差ではないので、
 *   画面には「公式の暦と異なる場合がある」と明示すること。
 *   既知の誤り（2224年の閏月）は 2100 年までなら該当しない。
 *
 * 一粒万倍日・天赦日には典拠となる原典がない（日本で作られた暦注で、
 * 出典が存在しないと Wikipedia が明記している）。業者によって一覧が
 * 割れることがあるため、こちらも「一般に流布している算出法による」と明示する。
 */

import { SUN_TERMS, MOON_TERMS } from './koyomi-terms.js';

const K = Math.PI / 180;
const TZ = 9 / 24;             // JST
const JD_UNIX_EPOCH = 2440587.5;

/** 太陽の黄経 λsun。t = (JD - 2451545) / 36525 */
export function longitudeOfSun(t) {
  let th = 0;
  for (const [amp, a, b] of SUN_TERMS) {
    th += amp * Math.cos(K * ((a * t + b) % 360));
  }
  // 主要項。同じ角度に -0.0048t と +1.9147 が乗る
  const ang = (35999.05 * t + 267.52) % 360;
  th -= 0.0048 * t * Math.cos(K * ang);
  th += 1.9147 * Math.cos(K * ang);

  // JS の % は負の符号を残すが、原典（Python）の % は常に正を返す。
  // ここで負が漏れると朔の分岐判定が狂って1朔ぶんずれる。
  return normalize(th + normalize(normalize(36000.7695 * t) + 280.4659));
}

/** 月の黄経 λmoon */
export function longitudeOfMoon(t) {
  let th = 0;
  for (const [amp, a, b] of MOON_TERMS) {
    th += amp * Math.cos(K * ((a * t + b) % 360));
  }
  return normalize(th + normalize(normalize(481267.8809 * t) + 218.3162));
}

/** 年月日 → ユリウス日（0時） */
export function toJD(year, month, day) {
  let y = year;
  let m = month;
  if (m < 3) { m += 12; y -= 1; }
  return Math.floor(365.25 * y) + Math.floor(y / 400) - Math.floor(y / 100)
    + Math.floor(30.59 * (m - 2)) + day + 1721088.5;
}

function jdToYmd(jd) {
  const x0 = Math.floor(jd + 68570);
  const x1 = Math.floor(x0 / 36524.25);
  const x2 = x0 - Math.floor(36524.25 * x1 + 0.75);
  const x3 = Math.floor((x2 + 1) / 365.2425);
  const x4 = x2 - Math.floor(365.25 * x3) + 31;
  const x5 = Math.floor(Math.floor(x4) / 30.59);
  const x6 = Math.floor(Math.floor(x5) / 11);

  const day = Math.floor(x4) - Math.floor(30.59 * x5);
  const month = x5 - 12 * x6 + 2;
  const year = 100 * (x1 - 49) + x3 + x6;
  // 3月0日 → 2月末
  if (month === 2 && day > 28) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return { year, month, day: leap ? Math.min(day, 29) : Math.min(day, 28) };
  }
  return { year, month, day };
}

/** Python の math.modf。整数部と小数部に分ける（負数は 0 方向に切る） */
function modf(x) {
  const int = Math.trunc(x);
  return [x - int, int];
}

/**
 * 反復で解く共通部分。
 * 太陽黄経が step の倍数になる時刻を、対象時刻より前で探す。
 * step=90 なら二分二至、step=30 なら中気。
 *
 * 目標の黄経（rm0）は最初に一度だけ決める。ループのたびに
 * 求め直すと収束先が動いてしまい、朔が1〜2日ずれる。
 */
function solveSunAngle(tm, step) {
  let [tm2, tm1] = modf(tm);
  tm2 -= TZ;

  let t = (tm2 + 0.5) / 36525.0 + (tm1 - 2451545.0) / 36525.0;
  const rm0 = longitudeOfSun(t) - (longitudeOfSun(t) % step);

  let dt1 = 0;
  let dt2 = 1;
  let guard = 0;
  while (Math.abs(dt1 + dt2) > 1 / 86400 && guard < 60) {
    guard += 1;
    t = (tm2 + 0.5) / 36525.0 + (tm1 - 2451545.0) / 36525.0;
    let dl = longitudeOfSun(t) - rm0;
    // 引き込み範囲（±180°）を外れたら補正する
    if (dl > 180) dl -= 360;
    else if (dl < -180) dl += 360;

    [dt2, dt1] = modf(dl * 365.2 / 360);
    tm1 -= dt1;
    tm2 -= dt2;
    if (tm2 < 0) { tm2 += 1; tm1 -= 1; }
  }
  return [tm1 + tm2 + TZ, rm0];
}

/** 直前の二分二至（春分・夏至・秋分・冬至）。検算のため export する */
export function beforeNibun(tm) {
  return solveSunAngle(tm, 90);
}

/** 中気（太陽黄経が30の倍数になる時刻）。検算のため export する */
export function chuki(tm) {
  return solveSunAngle(tm, 30);
}

/** 朔（新月＝月と太陽の黄経が一致する時刻） */
export function saku(tm) {
  let [tm2, tm1] = modf(tm);
  tm2 -= TZ;

  let dt1 = 0;
  let dt2 = 1;
  let lc = 1;
  while (Math.abs(dt1 + dt2) > 1 / 86400) {
    const t = (tm2 + 0.5) / 36525.0 + (tm1 - 2451545.0) / 36525.0;
    const rmSun = longitudeOfSun(t);
    const rmMoon = longitudeOfMoon(t);
    let dl = rmMoon - rmSun;

    // 初回、引き込み範囲、月と太陽が 0°/360° をまたぐ場合の補正
    if (lc === 1 && dl < 0) dl = normalize(dl);
    else if (rmSun >= 0 && rmSun <= 20 && rmMoon >= 300) dl = 360 - normalize(dl);
    else if (Math.abs(dl) > 40) dl = normalize(dl);

    [dt2, dt1] = modf(dl * 29.530589 / 360);
    tm1 -= dt1;
    tm2 -= dt2;
    if (tm2 < 0) { tm2 += 1; tm1 -= 1; }

    if (lc === 15 && Math.abs(dt1 + dt2) > 1 / 86400) {
      // 振動して収束しないときは初期値をずらしてやり直す（原典どおり）。
      // ここは元の引数 tm をそのまま使う。切り捨てると別の朔に飛ぶ。
      tm1 = tm - 26;
      tm2 = 0;
    } else if (lc >= 29) {
      break;
    }
    lc += 1;
  }
  return tm1 + tm2 + TZ;
}

function normalize(angle) {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * 新暦の年月日から旧暦を求める。
 * 手順は QREKI.AWK のとおり。朔の並びの補正2種と閏月の判定は、
 * 自分で考えると必ず間違えるので原典の順序を崩さずに移した。
 * @returns {{year:number, month:number, day:number, leap:boolean}}
 */
export function toKyureki(year, month, day) {
  // ローカル補正込みの整数ユリウス通日。
  // toJD は 0 時を指すので端数は必ず .5。+0.5 してから丸めると翌日になる。
  const tm0 = Math.floor(toJD(year, month, day));

  // 直前の二分二至 → そこから中気を3つ
  const chu = [beforeNibun(tm0)];
  for (let i = 1; i < 4; i += 1) chu.push(chuki(chu[i - 1][0] + 32));

  // 二分二至の直前の朔から、朔を5つ
  const sk = [saku(chu[0][0])];
  for (let i = 1; i < 5; i += 1) {
    sk.push(saku(sk[i - 1] + 30));
    if (Math.abs(Math.trunc(sk[i - 1]) - Math.trunc(sk[i])) <= 26) {
      // 前と同じ朔を拾ってしまったので、初期値をずらして取り直す
      sk[i] = saku(sk[i - 1] + 35);
    }
  }

  if (Math.trunc(sk[1]) <= Math.trunc(chu[0][0])) {
    // さかのぼり過ぎたので繰り下げる（近日点の近くで朔があると起きる）
    for (let i = 0; i < 4; i += 1) sk[i] = sk[i + 1];
    sk[4] = saku(sk[3] + 35);
  } else if (Math.trunc(sk[0]) > Math.trunc(chu[0][0])) {
    // さかのぼり足りないので繰り上げる（春分点の近くで朔があると起きる）
    for (let i = 4; i > 0; i -= 1) sk[i] = sk[i - 1];
    sk[0] = saku(sk[0] - 27);
  }

  // 節月4ヶ月の間に朔が5回あると、閏月がある可能性がある
  let leap = Math.trunc(sk[4]) <= Math.trunc(chu[3][0]) ? 1 : 0;

  // 朔日行列 m[i] = [月, 閏フラグ, 朔のJD]
  const m = [[Math.trunc(chu[0][1] / 30) + 2, 0, Math.trunc(sk[0])], [], [], [], []];
  for (let i = 1; i < 5; i += 1) {
    if (leap === 1 && i !== 1) {
      if (Math.trunc(chu[i - 1][0]) <= Math.trunc(sk[i - 1])
        || Math.trunc(chu[i - 1][0]) >= Math.trunc(sk[i])) {
        // 中気を含まない月＝閏月
        m[i - 1][0] = m[i - 2][0];
        m[i - 1][1] = 1;
        m[i - 1][2] = Math.trunc(sk[i - 1]);
        leap = 0;
      }
    }
    let mo = m[i - 1][0] + 1;
    if (mo > 12) mo -= 12;
    m[i] = [mo, 0, Math.trunc(sk[i])];
  }

  // 対象日がどの月に入るか
  let index = 5;
  let state = 0;
  for (let i = 0; i < 5; i += 1) {
    if (tm0 < m[i][2]) { state = 1; index = i; break; }
    if (tm0 === m[i][2]) { state = 2; index = i; break; }
  }
  if (state === 0 || state === 1) index -= 1;

  const kMonth = m[index][0];
  const kLeap = m[index][1] === 1;
  const kDay = tm0 - m[index][2] + 1;

  // 旧暦月が10以上で、かつ新暦月より大きければ、まだ年を越していない
  let kYear = year;
  if (kMonth > 9 && kMonth > month) kYear -= 1;

  return { year: kYear, month: kMonth, day: kDay, leap: kLeap };
}

/* ---------- 六曜 ---------- */

const ROKUYOU = ['大安', '赤口', '先勝', '友引', '先負', '仏滅'];

/** 六曜。(旧暦の月 + 旧暦の日) mod 6。閏月は前の月と同じ月番号を使う。 */
export function rokuyou(year, month, day) {
  const k = toKyureki(year, month, day);
  return ROKUYOU[(k.month + k.day) % 6];
}

/* ---------- 日の干支 ---------- */

const KAN = '甲乙丙丁戊己庚辛壬癸';
const SHI = '子丑寅卯辰巳午未申酉戌亥';

/** 日の干支。0 = 甲子 */
export function etoIndex(year, month, day) {
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return (((days + 2440588 + 49) % 60) + 60) % 60;
}

export function eto(year, month, day) {
  const n = etoIndex(year, month, day);
  return KAN[n % 10] + SHI[n % 12];
}

/** 日の十二支。0 = 子 */
export function shiIndex(year, month, day) {
  return etoIndex(year, month, day) % 12;
}

/* ---------- 節月（二十四節気の「節」で区切る月） ---------- */

/**
 * 節月。0 = 寅節（立春から）、1 = 卯節、… 11 = 丑節。
 * 節入り時刻が何時であってもその日から新しい節月に入る扱いにするため、
 * その日の 24 時（＝翌日 0 時 JST）の太陽黄経で判定する。
 */
export function setsuIndex(year, month, day) {
  const jd = toJD(year, month, day) + 1 - TZ;      // 翌日 0 時 JST
  const t = (jd - 2451545.0) / 36525.0;
  const lon = longitudeOfSun(t);
  return Math.floor(((((lon + 45) % 360) + 360) % 360) / 30);
}

/* ---------- 暦注 ---------- */

/** 節月ごとの、一粒万倍日にあたる十二支。0=子 … 11=亥 */
const ICHIRYU = [
  [1, 6],    // 寅節: 丑・午
  [2, 9],    // 卯節: 寅・酉
  [0, 3],    // 辰節: 子・卯
  [3, 4],    // 巳節: 卯・辰
  [5, 6],    // 午節: 巳・午
  [6, 9],    // 未節: 午・酉
  [0, 7],    // 申節: 子・未
  [3, 8],    // 酉節: 卯・申
  [6, 9],    // 戌節: 午・酉
  [9, 10],   // 亥節: 酉・戌
  [0, 11],   // 子節: 子・亥
  [0, 3],    // 丑節: 子・卯
];

export function isIchiryuManbaibi(year, month, day) {
  return ICHIRYU[setsuIndex(year, month, day)].includes(shiIndex(year, month, day));
}

/** 天赦日。季ごとに決まった干支の日。年に5〜6回しかない。 */
export function isTenshabi(year, month, day) {
  const setsu = setsuIndex(year, month, day);
  const e = eto(year, month, day);
  if (setsu >= 0 && setsu <= 2) return e === '戊寅';   // 春（寅・卯・辰節）
  if (setsu >= 3 && setsu <= 5) return e === '甲午';   // 夏
  if (setsu >= 6 && setsu <= 8) return e === '戊申';   // 秋
  return e === '甲子';                                  // 冬
}

/** 不成就日。旧暦の月日だけで決まる。 */
const FUJOJU = {
  1: [3, 11, 19, 27], 7: [3, 11, 19, 27],
  2: [2, 10, 18, 26], 8: [2, 10, 18, 26],
  3: [1, 9, 17, 25], 9: [1, 9, 17, 25],
  4: [4, 12, 20, 28], 10: [4, 12, 20, 28],
  5: [5, 13, 21, 29], 11: [5, 13, 21, 29],
  6: [6, 14, 22, 30], 12: [6, 14, 22, 30],
};

export function isFujojubi(year, month, day) {
  const k = toKyureki(year, month, day);
  return (FUJOJU[k.month] || []).includes(k.day);
}

/* ---------- 月の満ち欠け ---------- */

const MOON_PHASES = ['新月', '三日月', '上弦', '十三夜', '満月', '寝待月', '下弦', '有明月'];

/**
 * 月齢と満ち欠け。平均朔望月の近似ではなく、上の朔の計算をそのまま使う。
 * 近似式だと 2021〜2100 年の朔 977 回のうち約1割で日付が1日ずれる。
 */
export function moon(year, month, day) {
  const jd = toJD(year, month, day) + 0.5;     // その日の正午
  // 直前の朔を探す
  let s = saku(jd);
  if (s > jd) s = saku(jd - 29.5);
  const age = jd - s;
  const phase = age / 29.530589;
  const idx = Math.floor((phase + 1 / 16) * 8) % 8;
  return { age: Math.round(age * 10) / 10, phase: MOON_PHASES[idx], index: idx };
}

/* ---------- 新月・上弦・満月・下弦の日 ---------- */

/**
 * 月と太陽の黄経差を、target を中心に ±180 へ折り返して返す。
 * jd は saku と同じ「ローカル補正込みの0時基準」で渡す。
 */
function moonSunDiff(jd, target) {
  const t = (jd - TZ + 0.5 - 2451545.0) / 36525.0;
  let d = normalize(longitudeOfMoon(t) - longitudeOfSun(t)) - target;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

/**
 * 黄経差が target になる時刻を二分法で解く。
 * 朔（target=0）は原典の saku で解けるが、上弦・満月・下弦の計算は原典にない。
 * 黄経差は1日に約12.19度、単調に増えるので、朔からの見当を中心に
 * ±3日を挟めば必ず1点だけ入る。
 */
function solveMoonPhase(sakuJd, target) {
  let lo = sakuJd + (target / 360) * 29.530589 - 3;
  let hi = lo + 6;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (moonSunDiff(mid, target) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const PHASE_TARGETS = [[0, '新月'], [90, '上弦'], [180, '満月'], [270, '下弦']];

// 朔ひとつにつき4回の二分法（各60反復）が要る。カレンダーは1日ずつ
// 呼んでくるので、朔を鍵にして月に1〜2回で済ませる。
const phaseCache = new Map();

function eventsFromSaku(s) {
  const key = Math.floor(s);
  let hit = phaseCache.get(key);
  if (!hit) {
    hit = PHASE_TARGETS.map(([target, name]) => ({
      name,
      jd: target === 0 ? s : solveMoonPhase(s, target),
    }));
    phaseCache.set(key, hit);
  }
  return hit;
}

/**
 * その日に新月・上弦・満月・下弦のいずれかが起きるなら名前を返す。
 * moon() の phase は「いちばん近い相」なので、朔の2日前でも新月と出る。
 * 節目の日を知りたいときは必ずこちらを使う。
 */
export function moonEvent(year, month, day) {
  const tm0 = Math.floor(toJD(year, month, day));
  let s = saku(tm0 + 1);
  if (Math.floor(s) > tm0) s = saku(tm0 - 28);
  const hit = eventsFromSaku(s).find((e) => Math.floor(e.jd) === tm0);
  return hit ? hit.name : null;
}

/** その日の暦注をまとめて返す。カレンダーが1日ごとに呼ぶ。 */
export function dayInfo(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const k = toKyureki(year, month, day);
  return {
    kyureki: k,
    rokuyou: ROKUYOU[(k.month + k.day) % 6],
    eto: eto(year, month, day),
    ichiryu: isIchiryuManbaibi(year, month, day),
    tensha: isTenshabi(year, month, day),
    fujoju: isFujojubi(year, month, day),
  };
}
