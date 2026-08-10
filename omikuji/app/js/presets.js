/**
 * おみくじの型。寺社ごとに項目の並びがまったく違うので、選ぶと入力欄が埋まるようにする。
 *
 * 出どころは2つ:
 *   実物 — この帳面に収めた写真から書き起こしたもの（source: 'photo'）
 *   一般 — 元三大師百籤（観音百籤）系の標準的な並び（source: 'common'）
 * 実物を見ていない寺社を名指ししない。断定できるものだけ社名を冠している。
 */

export const OMIKUJI_PRESETS = [
  {
    id: 'general',
    name: '一般的なおみくじ（13項目）',
    note: '元三大師百籤（観音百籤）系。浅草寺をはじめ多くの寺社がこの並びを使う。',
    source: 'common',
    shrine: null,
    hasPoem: true,
    items: ['願望', '待人', '失物', '旅行', '商売', '学問', '相場', '争事', '恋愛', '転居', '出産', '病気', '縁談'],
  },
  {
    id: 'daijingu-koi',
    name: '東京大神宮 恋みくじ',
    note: '赤い波線枠に「恋の歌」と「愛情運」。相性の見方が並ぶ。',
    source: 'photo',
    shrine: '東京大神宮',
    hasPoem: true,
    items: ['星座', '血液型', '年令差', '十二支', '方位', '待ち合せ', '縁談', '結婚', '学問'],
  },
  {
    id: 'daijingu-enmusubi',
    name: '東京大神宮 縁結びみくじ',
    note: '草花の絵と古歌。交際と出会いだけを説く。',
    source: 'photo',
    shrine: '東京大神宮',
    hasPoem: true,
    items: ['交際', '出会い'],
  },
  {
    id: 'izumo',
    name: '出雲大社 東京分祠 御神籤',
    note: '吉凶を記さず、「訓」と「運勢」で説く形式。',
    source: 'photo',
    shrine: '出雲大社 東京分祠',
    hasPoem: false,
    hasTeaching: true,
    items: ['通信', '土木', '結婚', '病気', '移転', '失物', '売買', '方位', '旅行'],
  },
  {
    id: 'kanda',
    name: '神田明神',
    note: '一之宮〜三之宮の神さまが添えられる。',
    source: 'photo',
    shrine: '神田明神（江戸総鎮守）',
    hasPoem: false,
    items: ['願事', '待人', '失物', '旅行', '商売', '学問', '方向', '争事', '求人', '転居', '病気', '縁談'],
  },
  {
    id: 'meiji',
    name: '明治神宮 大御心',
    note: '吉凶も判断項目もなく、御製・御歌を一首いただく形式。',
    source: 'photo',
    shrine: '明治神宮',
    hasPoem: true,
    hasFortune: false,
    items: [],
  },
  {
    id: 'kushida',
    name: '櫛田神社（博多総鎮守）',
    note: '項目が多く、求職や勝負まで説く。',
    source: 'photo',
    shrine: '櫛田神社（博多総鎮守）',
    hasPoem: false,
    hasTeaching: true,
    items: ['願望', '待人', '失物', '旅行', '争事', '商業', '売買', '転居', '建築', '求人', '縁談', '出産', '病気', '勝負', '学問', '求職'],
  },
  {
    id: 'tenmangu',
    name: '天満宮（太宰府天満宮ほか）',
    note: '学問の神さま。求職・学問を含む。',
    source: 'photo',
    shrine: '太宰府天満宮',
    hasPoem: false,
    items: ['願望', '待人', '失物', '旅行', '争事', '転居', '建築', '商業', '病気', '縁談', '出産', '学問', '求職'],
  },
  {
    id: 'unsei',
    name: '運勢みくじ（暮らし向き）',
    note: '判断ではなく、暮らしの場面ごとに一言添える新しい形式。',
    source: 'photo',
    shrine: null,
    hasPoem: false,
    items: ['仕事', '金運', '愛情', '家庭', '対人', '勝負', '健康', '趣味', '買い物'],
  },
  {
    id: 'free',
    name: '型を選ばず自由に書く',
    note: '当てはまるものがないとき。項目は自分で書き足せる。',
    source: 'common',
    shrine: null,
    hasPoem: true,
    items: [],
  },
];

export function findPreset(id) {
  return OMIKUJI_PRESETS.find((p) => p.id === id) || null;
}

/**
 * 記録の中身から、どの型かを推し量る。編集で開いたときに型を選び直させないため。
 * 判断できなければ null（勝手に決めない）。
 */
export function guessPreset(entry) {
  const labels = new Set((entry.items || []).map((i) => i.label));
  if (!labels.size) return entry.poem ? 'meiji' : null;

  let best = null;
  let bestScore = 0;
  OMIKUJI_PRESETS.forEach((p) => {
    if (!p.items.length) return;
    const hit = p.items.filter((l) => labels.has(l)).length;
    const score = hit / Math.max(p.items.length, labels.size);
    if (score > bestScore) { bestScore = score; best = p.id; }
  });
  return bestScore >= 0.7 ? best : null;
}

/* ---------- おみくじの番号 ---------- */

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 1〜100 を漢数字にする。47 → 四十七、20 → 二十、100 → 百 */
export function kanjiNumber(n) {
  if (n === 100) return '百';
  if (n < 10) return KANJI[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens === 1 ? '十' : `${KANJI[tens]}十`) + KANJI[ones];
}

/**
 * 番号の選択肢。元三大師百籤が百番までなので、第一番〜第百番を並べる。
 * これに当てはまらない書き方（第11番、第三〇番など）は自由記入で受ける。
 */
export function numberOptions() {
  return Array.from({ length: 100 }, (_, i) => `第${kanjiNumber(i + 1)}番`);
}
