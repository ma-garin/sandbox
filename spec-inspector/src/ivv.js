// ivv.js — IV&V（Independent Verification & Validation）第三者検証チェックリスト
//
// ベリサーブの独立検証（IV&V）観点を、IEEE 1012（V&V）と ISO/IEC/IEEE 29119（テスト）を
// 参考にチェックリスト化する。自動判定できる項目はルール解析結果（trace/consistency/findings）
// を再利用して ok/ng を判定し、判定できない項目は手動確認（manual）とする。
//
// evidence-only: ng判定には必ず根拠（不足内容）を付す。

// ヘルパ（auto関数から利用）
const allText = (docs) => (docs || []).map((d) => String(d.text ?? "")).join("\n");
const hasAny = (text, words) => words.some((w) => text.includes(w));
const ok = (evidence) => ({ status: "ok", evidence });
const ng = (evidence) => ({ status: "ng", evidence });

// チェックリスト定義。auto=null は手動確認項目。
export const IVV_CHECKLIST = [
  // --- 要求 ---
  {
    id: "IVV-01", area: "要求", label: "各要求に一意な識別子が付与されている", ref: "IEEE 1012",
    auto: (docs, r) => (r.trace?.ids?.length ? ok(`識別子 ${r.trace.ids.length} 件を検出`) : ng("要求識別子（REQ-/FR- 等）が見当たらない")),
  },
  {
    id: "IVV-02", area: "要求", label: "要求間に矛盾・不整合がない", ref: "ISO/IEC/IEEE 29148",
    auto: (docs, r) => {
      const conflicts = (r.consistency || []).filter((c) => c.type === "metric-mismatch" || c.type === "polarity-conflict");
      return conflicts.length ? ng(`文書間の矛盾 ${conflicts.length} 件: ${conflicts[0].message}`) : ok("文書間の数値不一致・相反断定は検出されず");
    },
  },
  {
    id: "IVV-03", area: "要求", label: "各要求が検証可能（測定可能な受入基準）", ref: "IEEE 1012",
    auto: (docs) => (hasAny(allText(docs), ["受入基準", "受け入れ基準", "合格基準", "完了条件"]) ? ok("受入基準の記述あり") : ng("受入基準・合格基準の記述が見当たらない")),
  },
  {
    id: "IVV-04", area: "要求", label: "曖昧・多義的な表現が排除されている", ref: "ISO/IEC/IEEE 29148",
    auto: (docs, r) => {
      const vague = (r.findings || []).filter((f) => f.viewpoint === "accuracy" && /曖昧/.test(f.message));
      return vague.length ? ng(`曖昧表現 ${vague.length} 件: ${vague[0].evidence}`) : ok("曖昧表現の指摘なし");
    },
  },
  {
    id: "IVV-05", area: "要求", label: "前提条件・制約が明記されている", ref: "IEEE 1012",
    auto: (docs) => (hasAny(allText(docs), ["前提", "制約", "制限事項"]) ? ok("前提・制約の記述あり") : ng("前提条件・制約の記述が見当たらない")),
  },
  {
    id: "IVV-06", area: "要求", label: "ステークホルダ要求を網羅している", ref: "IEEE 1012", auto: null,
  },
  // --- 設計 ---
  {
    id: "IVV-07", area: "設計", label: "要求から設計へのトレーサビリティが確保されている", ref: "IEEE 1012",
    auto: (docs, r) => {
      const gaps = (r.trace?.rows || []).filter((row) => row.gaps.includes("設計欠落"));
      return gaps.length ? ng(`設計に未反映の要求 ${gaps.length} 件: ${gaps.map((g) => g.id).slice(0, 3).join("・")}`) : ok("要求→設計のトレース断絶なし");
    },
  },
  {
    id: "IVV-08", area: "設計", label: "非機能要件（性能・セキュリティ等）が考慮されている", ref: "ISO/IEC 25010",
    auto: (docs) => (hasAny(allText(docs), ["性能", "パフォーマンス", "セキュリティ", "可用性", "応答時間"]) ? ok("非機能の記述あり") : ng("非機能要件の記述が見当たらない")),
  },
  {
    id: "IVV-09", area: "設計", label: "設計判断の根拠・代替案検討が示されている", ref: "IEEE 1012", auto: null,
  },
  {
    id: "IVV-10", area: "設計", label: "異常系・例外設計が定義されている", ref: "ISO/IEC/IEEE 29119",
    auto: (docs) => (hasAny(allText(docs), ["例外", "異常系", "エラー", "失敗時"]) ? ok("異常系の記述あり") : ng("例外・異常系の記述が見当たらない")),
  },
  // --- テスト ---
  {
    id: "IVV-11", area: "テスト", label: "要求から試験へのトレーサビリティが確保されている", ref: "ISO/IEC/IEEE 29119",
    auto: (docs, r) => {
      const gaps = (r.trace?.rows || []).filter((row) => row.gaps.includes("テスト欠落"));
      return gaps.length ? ng(`テスト未整備の要求 ${gaps.length} 件: ${gaps.map((g) => g.id).slice(0, 3).join("・")}`) : ok("要求→テストのトレース断絶なし");
    },
  },
  {
    id: "IVV-12", area: "テスト", label: "テスト設計技法が適用されている", ref: "ISO/IEC/IEEE 29119",
    auto: (docs) => (hasAny(allText(docs), ["境界値", "同値", "デシジョンテーブル", "決定表", "状態遷移", "ペアワイズ", "網羅"]) ? ok("テスト技法の記述あり") : ng("テスト設計技法の明示が見当たらない")),
  },
  {
    id: "IVV-13", area: "テスト", label: "テストの期待結果が定義されている", ref: "ISO/IEC/IEEE 29119",
    auto: (docs) => {
      const testDocs = (docs || []).filter((d) => d.role === "test");
      if (!testDocs.length) return ng("テスト文書が投入されていない");
      const t = testDocs.map((d) => d.text).join("\n");
      return hasAny(t, ["こと", "期待結果", "期待値", "表示される", "返却される"]) ? ok("期待結果の記述あり") : ng("期待結果の記述が見当たらない");
    },
  },
  {
    id: "IVV-14", area: "テスト", label: "テストカバレッジ基準が定義されている", ref: "ISO/IEC/IEEE 29119", auto: null,
  },
  // --- 管理 ---
  {
    id: "IVV-15", area: "管理", label: "文書の版管理・承認体制が明記されている", ref: "IEEE 1012",
    auto: (docs) => (/(改訂|更新履歴|版数|version|Ver\.?|承認|レビュー者)/i.test(allText(docs)) ? ok("版管理・承認の記述あり") : ng("版管理・承認の記述が見当たらない")),
  },
  {
    id: "IVV-16", area: "管理", label: "用語定義（用語集）が整備されている", ref: "ISO/IEC/IEEE 29148",
    auto: (docs) => (hasAny(allText(docs), ["用語集", "用語定義", "定義: ", "定義:", "用語の定義"]) ? ok("用語定義の記述あり") : ng("用語集・用語定義の記述が見当たらない")),
  },
  {
    id: "IVV-17", area: "管理", label: "検証が開発から独立して実施される体制", ref: "IEEE 1012", auto: null,
  },
];

