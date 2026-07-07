// engine.js — 6品質観点のルールベース解析エンジン（ブラウザ/Node両対応の純粋関数）
//
// 観点: 正確性 / 理解性 / 視覚性 / 深層性 / 信頼性 / 検証可能性
// 元QuintSpectの5観点に「検証可能性（テスト容易性）」を追加してレベルアップ。
//
// 設計:
// - 入力テキストを行単位・文単位に分解し、観点ごとのルールを適用
// - 各指摘(finding)は evidence（該当引用）と location（行番号）を必ず持つ = evidence-only
// - severity は ISTQB準拠（Critical/High/Medium/Low）
// - スコアは観点ごとに100点満点から減点。文書量で正規化して短文が過剰減点されないようにする

export const VIEWPOINTS = [
  { key: "accuracy",      label: "正確性",     desc: "曖昧表現・矛盾・不整合のなさ" },
  { key: "clarity",       label: "理解性",     desc: "文の読みやすさ・論理の通り" },
  { key: "visual",        label: "視覚性",     desc: "見出し・箇条書き・図表の構造" },
  { key: "depth",         label: "深層性",     desc: "網羅性・前提・例外・非機能の深さ" },
  { key: "reliability",   label: "信頼性",     desc: "根拠・出典・トレーサビリティ" },
  { key: "verifiability", label: "検証可能性", desc: "測定可能で検証できる記述か" },
];

export const SEVERITY = ["Critical", "High", "Medium", "Low"];

// 観点別スコアから総合スコアを算出。weights未指定（またはすべて等値）なら単純平均。
// 観点別スコア自体は変えず、総合の重み付けだけを変える（レーダーは不変）。
export function weightedOverall(scores, weights = null) {
  const keys = VIEWPOINTS.map((v) => v.key);
  const simple = () => Math.round(keys.reduce((s, k) => s + (scores[k] ?? 0), 0) / keys.length);
  if (!weights) return simple();
  let wsum = 0, sum = 0;
  for (const k of keys) {
    const w = Number(weights[k]);
    const ww = Number.isFinite(w) && w >= 0 ? w : 1;
    wsum += ww; sum += ww * (scores[k] ?? 0);
  }
  return wsum > 0 ? Math.round(sum / wsum) : simple();
}
const SEVERITY_WEIGHT = { Critical: 12, High: 7, Medium: 4, Low: 2 };

// ---- 辞書（管理タブから上書き可能。既定はここ、上書きはlocalStorage） --------

// 既定辞書（従来ハードコードしていた値の正）
export const DEFAULT_DICT = Object.freeze({
  // 曖昧語（正確性・検証可能性を損なう）
  vagueWords: [
    "適切に", "適宜", "随時", "必要に応じて", "可能な限り", "なるべく", "極力",
    "速やかに", "すみやかに", "原則", "基本的に", "柔軟に", "臨機応変", "等々",
    "その他", "など", "等", "だいたい", "おおむね", "概ね", "ある程度",
    "十分に", "十分な", "適切な", "適度な", "しっかり", "きちんと", "うまく",
  ],
  // 未確定・仮置き語
  tbdWords: ["TBD", "TODO", "未定", "検討中", "後日", "別途検討", "要検討", "???", "×××"],
  // 検証不能な意図表現（検証可能性）
  intentWords: ["目指す", "努める", "配慮する", "意識する", "考慮する", "望ましい", "推奨する"],
  // 網羅性チェック用カテゴリ（深層性）
  depthCategories: [
    { key: "前提条件", words: ["前提", "事前条件", "前提条件"] },
    { key: "制約", words: ["制約", "制限事項", "制限"] },
    { key: "例外・異常系", words: ["例外", "異常系", "エラー", "失敗時", "異常時"] },
    { key: "非機能", words: ["性能", "パフォーマンス", "可用性", "セキュリティ", "応答時間", "スループット", "同時接続"] },
    { key: "受入基準", words: ["受入基準", "受け入れ基準", "完了条件", "合格基準", "検収"] },
  ],
  // 信頼性キーワード
  reliabilityMarkers: ["参照", "準拠", "根拠", "出典", "規格", "標準", "ISO", "IEC", "JIS", "ガイドライン"],
});

