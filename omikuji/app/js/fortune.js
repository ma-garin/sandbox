/**
 * 生年月日から出す占い。六星占術・九星の本命星・繭気属性。
 *
 * 典拠の強さが3つでまるで違うので、最初に断っておく。画面にも出すこと。
 *
 *   六星占術  細木数子が考案。運命数表は書籍由来だが、1950〜2030年の
 *             972 値すべてが「生まれた日の干支」と一致することを確認したので、
 *             表は持たずに干支から求める（scripts/verify-fortune.mjs）。
 *   九星      本命星の算法は公開されている。月命星は算法を確認していないので
 *             入れていない。
 *   繭気属性  「最近になって占い師が考え出したもの。ほとんどの神職や僧侶は
 *             自分の社寺の属性を知らない」と資料自身が書いている。提唱者も
 *             初出も確認できなかった。神社側の属性はさらに根拠が弱い。
 */

import { etoIndex, shiIndex, setsuIndex } from './koyomi.js';

/* ---------- 六星占術 ---------- */

const ROKUSEI_STARS = ['土星人', '金星人', '火星人', '天王星人', '木星人', '水星人'];

// 霊合星人になる十二支。運命星ごとに1つだけ決まっている。
// 陽支の年は必ず＋、陰支の年は必ず−になるので、この表と符号は矛盾しない。
const REIGO_SHI = {
  '土星人+': 10, '土星人-': 11,   // 戌 / 亥
  '金星人+': 8, '金星人-': 9,     // 申 / 酉
  '火星人+': 6, '火星人-': 7,     // 午 / 未
  '天王星人+': 4, '天王星人-': 5, // 辰 / 巳
  '木星人+': 2, '木星人-': 3,     // 寅 / 卯
  '水星人+': 0, '水星人-': 1,     // 子 / 丑
};

/** 生まれ年の十二支。0=子。運命数表が1月・2月も同じ年の行に置いているので元日起点。 */
function yearShi(year) {
  return ((year - 4) % 12 + 12) % 12;
}

/**
 * 運命星。
 * 星数は生まれた日の干支そのもの（甲子=1 … 癸亥=60）で、
 * それを10ずつ6つに割ったものが運命星になる。
 */
export function rokusei(year, month, day) {
  const starNumber = etoIndex(year, month, day) + 1;
  const star = ROKUSEI_STARS[Math.floor((starNumber - 1) / 10)];
  const shi = yearShi(year);
  const sign = shi % 2 === 0 ? '+' : '-';       // 子寅辰午申戌が陽
  const reigo = REIGO_SHI[`${star}${sign}`] === shi;
  return { starNumber, star, sign, reigo, name: `${star}${sign === '+' ? 'プラス' : 'マイナス'}` };
}

/* ---------- 九星（本命星） ---------- */

const KYUSEI = [
  '一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星',
  '六白金星', '七赤金星', '八白土星', '九紫火星',
];

/** 桁を足して1桁にする */
function digitalRoot(n) {
  let v = n;
  while (v > 9) v = String(v).split('').reduce((a, c) => a + Number(c), 0);
  return v;
}

/**
 * 本命星。立春で年が切り替わるので、1月と2月の立春前は前年として数える。
 * setsuIndex は 0=寅節（立春〜）で、11=丑節（大寒〜立春）。
 */
export function honmeisei(year, month, day) {
  const beforeRisshun = month === 1 || (month === 2 && setsuIndex(year, month, day) === 11);
  const y = beforeRisshun ? year - 1 : year;
  const n = 11 - digitalRoot(y);
  const index = n > 9 ? n - 9 : n;
  return { year: y, number: index, name: KYUSEI[index - 1], beforeRisshun };
}

/* ---------- 繭気属性 ---------- */

const BLOOD_NUMBER = { A: 1, B: 2, AB: 3, O: 4 };
export const BLOOD_TYPES = Object.keys(BLOOD_NUMBER);

const KENKI_ATTR = { 1: '地', 6: '地', 2: '水', 8: '水', 3: '火', 7: '火', 4: '風', 9: '風', 5: '空' };

/**
 * 人の繭気属性。生年月日の各桁を足して1桁にし、血液型の数を足して また1桁にする。
 * @param {string} birthISO 2000-01-23 の形
 * @param {string} blood A / B / AB / O
 */
export function kenki(birthISO, blood) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthISO || '')) return null;
  if (!(blood in BLOOD_NUMBER)) return null;
  const digits = birthISO.replace(/-/g, '').split('').reduce((a, c) => a + Number(c), 0);
  const number = digitalRoot(digitalRoot(digits) + BLOOD_NUMBER[blood]);
  return { number, attr: KENKI_ATTR[number] };
}

/* ---------- 神社の属性と相性 ---------- */

// 相性がよいとされる組み合わせ。出典は ぴっと社寺net の1件だけで、
// もう1件は表が画像だったため照合できていない。
const COMPAT = {
  空: ['空', '水', '火'],
  地: ['地', '火', '風'],
  水: ['水', '風', '空'],
  火: ['火', '空', '地'],
  風: ['風', '地', '水'],
};

/**
 * 参拝先の属性。記録に出てくる社だけを、資料で確認できた範囲で持つ。
 * 確認できなかった社はここに置かない。画面では「資料で確認できず」と出す。
 */
export const SHRINE_ATTR = {
  東京大神宮: {
    attr: '水',
    source: '神社仏閣あれこれ',
    url: 'https://jinjabukkaku-arekore.com/tokyo-daijingu-attributes/',
  },
  '出雲大社 東京分祠': {
    attr: '地',
    source: 'ニフティ不動産',
    url: 'https://myhome-style.com/column/kaji/231113372643/',
    note: '本社（島根の出雲大社）についての記載。分祠を指したものではない',
  },
  明治神宮: {
    attr: '無',
    source: 'ニフティ不動産',
    url: 'https://myhome-style.com/column/kaji/231113372643/',
    note: '無属性は「誰が訪れても相性を問わない」とされる',
  },
  '天満宮（太宰府天満宮）': {
    attr: '水',
    source: '検索結果の要約',
    unverified: true,
    note: '掲載ページ自体は確認していない',
  },
};

/**
 * 属性同士の相性。
 * @returns {{level:'good'|'plain'|'none', label:string}}
 */
export function compat(mine, theirs) {
  if (!mine || !theirs) return { level: 'none', label: '—' };
  if (theirs === '無') return { level: 'good', label: '属性を問わない' };
  return (COMPAT[mine] || []).includes(theirs)
    ? { level: 'good', label: 'よい' }
    : { level: 'plain', label: 'ふつう' };
}