// ---- チェックリストのメタ上書き（管理タブから label/ref/area/enabled を編集・追加） ----
const IVV_STORE = "spec-inspector.ivvmeta.v1";
// 既定メタ（自動判定ロジックはコード側でidに紐付くため、編集できるのは表示用メタのみ）
export const DEFAULT_IVV_META = IVV_CHECKLIST.map((i) =>
  Object.freeze({ id: i.id, area: i.area, label: i.label, ref: i.ref, enabled: true }));

function loadIvvOverrides() {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = JSON.parse(localStorage.getItem(IVV_STORE) || "null");
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}
// 有効なメタ一覧（上書きがあればそれ、なければ既定）
export function getIvvMeta() {
  return loadIvvOverrides() || DEFAULT_IVV_META.map((m) => ({ ...m }));
}
export function setIvvMeta(list) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(IVV_STORE, JSON.stringify(list));
}
export function resetIvvMeta() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(IVV_STORE);
}
export function isIvvCustomized() {
  return loadIvvOverrides() !== null;
}

// docs: [{name,text,role}], ruleResults: {trace, consistency, findings, scores}
// → { items:[{...item, status:"ok"|"ng"|"manual", evidence?}], counts }
export function runIVV(docs, ruleResults = {}) {
  const meta = getIvvMeta();
  const autoById = new Map(IVV_CHECKLIST.map((i) => [i.id, i.auto]));
  const items = meta
    .filter((m) => m.enabled !== false)
    .map((m) => {
      const auto = autoById.get(m.id); // ユーザー追加項目(idが既定に無い)は手動扱い
      if (typeof auto !== "function") {
        return Object.freeze({ id: m.id, area: m.area, label: m.label, ref: m.ref, status: "manual" });
      }
      let res;
      try {
        res = auto(docs, ruleResults) || ng("判定不能");
      } catch {
        res = ng("判定処理でエラー");
      }
      const out = { id: m.id, area: m.area, label: m.label, ref: m.ref, status: res.status };
      if (res.evidence) out.evidence = res.evidence;
      return Object.freeze(out);
  });
  const counts = {
    ok: items.filter((i) => i.status === "ok").length,
    ng: items.filter((i) => i.status === "ng").length,
    manual: items.filter((i) => i.status === "manual").length,
  };
  return Object.freeze({ items, counts });
}