const DICT_STORE = "spec-inspector.dict.v1";
function loadDictOverrides() {
  try {
    if (typeof localStorage === "undefined") return {};
    return JSON.parse(localStorage.getItem(DICT_STORE) || "{}");
  } catch { return {}; }
}
// 有効な辞書（既定＋上書き）。セクション単位で上書きする。
export function getDict() {
  const o = loadDictOverrides();
  const out = {};
  for (const k of Object.keys(DEFAULT_DICT)) out[k] = k in o ? o[k] : DEFAULT_DICT[k];
  return out;
}
export function setDict(section, value) {
  if (!(section in DEFAULT_DICT)) throw new Error(`未知の辞書セクション: ${section}`);
  if (typeof localStorage === "undefined") return;
  const o = { ...loadDictOverrides(), [section]: value };
  localStorage.setItem(DICT_STORE, JSON.stringify(o));
}
export function resetDict(section) {
  if (typeof localStorage === "undefined") return;
  if (!section) { localStorage.removeItem(DICT_STORE); return; }
  const o = { ...loadDictOverrides() }; delete o[section];
  localStorage.setItem(DICT_STORE, JSON.stringify(o));
}
export function isDictCustomized() {
  return Object.keys(loadDictOverrides()).length > 0;
}

// トレーサビリティID（信頼性・トレーサビリティ）
export const ID_PATTERN = /\b((?:REQ|FR|NFR|UC|SC|BR|TC|TR|DS|FS)[-_]?\d{1,4})\b/g;

// ---- ユーティリティ ------------------------------------------------------

function splitLines(text) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

// 日本語の文分割（。！？ で区切る。簡易）
function splitSentences(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[。．！？!?])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countMatches(text, words) {
  let n = 0;
  const hits = [];
  for (const w of words) {
    let idx = 0;
    while ((idx = text.indexOf(w, idx)) !== -1) {
      hits.push({ word: w, index: idx });
      idx += w.length;
      n++;
    }
  }
  return { n, hits };
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function snippet(line, max = 60) {
  const t = line.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function mkFinding(viewpoint, severity, message, evidence, location, suggestion, expectedEffect) {
  return Object.freeze({ viewpoint, severity, message, evidence, location, suggestion, expectedEffect });
}

// スコア: 100 - Σ(weight)/normalizer。normalizerは文書規模でスケール。
function scoreFrom(findings, sizeUnits) {
  const raw = findings.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] || 0), 0);
  const norm = Math.max(1, sizeUnits); // 文数などで正規化
  const penalty = (raw / norm) * 22; // 密度ベースの減点係数
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

// ---- 観点別ルール --------------------------------------------------------

function checkAccuracy(text, lines, sentences) {
  const f = [];
  const dict = getDict();
  // 曖昧語
  const vague = countMatches(text, dict.vagueWords);
  for (const h of vague.hits) {
    const ln = lineOf(text, h.index);
    f.push(mkFinding("accuracy", "High", `曖昧語「${h.word}」により実装者ごとに解釈が分かれる`,
      snippet(lines[ln - 1] || h.word), ln,
      `「${h.word}」を具体的な条件・数値・手順に置き換える`, "手戻り・仕様解釈違いの防止"));
  }
  // 未確定語
  const tbd = countMatches(text, dict.tbdWords);
  for (const h of tbd.hits) {
    const ln = lineOf(text, h.index);
    f.push(mkFinding("accuracy", "Critical", `未確定記述「${h.word}」が残存`,
      snippet(lines[ln - 1] || h.word), ln,
      `確定内容を記載するか、未確定事項一覧へ移し担当・期限を明記`, "抜け漏れ・仕様未確定リスクの解消"));
  }
  // 弱い義務語（〜する場合がある 等の任意/義務の混在）
  sentences.forEach((s) => {
    if (/(場合がある|こともある|想定される)/.test(s) && /(必須|必ず|しなければ)/.test(text)) {
      const ln = lineOf(text, text.indexOf(s));
      f.push(mkFinding("accuracy", "Medium", "義務(必須)と任意(場合がある)が混在し要否が不明瞭",
        snippet(s), ln, "MUST/SHOULD/MAY を明確に区別して記述", "要件の要否判定の明確化"));
    }
  });
  return f;
}

