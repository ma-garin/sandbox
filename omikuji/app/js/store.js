/**
 * データの出し入れだけを担う層。
 *
 * 出どころが2つある:
 *   builtin — data/omikuji.json（写真から書き起こした過去の記録。読み取り専用）
 *   user    — この端末の localStorage に足した記録（消せる）
 * 画面側はこの違いを source フィールドだけで見分ける。
 *
 * 写真そのものは持たない。読み返すのは本文なので、テキストだけを扱う。
 */

const KEY_ENTRIES = 'omikuji.entries.v1';
const KEY_OVERRIDES = 'omikuji.overrides.v1';
const KEY_INTRO = 'omikuji.introSeen.v1';

/** 吉凶の並び順。神社本庁の一例に合わせる（大吉→吉→中吉→小吉→末吉→凶） */
export const FORTUNE_ORDER = ['大吉', '吉', '中吉', '小吉', '末吉', '凶', '大凶'];

/** 記録の種別 */
export const TYPE_OMIKUJI = 'omikuji';
export const TYPE_VISIT = 'visit';

/** 書き起こし済みの記録を読む。失敗はそのまま投げ、画面側で伝える。 */
export async function loadBuiltIn() {
  const res = await fetch('data/omikuji.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`記録の読み込みに失敗しました (HTTP ${res.status})`);
  const json = await res.json();
  if (!json || !Array.isArray(json.entries)) throw new Error('記録の形式が想定と違います');
  return json.entries.map((e) => Object.freeze({ ...e, source: 'builtin' }));
}

/** この端末に足した記録を読む。壊れていたら握りつぶさず空にして警告を返す。 */
export function loadUser() {
  const raw = localStorage.getItem(KEY_ENTRIES);
  if (!raw) return { entries: [], warning: null };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('配列ではありません');
    return {
      entries: parsed.map((e) => Object.freeze({ ...e, source: 'user' })),
      warning: null,
    };
  } catch (err) {
    // 壊れていても捨てない。このあと1件でも足すと上書きで永久に失われるため、
    // 別のキーへ退避してから空で始める。
    try {
      localStorage.setItem(`${KEY_ENTRIES}.broken.${Date.now()}`, raw);
    } catch {
      // 退避もできない（容量など）ときは、せめて警告だけは出す
    }
    return {
      entries: [],
      warning: `保存されていた記録を読めませんでした（${err.message}）。壊れたデータは残してあります。`,
    };
  }
}

function writeUser(entries) {
  localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries.map(({ source, ...rest }) => rest)));
}

/** 追加する。既存配列は変えず、新しい配列を返す。 */
export function addUser(entries, entry) {
  const next = [...entries, Object.freeze({ ...entry, source: 'user' })];
  writeUser(next);
  return next;
}

/** 差し替える。編集で使う。 */
export function updateUser(entries, entry) {
  const next = entries.map((e) => (e.id === entry.id ? Object.freeze({ ...entry, source: 'user' }) : e));
  writeUser(next);
  return next;
}

/** 消す。 */
export function removeUser(entries, id) {
  const next = entries.filter((e) => e.id !== id);
  writeUser(next);
  return next;
}

/* ---------- 書き起こし記録の手直し ----------
 *
 * data/omikuji.json は写真から起こしたものなので、写し間違いが混じりうる。
 * かといって配布ファイルを端末側で書き換えるわけにはいかないので、
 * 「どこをどう直したか」だけを localStorage に持ち、読むときに重ねる。
 * こうすると元の記録はいつでも取り戻せる。
 */

export function loadOverrides() {
  const raw = localStorage.getItem(KEY_OVERRIDES);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  localStorage.setItem(KEY_OVERRIDES, JSON.stringify(overrides));
}

/** 手直しを記録する。既存を変えず新しいオブジェクトを返す。 */
export function setOverride(overrides, id, patch) {
  const next = { ...overrides, [id]: patch };
  writeOverrides(next);
  return next;
}

/** 手直しを取り消して、書き起こしたときの内容に戻す。 */
export function clearOverride(overrides, id) {
  const next = { ...overrides };
  delete next[id];
  writeOverrides(next);
  return next;
}

/** 読むときに重ねる。直した記録には edited の印を付け、画面で区別できるようにする。 */
export function applyOverrides(builtin, overrides) {
  return builtin.map((e) => (
    overrides[e.id]
      ? Object.freeze({ ...e, ...overrides[e.id], id: e.id, source: 'builtin', edited: true })
      : e
  ));
}

export function introSeen() {
  return localStorage.getItem(KEY_INTRO) === '1';
}

export function markIntroSeen() {
  localStorage.setItem(KEY_INTRO, '1');
}

