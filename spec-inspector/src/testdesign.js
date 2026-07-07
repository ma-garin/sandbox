// testdesign.js — テスト設計レディネス（テスト技法の適用候補検出＋ドラフト生成）
//
// ベリサーブGIHOZの思想（仕様→テスト技法）を仕様書レビュー段階に前倒しする。
// 仕様文から次の技法適用候補を検出し、テストの下書き骨子を生成する:
//   - デシジョンテーブル: 条件の組み合わせ（かつ/または＋場合/とき）
//   - 境界値分析: 数値＋比較語（以上/以下/未満/超/以内/上限/下限）
//   - 状態遷移テスト: 状態語彙（状態/遷移/ステータス）＋状態名（〜中/〜済み/〜待ち/〜完了）
//
// すべて純粋関数。候補は evidence（原文引用）と location（行番号）を必ず持つ。

import { NUM_UNIT } from "./consistency.js";

const CONNECTIVES = ["かつ", "または", "および", "又は", "ないし"];
const CONDITION_MARKERS = ["場合", "とき", "もし", "ならば", "なら"];
const COMPARATORS = ["以上", "以下", "未満", "超", "以内", "上限", "下限", "まで"];
const STATE_VOCAB = ["状態", "遷移", "ステータス", "ステート"];
const STATE_SUFFIX = "(?:中|済み?|待ち|完了|失敗|成功|中止|保留|受付|承認|却下|開始|終了)";

function toHalf(s) {
  return String(s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}
function countOccurrences(text, words) {
  return words.reduce((n, w) => n + text.split(w).length - 1, 0);
}
// 文分割（。！？改行で区切る）。indexも保持する。
function sentencesWithIndex(text) {
  const out = [];
  const re = /[^。．！？!?\n]*[。．！？!?\n]?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].trim()) out.push({ text: m[0], index: m.index });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

// ---- デシジョンテーブル候補 ----------------------------------------------
function extractConditions(block) {
  // 接続詞・読点で分割し、各節から末尾の条件マーカーを除去して条件ラベル化
  const raw = block.split(/かつ|または|および|又は|ないし|、/).map((s) => s.trim()).filter(Boolean);
  const conds = [];
  for (let seg of raw) {
    seg = seg
      .replace(/(の)?(場合|とき|ならば|なら|には|は)[はにをがも、。]?.*$/, "")
      .replace(/^(もし|それ以外の|その他の)/, "")
      .replace(/[。、\s]/g, "")
      .trim();
    if (seg.length >= 2 && seg.length <= 30 && !conds.includes(seg)) conds.push(seg);
  }
  return conds.slice(0, 4);
}

export function detectDecisionTableCandidates(text) {
  const src = String(text ?? "");
  const out = [];
  for (const s of sentencesWithIndex(src)) {
    const connectives = countOccurrences(s.text, CONNECTIVES);
    const markers = countOccurrences(s.text, CONDITION_MARKERS);
    // 接続詞1以上 かつ 条件語（接続詞＋条件マーカー）2以上
    if (connectives >= 1 && connectives + markers >= 2) {
      const conditions = extractConditions(s.text);
      if (conditions.length >= 1) {
        out.push(Object.freeze({
          type: "decision-table",
          location: lineOf(src, s.index),
          evidence: s.text.trim().slice(0, 80),
          conditions,
        }));
      }
    }
  }
  return out;
}

// ---- 境界値候補 ----------------------------------------------------------
export function detectBoundaryCandidates(text) {
  const src = String(text ?? "");
  const out = [];
  const re = new RegExp(NUM_UNIT.source, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    // 数値の前後20字以内に比較語があるか
    const around = src.slice(Math.max(0, m.index - 4), m.index + m[0].length + 8);
    const comparator = COMPARATORS.find((c) => around.includes(c));
    if (comparator) {
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const lineEnd = src.indexOf("\n", m.index);
      const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      out.push(Object.freeze({
        type: "boundary",
        location: lineOf(src, m.index),
        evidence: line.slice(0, 80),
        value: toHalf(m[1]),
        unit: m[2],
        comparator,
      }));
    }
  }
  return out;
}