function checkClarity(text, lines, sentences) {
  const f = [];
  sentences.forEach((s) => {
    const ln = lineOf(text, Math.max(0, text.indexOf(s.slice(0, 12))));
    // 長文
    if (s.length > 90) {
      f.push(mkFinding("clarity", "Medium", `一文が長い（${s.length}文字）ため読解負荷が高い`,
        snippet(s), ln, "一文一義に分割し、80文字以内を目安にする", "読み違い・レビュー見落としの低減"));
    }
    // 読点過多
    const commas = (s.match(/[、]/g) || []).length;
    if (commas >= 5) {
      f.push(mkFinding("clarity", "Low", `読点が多く（${commas}個）文構造が把握しづらい`,
        snippet(s), ln, "節ごとに文を分割する", "文構造の明確化"));
    }
    // 二重否定
    if (/(ない|なく)[^。]{0,10}(ない|ず|ません)/.test(s)) {
      f.push(mkFinding("clarity", "Medium", "二重否定で意味が取りづらい",
        snippet(s), ln, "肯定文に言い換える", "誤読の防止"));
    }
    // 指示語過多
    const kosoado = (s.match(/(これ|それ|あれ|この|その|あの|こちら|そちら)/g) || []).length;
    if (kosoado >= 3) {
      f.push(mkFinding("clarity", "Low", "指示語が多く対象が曖昧",
        snippet(s), ln, "指示語を具体的な名詞に置き換える", "参照先の明確化"));
    }
  });
  return f;
}

