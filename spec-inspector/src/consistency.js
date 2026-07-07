// consistency.js — 複数ドキュメント間の不一致・矛盾検知
//
// 検出対象:
// 1. 用語×数値の不一致: 同じ用語の近傍で異なる数値（例: 応答時間 3秒 vs 5秒）
// 2. 定義の非対称: 文書Aで定義された識別子/用語が文書Bで未使用/未定義
// 3. 相反する断定: 同一対象に「必須」と「不要/対象外」が併存
//
// evidence-only: すべての指摘に該当文書名・引用・行番号を付す。

import { ID_PATTERN } from "./engine.js";

// 数値＋単位。testdesign.js（境界値候補検出）でも再利用するためexportする。
export const NUM_UNIT = /([0-9０-９]+(?:\.[0-9０-９]+)?)\s*(秒|ms|ミリ秒|分|時間|件|%|％|人|回|MB|GB|KB|文字|桁)/g;

function toHalf(s) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 用語（数値の直前の名詞的キーワード）をざっくり抽出
const METRIC_KEYS = ["応答時間", "レスポンス", "処理時間", "同時接続", "同時アクセス", "件数", "上限", "最大", "最小",
  "保持期間", "保存期間", "パスワード", "文字数", "桁数", "タイムアウト", "リトライ", "再試行"];

function extractMetrics(text) {
  const out = [];
  let m;
  const re = new RegExp(NUM_UNIT.source, "g");
  while ((m = re.exec(text)) !== null) {
    const around = text.slice(Math.max(0, m.index - 20), m.index);
    const key = METRIC_KEYS.find((k) => around.includes(k));
    if (key) {
      out.push({ key, value: toHalf(m[1]), unit: m[2], raw: m[0], line: text.slice(0, m.index).split("\n").length });
    }
  }
  return out;
}

function extractIds(text) {
  const set = new Set();
  let m;
  const re = new RegExp(ID_PATTERN.source, "g");
  while ((m = re.exec(text)) !== null) set.add(m[1].toUpperCase().replace(/_/g, "-"));
  return set;
}

// docs: [{name, text}] → findings[]
export function detectInconsistencies(docs) {
  const findings = [];
  if (!Array.isArray(docs) || docs.length < 2) return findings;

  // 1. 数値メトリクスの不一致
  const metrics = docs.map((d) => ({ name: d.name, items: extractMetrics(d.text) }));
  const byKey = {};
  for (const doc of metrics) {
    for (const it of doc.items) {
      const k = `${it.key}|${it.unit}`;
      (byKey[k] ||= []).push({ ...it, doc: doc.name });
    }
  }
  for (const [k, list] of Object.entries(byKey)) {
    const distinct = [...new Set(list.map((x) => x.value))];
    if (distinct.length > 1) {
      const [key] = k.split("|");
      findings.push(Object.freeze({
        type: "metric-mismatch", severity: "Critical",
        message: `「${key}」の値が文書間で不一致（${list.map((x) => `${x.doc}:${x.raw}`).join(" / ")}）`,
        evidence: list.map((x) => `${x.doc} L${x.line}: ${x.raw}`).join("  |  "),
        docs: [...new Set(list.map((x) => x.doc))],
        suggestion: "正となる値を一つに定め、全文書を揃える（マスタ化）",
        expectedEffect: "実装・テストの前提齟齬による欠陥流出の防止",
      }));
    }
  }

  // 2. ID定義の非対称（あるIDが一部文書にしか出ない）
  const idsByDoc = docs.map((d) => ({ name: d.name, ids: extractIds(d.text) }));
  const allIds = new Set();
  idsByDoc.forEach((d) => d.ids.forEach((id) => allIds.add(id)));
  for (const id of allIds) {
    const present = idsByDoc.filter((d) => d.ids.has(id)).map((d) => d.name);
    const absent = idsByDoc.filter((d) => !d.ids.has(id)).map((d) => d.name);
    if (present.length >= 1 && absent.length >= 1 && idsByDoc.length >= 2) {
      // 全文書横断でトレース断絶している要件のみ（片方向）
      if (present.length < idsByDoc.length) {
        findings.push(Object.freeze({
          type: "trace-gap", severity: "High",
          message: `識別子「${id}」が一部文書にのみ存在（記載: ${present.join("・")} / 欠落: ${absent.join("・")}）`,
          evidence: `記載: ${present.join("・")} / 欠落: ${absent.join("・")}`,
          docs: present.concat(absent),
          suggestion: `欠落文書に${id}の対応記述（設計/テスト）を追加、または不要なら廃止理由を明記`,
          expectedEffect: "要件↔設計↔テストのトレース断絶の解消",
        }));
      }
    }
  }

  // 3. 相反する断定（同一キーワードに必須/対象外）
  const REQUIRE = /(必須|必ず|しなければならない)/;
  const EXCLUDE = /(対象外|不要|実装しない|サポートしない|対応しない)/;
  const topicRe = /「([^」]{2,20})」/g;
  const topicPolarity = {};
  for (const d of docs) {
    let m;
    const re = new RegExp(topicRe.source, "g");
    while ((m = re.exec(d.text)) !== null) {
      const topic = m[1];
      const ctx = d.text.slice(m.index, m.index + 40);
      const pol = REQUIRE.test(ctx) ? "require" : EXCLUDE.test(ctx) ? "exclude" : null;
      if (pol) {
        (topicPolarity[topic] ||= []).push({ doc: d.name, pol, line: d.text.slice(0, m.index).split("\n").length });
      }
    }
  }
  for (const [topic, list] of Object.entries(topicPolarity)) {
    const pols = new Set(list.map((x) => x.pol));
    if (pols.has("require") && pols.has("exclude")) {
      findings.push(Object.freeze({
        type: "polarity-conflict", severity: "Critical",
        message: `「${topic}」の要否が文書間で相反（必須と対象外が併存）`,
        evidence: list.map((x) => `${x.doc} L${x.line}: ${x.pol === "require" ? "必須" : "対象外"}`).join("  |  "),
        docs: [...new Set(list.map((x) => x.doc))],
        suggestion: "対象/対象外の判断を一本化し、両文書に反映",
        expectedEffect: "相反要求による実装/テスト矛盾の解消",
      }));
    }
  }

  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