/** localStorage が一杯かどうかは書いてみないと分からないので、呼び出し側でこれを使う。 */
export function isQuotaError(err) {
  return err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
}

/** 同じ日に複数回引くことがあるので、日付だけでは一意にならない。 */
export function makeId(date, existing) {
  const used = new Set(existing.map((e) => e.id));
  for (let n = 1; ; n += 1) {
    const id = `${date}-u${n}`;
    if (!used.has(id)) return id;
  }
}

/** 「願望: 叶う」の行を項目の配列にする。空行と区切りのない行は捨てる。 */
export function parseItems(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)\s*[:：]\s*(.*)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : null;
    })
    .filter(Boolean);
}

/** 項目の配列を、フォームに戻すためのテキストにする。 */
export function formatItems(items) {
  return (items || []).map((i) => `${i.label}: ${i.value || ''}`).join('\n');
}

/**
 * 検索用にそろえる。全角で打っても半角の記録に当たるよう NFKC を通す
 * （日本語入力の既定は全角なので、これがないと数字がまず当たらない）。
 */
export function normalizeText(text) {
  return String(text || '').normalize('NFKC').toLowerCase();
}

const KANJI_DIGIT = {
  '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
};

/**
 * 「第三十二番」「第三〇番」「第11番」「二十一番」をすべて同じ数として扱う。
 * 引き直しに気づけるようにするための照合キーであって、表示は原文のまま使う。
 * 読めなければ null を返す（推測して間違った同一視をしない）。
 */
export function numberKey(text) {
  if (!text) return null;
  const body = String(text).replace(/[第番]/g, '').trim();
  if (!body) return null;

  const arabic = normalizeText(body).match(/\d+/);
  if (arabic) return Number(arabic[0]);

  // 〇 を含む書き方（三〇 = 30）は位取りではなく数字の並び
  if (/[〇零]/.test(body)) {
    const digits = [...body].map((c) => KANJI_DIGIT[c]).filter((n) => n != null);
    return digits.length ? Number(digits.join('')) : null;
  }

  // 十・百を使う位取りの書き方（三十二 = 32、二十一 = 21）
  let total = 0;
  let current = 0;
  let found = false;
  for (const ch of body) {
    if (ch in KANJI_DIGIT) { current = KANJI_DIGIT[ch]; found = true; }
    else if (ch === '十') { total += (current || 1) * 10; current = 0; found = true; }
    else if (ch === '百') { total += (current || 1) * 100; current = 0; found = true; }
  }
  return found ? total + current : null;
}

/** 同じ神社で同じ番号を引いた、ほかの回。神社が違えば別の番号体系なので混ぜない。 */
export function sameNumberEntries(entries, entry) {
  const key = numberKey(entry.number);
  if (key == null || !entry.shrine) return [];
  return entries.filter((e) => (
    e.id !== entry.id
    && e.shrine === entry.shrine
    && numberKey(e.number) === key
  ));
}

/* ---------- 持ち出しと取り込み ----------
 *
 * 自分で足した記録はこの端末の中にしかない。機種変更やブラウザのデータ削除で
 * 消えてしまうので、ファイルとして書き出せるようにしておく。
 */

export function buildBundle(user, overrides, stampedAt) {
  return {
    app: 'omikuji-cho',
    version: 1,
    exportedAt: stampedAt,
    entries: user.map(({ source, ...rest }) => rest),
    overrides,
  };
}

/** 取り込むファイルは他人が作ったかもしれない。境界で必ず検める。 */
export function parseBundle(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON として読めないファイルです。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('おみくじ帳の書き出しファイルではないようです。');
  }
  const entries = Array.isArray(data.entries) ? data.entries : null;
  if (!entries) throw new Error('記録が入っていないファイルです。');

  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') throw new Error(`${i + 1}件目の記録の形式が違います。`);
    if (!e.id || !e.date) throw new Error(`${i + 1}件目の記録に id か日付がありません。`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`${i + 1}件目の日付の形式が違います（${e.date}）。`);
  });

  const overrides = (data.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides))
    ? data.overrides
    : {};

  return { entries, overrides };
}

/** 取り込んだ内容で丸ごと置き換える。 */
export function replaceAll(entries, overrides) {
  writeUser(entries);
  writeOverrides(overrides);
  return {
    user: entries.map((e) => Object.freeze({ ...e, source: 'user' })),
    overrides,
  };
}

/** 今日の日付を YYYY-MM-DD で。記録はその日のうちに付けることが多い。 */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 過去に入力された神社名を、入力補助の候補として集める。 */
export function shrineSuggestions(entries) {
  const counts = new Map();
  entries.forEach((e) => {
    if (!e.shrine) return;
    counts.set(e.shrine, (counts.get(e.shrine) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