function checkVisual(text, lines) {
  const f = [];
  const headings = lines.filter((l) => /^#{1,6}\s/.test(l) || /^第?\s*\d+[.．章節]/.test(l));
  if (headings.length === 0 && lines.length > 15) {
    f.push(mkFinding("visual", "High", "見出しが無く全体構造を把握しづらい",
      snippet(lines[0] || ""), 1, "章・節の見出しを付与し階層化する", "レビュー効率・参照性の向上"));
  }
  // 見出し階層の飛び（# の次に ### など）
  let prevLevel = 0;
  lines.forEach((l, i) => {
    const m = l.match(/^(#{1,6})\s/);
    if (m) {
      const lvl = m[1].length;
      if (prevLevel && lvl - prevLevel >= 2) {
        f.push(mkFinding("visual", "Low", `見出し階層が飛んでいる（H${prevLevel}→H${lvl}）`,
          snippet(l), i + 1, "見出しレベルを1段ずつ下げる", "文書構造の一貫性"));
      }
      prevLevel = lvl;
    }
  });
  // 長大段落（改行なしの塊）
  const paragraphs = text.split(/\n\s*\n/);
  paragraphs.forEach((p) => {
    if (p.replace(/\s/g, "").length > 400 && !/[-*・]|\d[.)]/.test(p)) {
      const ln = lineOf(text, text.indexOf(p));
      f.push(mkFinding("visual", "Medium", "長大な段落で箇条書き・改行が不足",
        snippet(p), ln, "要素を箇条書き・表に分解する", "視認性・網羅確認のしやすさ向上"));
    }
  });
  return f;
}

function checkDepth(text, lines) {
  const f = [];
  for (const cat of getDict().depthCategories) {
    const { n } = countMatches(text, cat.words);
    if (n === 0) {
      f.push(mkFinding("depth", "High", `「${cat.key}」に関する記述が見当たらない`,
        "（該当記述なし）", 0,
        `${cat.key}（例: ${cat.words.slice(0, 3).join("・")}）を追記する`,
        "抜け漏れ・下流工程での考慮漏れの防止"));
    }
  }
  // 受入基準の数値目標（深さ）
  if (!/[0-9０-９]+\s*(秒|ms|件|%|％|人|回|MB|GB)/.test(text)) {
    f.push(mkFinding("depth", "Medium", "定量的な目標値（性能・容量等）が示されていない",
      "（定量記述なし）", 0, "測定可能な数値目標を追記する", "検証可能な深さの担保"));
  }
  return f;
}

function checkReliability(text, lines) {
  const f = [];
  const { n: relN } = countMatches(text, getDict().reliabilityMarkers);
  if (relN === 0) {
    f.push(mkFinding("reliability", "Medium", "根拠・出典・準拠規格への参照が無い",
      "（根拠記述なし）", 0, "参照元・準拠規格・関連文書を明記する", "記述の裏付け・追跡性の確保"));
  }
  // トレーサビリティID
  const ids = text.match(ID_PATTERN);
  if (!ids) {
    f.push(mkFinding("reliability", "High", "要件・項目の識別子（REQ-/FR- 等）が無く追跡できない",
      "（ID記述なし）", 0, "各要件にトレーサビリティIDを付番する", "要件↔設計↔テストの追跡性確保"));
  }
  // 版管理・承認
  if (!/(改訂|更新履歴|版数|version|Ver\.?|承認|レビュー者)/i.test(text)) {
    f.push(mkFinding("reliability", "Low", "版管理・承認情報が見当たらない",
      "（版/承認記述なし）", 0, "更新履歴・承認欄を設ける", "変更管理・責任の明確化"));
  }
  return f;
}

function checkVerifiability(text, lines, sentences) {
  const f = [];
  // 検証不能な意図表現
  const intent = countMatches(text, getDict().intentWords);
  for (const h of intent.hits) {
    const ln = lineOf(text, h.index);
    f.push(mkFinding("verifiability", "High", `「${h.word}」は検証（合否判定）できない意図表現`,
      snippet(lines[ln - 1] || h.word), ln,
      `「〜できること」等の観測可能・測定可能な受入条件に書き換える`, "テスト可能な要件化"));
  }
  // 期待結果の明示（〜できること 型がゼロ）
  if (!/(できること|表示されること|出力されること|保存されること|返却されること)/.test(text)) {
    f.push(mkFinding("verifiability", "Medium", "検証可能な期待結果（〜できること）の記述が乏しい",
      "（期待結果記述なし）", 0, "各機能に観測可能な期待結果を付す", "テストケース化の容易性向上"));
  }
  return f;
}

// ---- 公開API -------------------------------------------------------------

// 単一ドキュメントを解析して {scores, findings, meta} を返す
export function analyzeDocument(text, name = "document") {
  const src = String(text || "");
  const lines = splitLines(src);
  const sentences = splitSentences(src);
  const sizeUnits = Math.max(sentences.length, lines.filter((l) => l.trim()).length);

  const findings = [
    ...checkAccuracy(src, lines, sentences),
    ...checkClarity(src, lines, sentences),
    ...checkVisual(src, lines),
    ...checkDepth(src, lines),
    ...checkReliability(src, lines),
    ...checkVerifiability(src, lines, sentences),
  ];

  const scores = {};
  for (const v of VIEWPOINTS) {
    const vf = findings.filter((x) => x.viewpoint === v.key);
    scores[v.key] = scoreFrom(vf, sizeUnits);
  }
  const overall = Math.round(
    VIEWPOINTS.reduce((s, v) => s + scores[v.key], 0) / VIEWPOINTS.length
  );

  // severity順・観点順にソート
  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity] || a.location - b.location);

  return {
    name,
    scores,
    overall,
    findings: sorted,
    counts: SEVERITY.reduce((o, s) => ((o[s] = findings.filter((x) => x.severity === s).length), o), {}),
    meta: { chars: src.replace(/\s/g, "").length, lines: lines.length, sentences: sentences.length },
  };
}
