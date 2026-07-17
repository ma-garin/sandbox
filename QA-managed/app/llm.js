/**
 * llm.js — 任意のLLM補完レイヤ（Anthropic API / claude-opus-4-8）
 *
 * ルールベースで生成した観点を、具体的なテストケース（前提・手順・データ・期待結果）へ
 * AIが展開する。APIキーは localStorage 保存（ハードコード禁止・sandbox規約）。
 * キー未設定・失敗時は例外を投げ、UI側は決定的な観点表にフォールバックする。
 *
 * ブラウザから直接 Anthropic API を呼ぶため anthropic-dangerous-direct-browser-access を付与。
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.LLM = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KEY_STORAGE = "qa_managed_anthropic_key";
  const MODEL = "claude-opus-4-8";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  function getKey() {
    try { return (localStorage.getItem(KEY_STORAGE) || "").trim(); } catch (e) { return ""; }
  }
  function setKey(k) {
    try { localStorage.setItem(KEY_STORAGE, (k || "").trim()); } catch (e) {}
  }
  function clearKey() {
    try { localStorage.removeItem(KEY_STORAGE); } catch (e) {}
  }
  function hasKey() { return getKey().length > 0; }

  // 生成された観点表を、具体的テストケースへ展開する。
  // rows: engine.generate() の rows。返り値: [{id, title, precondition, steps[], data, expected}]
  async function expandToTestCases(feature, rows) {
    const key = getKey();
    if (!key) throw new Error("APIキーが未設定です");

    // トークン節約のため観点は必要項目のみ渡す
    const compact = rows.map((r) => ({
      id: r.id, target: r.target, viewpoint: r.viewpoint,
      technique: r.technique, expected: r.expected,
    }));

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        cases: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              precondition: { type: "string" },
              steps: { type: "array", items: { type: "string" } },
              data: { type: "string" },
              expected: { type: "string" },
            },
            required: ["id", "title", "precondition", "steps", "data", "expected"],
          },
        },
      },
      required: ["cases"],
    };

    const prompt =
      "あなたはベリサーブのQAエンジニアです。以下の機能とテスト観点から、" +
      "具体的なテストケース（前提条件・手順・テストデータ・期待結果）をISTQB準拠で日本語で作成してください。" +
      "各観点の id を必ず引き継ぎ、憶測で仕様を追加せず観点の範囲で具体化してください。\n\n" +
      "機能: " + (feature || "対象機能") + "\n" +
      "観点(JSON): " + JSON.stringify(compact);

    const body = {
      model: MODEL,
      max_tokens: 8000,
      output_config: { format: { type: "json_schema", schema: schema } },
      messages: [{ role: "user", content: prompt }],
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error.message; } catch (e) {}
      throw new Error("APIエラー(" + res.status + ")" + (detail ? ": " + detail : ""));
    }

    const json = await res.json();
    const textBlock = (json.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("応答にテキストが含まれません");
    const parsed = JSON.parse(textBlock.text);
    return parsed.cases || [];
  }

  return { getKey, setKey, clearKey, hasKey, expandToTestCases, MODEL };
});
