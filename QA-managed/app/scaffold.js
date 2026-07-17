/**
 * scaffold.js — テスト観点表 → 実行レイヤの雛形生成
 *
 * QA Wolf型の「実行」につなぐため、生成した観点から Playwright(TS)/pytest の
 * スケルトンを出力する。観点＝「何をテストすべきか」を、そのままテストコードの
 * TODOスタブに落とし込み、上流（観点設計）と実行の橋渡しをする。
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.SCAFFOLD = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function safeIdent(s) {
    // 関数名/ファイル名向けに英数字化。日本語は t_連番 で表現。
    return String(s || "").replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "") || "case";
  }

  // Playwright(TypeScript)雛形。各観点を test.skip の TODO として並べる。
  function toPlaywright(feature, rows) {
    const title = feature || "対象機能";
    const lines = [];
    lines.push('import { test, expect } from "@playwright/test";');
    lines.push("");
    lines.push("// 自動生成: QA-managed 観点設計エンジン");
    lines.push("// 各 test は観点から生成した TODO スタブ。実装して有効化する。");
    lines.push('test.describe(' + JSON.stringify(title) + ', () => {');
    rows.forEach((r) => {
      lines.push("  // [" + r.cat_name + "] 技法: " + r.technique +
        (r.authority ? " / 根拠: " + r.authority : ""));
      lines.push("  test.skip(" + JSON.stringify(r.id + " " + r.viewpoint) + ", async ({ page }) => {");
      lines.push("    // 対象: " + r.target);
      lines.push("    // 期待結果: " + r.expected);
      lines.push("    // TODO: 前提条件の準備・操作・アサーションを実装");
      lines.push("    expect(true).toBe(true);");
      lines.push("  });");
      lines.push("");
    });
    lines.push("});");
    return lines.join("\n");
  }

  // pytest 雛形。各観点を pytest.mark.skip の TODO 関数として並べる。
  function toPytest(feature, rows) {
    const title = feature || "対象機能";
    const lines = [];
    lines.push('"""自動生成: QA-managed 観点設計エンジン');
    lines.push("対象機能: " + title);
    lines.push("各テストは観点から生成した TODO スタブ。実装して skip を外す。");
    lines.push('"""');
    lines.push("import pytest");
    lines.push("");
    let n = 0;
    rows.forEach((r) => {
      n += 1;
      const fn = "test_" + String(n).padStart(3, "0") + "_" + safeIdent(r.cat);
      lines.push("# [" + r.cat_name + "] " + r.viewpoint + " / 技法: " + r.technique +
        (r.authority ? " / 根拠: " + r.authority : ""));
      lines.push('@pytest.mark.skip(reason="TODO: 未実装")');
      lines.push("def " + fn + "():");
      lines.push('    """' + r.id + " " + r.viewpoint);
      lines.push("    対象: " + r.target);
      lines.push("    期待結果: " + r.expected);
      lines.push('    """');
      lines.push("    assert True  # TODO: 実装");
      lines.push("");
    });
    return lines.join("\n");
  }

  return { toPlaywright, toPytest, safeIdent };
});