// ---- 状態遷移候補 --------------------------------------------------------
export function detectStateCandidates(text) {
  const src = String(text ?? "");
  const out = [];
  const stateRe = new RegExp(`([一-龠ぁ-んァ-ヶー]{1,8}?${STATE_SUFFIX})`, "g");
  for (const s of sentencesWithIndex(src)) {
    const hasVocab = STATE_VOCAB.some((v) => s.text.includes(v));
    const states = [...new Set([...s.text.matchAll(stateRe)].map((x) => x[1]))]
      .filter((w) => w.length >= 2);
    // 状態語彙があり かつ 状態名が2件以上（または語彙＋明示的な遷移記述）
    if (hasVocab && states.length >= 2) {
      out.push(Object.freeze({
        type: "state",
        location: lineOf(src, s.index),
        evidence: s.text.trim().slice(0, 80),
        states: states.slice(0, 8),
      }));
    }
  }
  return out;
}

// ---- ドラフト生成 --------------------------------------------------------
export function decisionTableDraft(cand) {
  const conds = cand.conditions.slice(0, 4);
  const n = conds.length;
  const cols = 1 << n; // 2^n 通り
  const header = `| 条件＼ケース | ${Array.from({ length: cols }, (_, i) => `C${i + 1}`).join(" | ")} |`;
  const sep = `| --- | ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
  const rows = conds.map((c, ci) => {
    const cells = Array.from({ length: cols }, (_, i) => ((i >> (n - 1 - ci)) & 1) ? "N" : "Y");
    return `| ${c} | ${cells.join(" | ")} |`;
  });
  const result = `| **期待結果** | ${Array.from({ length: cols }, () => "?").join(" | ")} |`;
  const note = cand.conditions.length > 4 ? `\n\n> 注: 条件が4件を超えるため先頭4件で作成。ペアワイズ等で組合せ削減を検討。` : "";
  return [`### デシジョンテーブル下書き`, "", header, sep, ...rows, result, note].join("\n");
}

export function boundaryDraft(cand) {
  const v = Number(cand.value);
  const u = cand.unit;
  const c = cand.comparator;
  let rows;
  if (["以上", "超", "下限", "まで"].includes(c)) {
    const b = c === "超" ? v + 1 : v; // 「超」は境界が v+1
    rows = [
      [`${b - 1}${u}`, "境界の直下（無効側）"],
      [`${b}${u}`, "境界値（有効/無効の境目）"],
      [`${b + 1}${u}`, "境界の直上（有効側）"],
    ];
  } else {
    const b = c === "未満" ? v - 1 : v; // 「未満」は境界が v-1
    rows = [
      [`${b - 1}${u}`, "境界の直下（有効側）"],
      [`${b}${u}`, "境界値（有効/無効の境目）"],
      [`${b + 1}${u}`, "境界の直上（無効側）"],
    ];
  }
  const body = rows.map((r) => `| ${r[0]} | ${r[1]} | ? |`).join("\n");
  return [
    `### 境界値分析下書き（${cand.value}${u} ${c}）`, "",
    `| テスト値 | 区分 | 期待結果 |`, `| --- | --- | --- |`, body,
  ].join("\n");
}

export function stateDraft(cand) {
  const states = cand.states.slice(0, 8);
  const header = `| 現状態＼次状態 | ${states.join(" | ")} |`;
  const sep = `| --- | ${states.map(() => "---").join(" | ")} |`;
  const rows = states.map((s) => `| ${s} | ${states.map(() => "-").join(" | ")} |`);
  return [
    `### 状態遷移テスト下書き`, "",
    `対象状態: ${states.join(" / ")}`, "",
    `遷移表（セルに遷移条件/イベントを記入、遷移不可は「×」）:`, "",
    header, sep, ...rows,
  ].join("\n");
}

function draftFor(cand) {
  if (cand.type === "decision-table") return decisionTableDraft(cand);
  if (cand.type === "boundary") return boundaryDraft(cand);
  if (cand.type === "state") return stateDraft(cand);
  return "";
}

// ---- 公開API -------------------------------------------------------------
// docs: [{name, text}] → {candidates:[{...cand, doc, draft}], counts}
export function analyzeTestDesignReadiness(docs) {
  const candidates = [];
  for (const d of docs || []) {
    const text = String(d.text ?? "");
    const found = [
      ...detectDecisionTableCandidates(text),
      ...detectBoundaryCandidates(text),
      ...detectStateCandidates(text),
    ];
    for (const c of found) {
      candidates.push(Object.freeze({ ...c, doc: d.name, draft: draftFor(c) }));
    }
  }
  const counts = {
    decisionTable: candidates.filter((c) => c.type === "decision-table").length,
    boundary: candidates.filter((c) => c.type === "boundary").length,
    state: candidates.filter((c) => c.type === "state").length,
  };
  return Object.freeze({ candidates, counts });
}
