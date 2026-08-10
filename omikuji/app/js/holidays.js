/**
 * 日本の祝日をその場で計算する。表を持たずに済ませたいのは、
 * 2100年まで先の分を配るとファイルが太るのと、更新を忘れるため。
 *
 * 対象は 2021年以降の恒久ルール（祝日法の現行規定）。
 *   ・2020/2021 の五輪特例（海の日・スポーツの日・山の日の移動）は入れていない
 *   ・2019年の即位関連の休日、2018年以前の天皇誕生日(12/23)も入れていない
 *   この帳面の記録は2024年からなので、実用上は足りる。それより前を表示したときは
 *   祝日が出ないか、実際と違う可能性がある（isSupportedYear で判定できる）。
 *
 * 春分・秋分は近似式で求めている。天文計算の丸めなので、
 * 遠い未来では官報の暦と1日ずれる可能性がある。
 */

const FIRST_SUPPORTED_YEAR = 2021;
const LAST_SUPPORTED_YEAR = 2150;

export function isSupportedYear(year) {
  return year >= FIRST_SUPPORTED_YEAR && year <= LAST_SUPPORTED_YEAR;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function key(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** その月の n 回目の月曜日（ハッピーマンデー用） */
function nthMonday(year, month, nth) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const offset = (8 - firstDow) % 7;   // 1日から最初の月曜までの日数
  return 1 + offset + (nth - 1) * 7;
}

/** 春分の日。1980〜2099 と 2100〜2150 で式が変わる。 */
function vernalEquinox(year) {
  if (year <= 2099) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return Math.floor(21.8510 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 秋分の日。 */
function autumnalEquinox(year) {
  if (year <= 2099) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * その年の祝日を { 'YYYY-MM-DD': '名前' } で返す。
 * 振替休日と国民の休日も含む。
 */
export function holidaysOf(year) {
  const base = new Map();
  const add = (m, d, name) => base.set(key(year, m, d), name);

  add(1, 1, '元日');
  add(1, nthMonday(year, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  add(2, 23, '天皇誕生日');
  add(3, vernalEquinox(year), '春分の日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(7, nthMonday(year, 7, 3), '海の日');
  add(8, 11, '山の日');
  add(9, nthMonday(year, 9, 3), '敬老の日');
  add(9, autumnalEquinox(year), '秋分の日');
  add(10, nthMonday(year, 10, 2), 'スポーツの日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  const result = new Map(base);

  // 振替休日: 祝日が日曜なら、その後の最初の平日を休みにする
  [...base.keys()].sort().forEach((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getDay() !== 0) return;
    const next = new Date(y, m - 1, d);
    do {
      next.setDate(next.getDate() + 1);
    } while (result.has(key(next.getFullYear(), next.getMonth() + 1, next.getDate())));
    result.set(key(next.getFullYear(), next.getMonth() + 1, next.getDate()), '振替休日');
  });

  // 国民の休日: 祝日に挟まれた平日（実際に起きるのは9月の敬老の日と秋分の日の間だけ）
  const sep = [nthMonday(year, 9, 3), autumnalEquinox(year)].sort((a, b) => a - b);
  if (sep[1] - sep[0] === 2) {
    const middle = key(year, 9, sep[0] + 1);
    if (!result.has(middle)) result.set(middle, '国民の休日');
  }

  return result;
}

const cache = new Map();

/** 年をまたいで使い回す。1年分の計算は軽いが、月送りのたびに走るので覚えておく。 */
export function holidayName(iso) {
  const year = Number(iso.slice(0, 4));
  if (!isSupportedYear(year)) return null;
  if (!cache.has(year)) cache.set(year, holidaysOf(year));
  return cache.get(year).get(iso) || null;
}
