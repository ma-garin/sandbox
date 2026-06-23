"""ポータルのスモークテスト（回帰用）。

全サービス詳細・全ツールのGET、主要ツールのPOSTを検証する。
Django test client を使うのでサーバー起動は不要。

    python manage.py test
"""
import io
import unittest

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from catalog.models import Service
from knowledge.models import Viewpoint
from tools import engines, logic, maturity, nonfunc as nf, assessments
from tools.models import Defect

HX = {"HTTP_HX_REQUEST": "true"}  # HTMX リクエストを模す


class SmokeTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    # ── 基本画面 ──
    def test_home(self):
        r = self.client.get(reverse("home"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "品質ポータル")
        self.assertContains(r, "サービス")

    def test_home_has_all_categories(self):
        r = self.client.get(reverse("home"))
        for name in ["品質PMO", "第三者検証", "AIサービス", "セキュリティ"]:
            self.assertContains(r, name)

    def test_search(self):
        r = self.client.get(reverse("search"), {"q": "テスト"})
        self.assertEqual(r.status_code, 200)

    def test_search_by_product(self):
        r = self.client.get(reverse("search"), {"q": "GIHOZ"})
        self.assertContains(r, "テスト設計")

    # ── 全サービス詳細が200で開く ──
    def test_all_service_details(self):
        for s in Service.objects.all():
            r = self.client.get(reverse("service_detail", args=[s.slug]))
            self.assertEqual(r.status_code, 200, f"{s.slug} が200で開けない")
            self.assertContains(r, s.title)

    def test_breadcrumb_present(self):
        r = self.client.get(reverse("service_detail", args=["consultant"]))
        self.assertContains(r, "breadcrumb")
        self.assertContains(r, "品質PMO")

    def test_product_badge(self):
        r = self.client.get(reverse("service_detail", args=["vuln-web"]))
        self.assertContains(r, "Vex")

    # ── 各ツールのGET ──
    def test_tool_doc_verify(self):
        r = self.client.get(reverse("service_detail", args=["doc-verify"]))
        self.assertContains(r, "品質スコア")

    def test_tool_traceability(self):
        r = self.client.get(reverse("service_detail", args=["trace"]))
        self.assertContains(r, "要件カバレッジ")

    def test_tool_test_plan(self):
        r = self.client.get(reverse("service_detail", args=["plan-ai"]))
        self.assertContains(r, "ISO/IEC 29119")

    def test_tool_test_design_viewpoint(self):
        r = self.client.get(reverse("service_detail", args=["test-design"]))
        self.assertContains(r, "観点カバレッジ")

    def test_tool_roi(self):
        r = self.client.get(reverse("service_detail", args=["roi-calc"]))
        self.assertContains(r, "年間コスト削減額")
        self.assertContains(r, "85")  # 観点ライブラリ捕捉率

    def test_tool_viewpoint_kb(self):
        r = self.client.get(reverse("service_detail", args=["viewpoint-kb"]))
        self.assertContains(r, "観点総数")

    def test_tool_cicd(self):
        r = self.client.get(reverse("service_detail", args=["cicd"]))
        self.assertContains(r, "jobs:")

    def test_tool_test_auto(self):
        r = self.client.get(reverse("service_detail", args=["test-auto"]))
        self.assertContains(r, "playwright")

    def test_tool_defect_mgr(self):
        r = self.client.get(reverse("service_detail", args=["defect-mgr"]))
        self.assertEqual(r.status_code, 200)

    # ── 主要ツールのPOST（実際に計算が走る） ──
    def test_doc_verify_post(self):
        r = self.client.post(reverse("service_detail", args=["doc-verify"]),
                             {"text": "適宜TBD。", "doc_type": "general"})
        self.assertContains(r, "Major")

    def test_pairwise_post(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "pw", "pw_text": "A, 1, 2\nB, x, y"})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "PW-1")

    def test_bva_post(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "bva", "name": "年齢", "min": "18", "max": "65"})
        self.assertContains(r, "BVA-1")
        self.assertContains(r, "17")  # 下限-1

    def test_roi_post(self):
        r = self.client.post(reverse("service_detail", args=["roi-calc"]),
                             {"industry": "finance", "incidents": "10", "cost": "1000", "method": "5"})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "年間コスト削減額")

    def test_viewpoint_design_post(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "決済", "industry": "finance",
                              "field_name": "金額", "field_type": "number", "flags": "money"})
        self.assertContains(r, "観点カバレッジ")
        self.assertContains(r, "TC-001")

    # ── 欠陥管理のDB永続化（追加→一覧→削除） ──
    def test_defect_crud(self):
        url = reverse("service_detail", args=["defect-mgr"])
        self.client.post(url, {"action": "add", "title": "スモーク欠陥", "severity": "Critical"})
        self.assertEqual(Defect.objects.count(), 1)
        d = Defect.objects.first()
        self.assertEqual(d.severity, "Critical")
        r = self.client.get(url)
        self.assertContains(r, "スモーク欠陥")
        self.client.post(url, {"action": "delete", "id": d.id})
        self.assertEqual(Defect.objects.count(), 0)

    def test_defect_csv(self):
        url = reverse("service_detail", args=["defect-mgr"])
        self.client.post(url, {"action": "add", "title": "CSV対象"})
        r = self.client.post(url, {"action": "csv"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])


class EngineTest(TestCase):
    """提案A：実績OSSエンジン換装（フォールバック含む）の検証。"""

    def test_pairwise_engine_selected_and_covers_all_pairs(self):
        res = logic.pairwise("OS, Win, Mac\nブラウザ, Chrome, FF\n権限, 管理者, 一般")
        self.assertEqual(res["error"], "")
        self.assertIn(res["engine"], ("allpairspy", "builtin"))
        # 全ペア網羅の検証（パラメータ列の値から）
        rows = [r[1:] for r in res["rows"]]  # ID列を除く
        n = len(res["headers"]) - 1
        for i in range(n):
            for j in range(i + 1, n):
                want = {(a, b) for a in res["params"][i]["values"]
                        for b in res["params"][j]["values"]}
                got = {(row[i], row[j]) for row in rows}
                self.assertTrue(want <= got, f"列{i},{j}のペア未網羅")

    def test_doc_verify_reports_engine(self):
        res = logic.document_verify("これはたぶん大丈夫だと思います。", "general")
        self.assertIn(res["engine"], ("textlint", "builtin"))
        self.assertIn("findings", res)

    def test_doc_verify_required_section_always_flagged(self):
        # ドメイン判定は textlint 有無に関わらず内蔵ルールで必ず働く
        res = logic.document_verify("本文のみ。", "requirements")
        terms = [f["term"] for f in res["findings"]]
        self.assertIn("受入基準", terms)

    @unittest.skipUnless(engines.textlint_available(), "textlint 未導入のためスキップ")
    def test_textlint_detects_weak_phrase(self):
        res = engines.textlint_findings("これはたぶん動くと思います。")
        self.assertIsNotNone(res)
        self.assertTrue(any("思います" in f["msg"] or "弱い" in f["msg"] for f in res))

    def test_markdown_to_pdf_or_none(self):
        pdf = engines.markdown_to_pdf("# 計画\n\n本文")
        # WeasyPrint があれば PDF バイト列、無ければ None（呼出側でMDへ）
        if pdf is not None:
            self.assertTrue(pdf[:4] == b"%PDF")


class UxHtmxTest(TestCase):
    """提案B：HTMX 部分更新／Chart.js 描画の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    def test_htmx_returns_partial_not_full_page(self):
        r = self.client.post(reverse("service_detail", args=["trace"]),
                             {"req_text": "REQ-1, A", "test_text": "TC-1, REQ-1, t"}, **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "トレーサビリティマトリクス")
        # 部分テンプレートなので全体レイアウト（topbar）は含まれない
        self.assertNotContains(r, "id=\"topbar\"")

    def test_full_page_still_works_without_htmx(self):
        r = self.client.post(reverse("service_detail", args=["trace"]),
                             {"req_text": "REQ-1, A", "test_text": "TC-1, REQ-1, t"})
        self.assertContains(r, "id=\"topbar\"")
        self.assertContains(r, "トレーサビリティマトリクス")

    def test_roi_htmx_emits_chart_canvas(self):
        r = self.client.post(reverse("service_detail", args=["roi-calc"]),
                             {"industry": "finance", "incidents": "10",
                              "cost": "1000", "method": "5"}, **HX)
        self.assertContains(r, "data-chart")
        self.assertContains(r, "バグ捕捉率")

    def test_test_design_htmx_partial(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "pw", "pw_text": "A, 1, 2\nB, x, y"}, **HX)
        self.assertContains(r, "PW-1")
        self.assertNotContains(r, "id=\"topbar\"")

    def test_base_loads_vendored_assets(self):
        r = self.client.get(reverse("home"))
        self.assertContains(r, "vendor/htmx.min.js")
        self.assertContains(r, "vendor/chart.umd.min.js")

    def test_test_plan_pdf_download(self):
        r = self.client.post(reverse("service_detail", args=["plan-ai"]),
                             {"name": "P", "download": "pdf"})
        self.assertEqual(r.status_code, 200)
        ctype = r["Content-Type"]
        self.assertTrue("application/pdf" in ctype or "text/markdown" in ctype)

    # ── ISTQB-FL 追加技法（状態遷移・デシジョンテーブル） ──
    def test_state_transition_post(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "st", "st_text": "A, go, B\nB, back, A"})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "状態遷移表")
        self.assertContains(r, "ST-V1")   # 有効系
        self.assertContains(r, "ST-N1")   # 無効遷移（A,back / B,go が未定義）

    def test_state_transition_logic_coverage(self):
        res = logic.state_transition("未, 成功, 済\n済, 出, 未")
        self.assertEqual(res["error"], "")
        self.assertEqual(res["n_valid"], 2)
        self.assertEqual(res["n_invalid"], 2)        # 2状態×2イベント=4 − 定義2

    def test_decision_table_post(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "dt", "dt_text": "条件A\n条件B\n条件C"})
        self.assertContains(r, "規則")
        self.assertContains(r, "R8")                 # 2^3 = 8 規則

    def test_decision_table_rule_count(self):
        res = logic.decision_table("c1\nc2\nc3\nc4")
        self.assertEqual(res["count"], 16)           # 2^4
        self.assertEqual(len(res["rules"][0]["values"]), 4)

    def test_decision_table_caps_conditions(self):
        res = logic.decision_table("\n".join(f"c{i}" for i in range(10)))
        self.assertTrue(res["capped"])
        self.assertEqual(res["count"], 2 ** res["max_conditions"])

    def test_state_transition_csv_export(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "st", "st_text": "A, go, B\nB, back, A",
                              "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)
        self.assertIn("開始状態".encode(), r.content)

    def test_decision_table_csv_export(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "dt", "dt_text": "A\nB", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("アクション".encode(), r.content)

    def test_test_design_csv_export(self):
        # 田中さん動線: 観点設計の結果をExcelへ持ち出す
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "会員登録", "industry": "ecommerce",
                              "field_name": "メール", "field_type": "email",
                              "flags": "pii", "export": "csv"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("test_design_vp.csv", r["Content-Disposition"])
        body = r.content
        # BOMは先頭に1回だけ（Excelで各行頭が化けない）
        self.assertTrue(body.startswith(b"\xef\xbb\xbf"))
        self.assertEqual(body.count(b"\xef\xbb\xbf"), 1)
        self.assertIn("テスト観点".encode(), body)

    def test_pairwise_csv_export(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "pw", "pw_text": "OS, Win, Mac\nBrowser, Chrome, FF",
                              "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)

    # ── 期待結果列（テスター#1・AL-TA#3 ペルソナ対応） ──
    def test_viewpoint_design_has_expected_column(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "ログイン", "field_name": "ID",
                              "field_type": "email", "flags": "auth"})
        self.assertContains(r, "期待結果")
        self.assertContains(r, "正常に動作すること")
        self.assertContains(r, "セキュリティ要件を満たすこと")

    def test_viewpoint_csv_has_expected_column(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "ログイン",
                              "field_name": "ID", "field_type": "email",
                              "flags": "auth", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("期待結果".encode(), r.content)
        self.assertIn("正常に動作すること".encode(), r.content)

    # ── AI/生成AIテスト観点パック（P0・ペルソナ#6） ──
    def test_ai_flag_emits_ai_viewpoints_with_authority(self):
        # HTMX部分応答で検証（ナビ等を含まず観点表のみ）
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "問い合わせ要約", "flags": "ai"}, **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "ハルシネーション")        # AI観点が出る
        self.assertContains(r, "根拠標準")                # 出典列
        self.assertContains(r, "NIST AI 600-1")           # 監査証跡＝堀
        self.assertContains(r, "ISTQB CT-AI")

    def test_ai_viewpoints_have_authority_in_db(self):
        # AI観点はすべて根拠標準が紐づく（監査要件）
        ai = Viewpoint.objects.filter(source_type=Viewpoint.SOURCE_FLAG, source_key="ai")
        self.assertGreaterEqual(ai.count(), 8)
        self.assertTrue(all(v.authority for v in ai))

    def test_ai_csv_includes_authority(self):
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "要約", "flags": "ai",
                              "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("根拠標準".encode(), r.content)
        self.assertIn("NIST AI 600-1".encode(), r.content)

    def test_non_ai_feature_has_no_ai_viewpoints(self):
        # AIフラグなしならAI観点は出ない（誤適用しない）。部分応答で観点表のみ検証
        r = self.client.post(reverse("service_detail", args=["test-design"]),
                             {"mode": "vp", "feature": "ログイン", "flags": "auth"}, **HX)
        self.assertNotContains(r, "ハルシネーション")

    def test_defect_csv_single_bom(self):
        url = reverse("service_detail", args=["defect-mgr"])
        self.client.post(url, {"action": "add", "title": "BOM検証"})
        r = self.client.post(url, {"action": "csv"})
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)

    def test_doc_verify_pdf_upload(self):
        # WeasyPrint で本文入りPDFを作り、pdfplumber 抽出経路を検証
        pdf = engines.markdown_to_pdf("# 要件\n\n本文は適宜TBDで先送りする。")
        if pdf is None:
            self.skipTest("WeasyPrint 未導入のためPDF生成不可")
        up = SimpleUploadedFile("spec.pdf", pdf, content_type="application/pdf")
        r = self.client.post(reverse("service_detail", args=["doc-verify"]),
                             {"doc_type": "general", "pdf": up})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "抽出")


class MaturityTest(TestCase):
    """品質プロセス成熟度アセスメント（TMMi準拠）の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    def _all(self, val):
        """全設問を val で埋めた回答辞書。"""
        return {qk["name"]: val for qk in maturity.question_keys()}

    # ── ロジック ──
    def test_all_zero_is_level1(self):
        res = maturity.assess(self._all(0))
        self.assertEqual(res["overall_level"], 1)
        self.assertEqual(res["overall_score"], 0)
        # 全領域が未達 → ギャップは領域数ぶん
        self.assertEqual(res["n_gaps"], len(maturity.MODEL))

    def test_all_max_is_level5(self):
        res = maturity.assess(self._all(maturity.MAX_PER_Q))
        self.assertEqual(res["overall_level"], 5)
        self.assertEqual(res["overall_score"], 100)
        self.assertEqual(res["n_gaps"], 0)
        self.assertEqual(res["roadmap"], [])

    def test_level_is_capped_by_lowest_unsatisfied(self):
        # L2領域だけ満点、それ以外0 → L2は達成だが累積でL2止まり
        resp = {}
        for area in maturity.MODEL:
            v = maturity.MAX_PER_Q if area["level"] == 2 else 0
            for i in range(len(area["questions"])):
                resp[f"q_{area['code']}_{i}"] = v
        res = maturity.assess(resp)
        self.assertEqual(res["overall_level"], 2)
        # L3以降は未達
        chips = {c["lv"]: c["achieved"] for c in res["level_chips"]}
        self.assertTrue(chips[2])
        self.assertFalse(chips[3])

    def test_roadmap_ordered_by_level_then_score(self):
        res = maturity.assess(self._all(0))
        levels = [r["level"] for r in res["roadmap"]]
        self.assertEqual(levels, sorted(levels))  # レベル昇順＝着手順
        # 最優先は最も低い未達レベル
        self.assertEqual(res["roadmap"][0]["priority"], "最優先")

    def test_invalid_input_is_clamped(self):
        # 範囲外・非数値が混じっても落ちず 0..3 に丸める
        resp = self._all(0)
        first = maturity.question_keys()[0]["name"]
        resp[first] = "99"
        res = maturity.assess(resp)
        self.assertLessEqual(res["areas"][0]["values"][0], maturity.MAX_PER_Q)

    # ── ビュー ──
    def test_tool_is_wired_as_tool(self):
        svc = Service.objects.get(slug="process-diag")
        self.assertEqual(svc.kind, "tool")
        self.assertEqual(svc.tool_key, "maturity")

    def test_get_renders_form(self):
        r = self.client.get(reverse("service_detail", args=["process-diag"]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "成熟度")
        self.assertContains(r, "テスト方針・戦略")
        self.assertContains(r, "data-chart")  # レーダーチャート

    def test_post_computes_assessment(self):
        payload = {qk["name"]: 3 for qk in maturity.question_keys()}
        r = self.client.post(reverse("service_detail", args=["process-diag"]), payload)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Level 5")

    def test_post_htmx_returns_partial(self):
        payload = {qk["name"]: 1 for qk in maturity.question_keys()}
        r = self.client.post(reverse("service_detail", args=["process-diag"]),
                             payload, **HX)
        self.assertContains(r, "改善ロードマップ")
        self.assertNotContains(r, "id=\"topbar\"")

    def test_csv_export(self):
        payload = {qk["name"]: 1 for qk in maturity.question_keys()}
        payload["export"] = "csv"
        r = self.client.post(reverse("service_detail", args=["process-diag"]), payload)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)
        self.assertIn("改善ロードマップ".encode(), r.content)
        self.assertIn("総合成熟度レベル".encode(), r.content)


class NonfuncTest(TestCase):
    """非機能テスト観点ジェネレータ（ISO/IEC 25010:2023）の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    # ── エンジンロジック ──
    def test_all_chars_defined(self):
        self.assertEqual(len(nf.CHARS), 9)
        codes = {c["code"] for c in nf.CHARS}
        self.assertIn("SAFETY", codes)       # 2023年新設
        self.assertIn("SEC", codes)
        self.assertIn("PERF", codes)

    def test_generate_empty_selection(self):
        result = nf.generate([])
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["rows"], [])

    def test_generate_single_char(self):
        result = nf.generate(["PERF"])
        self.assertGreater(result["total"], 0)
        for r in result["rows"]:
            self.assertEqual(r["char_code"], "PERF")
            self.assertIn("authority", r)
            self.assertIn("ISO/IEC 25010:2023", r["authority"])

    def test_generate_all_chars(self):
        all_codes = [c["code"] for c in nf.CHARS]
        result = nf.generate(all_codes)
        self.assertGreater(result["total"], 30)
        self.assertEqual(len(result["by_char"]), 9)

    def test_safety_char_has_failsafe_viewpoints(self):
        result = nf.generate(["SAFETY"])
        viewpoints = [r["viewpoint"] for r in result["rows"]]
        joined = " ".join(viewpoints)
        self.assertIn("フェイルセーフ", joined + " ".join(r["sub_name"] for r in result["rows"]))

    def test_sla_params_substituted(self):
        result = nf.generate(["REL"], sla_uptime="99.99", sla_resp_ms=1000)
        # 稼働率が差し込まれる
        all_expected = " ".join(r["expected"] for r in result["rows"])
        self.assertIn("99.99", all_expected)

    def test_ids_are_sequential(self):
        result = nf.generate(["PERF", "REL"])
        ids = [r["id"] for r in result["rows"]]
        expected = [f"NF-{i+1:03d}" for i in range(len(ids))]
        self.assertEqual(ids, expected)

    def test_each_row_has_all_fields(self):
        result = nf.generate(["SEC"])
        required = {"id", "char_code", "char_name", "sub_code", "sub_name",
                    "viewpoint", "technique", "expected", "authority"}
        for r in result["rows"]:
            self.assertEqual(required, required & r.keys())

    # ── ビュー ──
    def test_tool_is_wired(self):
        svc = Service.objects.get(slug="nonfunc-gen")
        self.assertEqual(svc.kind, "tool")
        self.assertEqual(svc.tool_key, "nonfunc")

    def test_get_renders_form(self):
        r = self.client.get(reverse("service_detail", args=["nonfunc-gen"]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "ISO/IEC 25010:2023")
        self.assertContains(r, "Safety")         # 新設特性が表示される
        self.assertContains(r, "SLAパラメータ")

    def test_post_generates_viewpoints(self):
        r = self.client.post(reverse("service_detail", args=["nonfunc-gen"]),
                             {"chars": ["PERF", "REL"], "sla_uptime": "99.9", "sla_resp_ms": "3000"})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "NF-001")
        self.assertContains(r, "ISO/IEC 25010:2023")

    def test_htmx_returns_partial(self):
        r = self.client.post(reverse("service_detail", args=["nonfunc-gen"]),
                             {"chars": ["SEC"], "sla_uptime": "99.9", "sla_resp_ms": "3000"}, **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "セキュリティ")
        self.assertNotContains(r, "id=\"topbar\"")

    def test_csv_export(self):
        r = self.client.post(reverse("service_detail", args=["nonfunc-gen"]),
                             {"chars": ["PERF", "SAFETY"], "sla_uptime": "99.9",
                              "sla_resp_ms": "3000", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)
        self.assertIn("非機能テスト観点".encode(), r.content)
        self.assertIn("根拠標準".encode(), r.content)
        self.assertIn("ISO/IEC 25010:2023".encode(), r.content)


class AssessmentTest(TestCase):
    """汎用アセスメント・エンジン（8ツールを単一エンジンで駆動）の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    TOOLS = [
        ("consultant", "consultant"), ("tpi-next", "tpi_next"),
        ("embedded-verify", "embedded_verify"), ("qa4ai", "qa4ai"),
        ("genai-qa", "genai_qa"), ("vuln-web", "vuln_web"),
        ("vuln-embedded", "vuln_embedded"), ("sec-training", "sec_training"),
    ]

    def test_all_models_well_formed(self):
        from tools import assessments
        self.assertEqual(len(assessments.MODELS), 8)
        for key, model in assessments.MODELS.items():
            self.assertEqual(model["key"], key)
            self.assertTrue(model["areas"], f"{key} に領域がない")
            self.assertEqual(len(model["bands"]), 4, f"{key} のバンドは4段階")
            for area in model["areas"]:
                self.assertTrue(area["items"], f"{key}/{area['code']} に項目がない")
                for item in area["items"]:
                    self.assertIn("q", item)
                    self.assertIn("fix", item)

    def test_assess_all_zero_is_worst_band(self):
        from tools import assessments
        for key, model in assessments.MODELS.items():
            res = assessments.assess(model, {})
            self.assertEqual(res["overall_score"], 0, f"{key} で0点にならない")
            self.assertEqual(res["band"]["tone"], "bad")
            n_items = sum(len(a["items"]) for a in model["areas"])
            self.assertEqual(res["n_findings"], n_items)

    def test_assess_all_max_is_best_band(self):
        from tools import assessments
        for key, model in assessments.MODELS.items():
            full = {k["name"]: 3 for k in assessments.item_keys(model)}
            res = assessments.assess(model, full)
            self.assertEqual(res["overall_score"], 100, f"{key} で100点にならない")
            self.assertEqual(res["band"]["tone"], "ok")
            self.assertEqual(res["n_findings"], 0)

    def test_recommendations_have_authority(self):
        from tools import assessments
        model = assessments.get_model("vuln_web")
        res = assessments.assess(model, {})
        self.assertTrue(res["recommendations"])
        for r in res["recommendations"]:
            self.assertTrue(r["fix"])
            self.assertTrue(r["authority"])
            self.assertIn(r["priority"], ("最優先", "優先", "推奨"))

    def test_all_tools_get_renders_form(self):
        for slug, _key in self.TOOLS:
            r = self.client.get(reverse("service_detail", args=[slug]))
            self.assertEqual(r.status_code, 200, f"{slug} が開けない")
            self.assertContains(r, "診断する")

    def test_all_tools_post_generates_result(self):
        from tools import assessments
        for slug, key in self.TOOLS:
            model = assessments.get_model(key)
            data = {k["name"]: 1 for k in assessments.item_keys(model)}
            r = self.client.post(reverse("service_detail", args=[slug]), data, **HX)
            self.assertEqual(r.status_code, 200, f"{slug} のPOSTが失敗")
            self.assertContains(r, "領域別スコア")

    def test_csv_export(self):
        from tools import assessments
        model = assessments.get_model("qa4ai")
        data = {k["name"]: 2 for k in assessments.item_keys(model)}
        data["export"] = "csv"
        r = self.client.post(reverse("service_detail", args=["qa4ai"]), data)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertEqual(r.content.count(b"\xef\xbb\xbf"), 1)
        self.assertIn("改善アクション".encode(), r.content)

    def test_tools_are_wired_as_tools(self):
        for slug, key in self.TOOLS:
            s = Service.objects.get(slug=slug)
            self.assertEqual(s.kind, "tool", f"{slug} がtoolになっていない")
            self.assertEqual(s.tool_key, key)


class GenEngineCTest(TestCase):
    """gen_engines_c.py (7 Batch-3 tools) の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    TOOL_SLUGS = [
        ("planning", "qa_planning"),
        ("advisor", "quality_roadmap"),
        ("education", "edu_assess"),
        ("impl", "impl_tracker"),
        ("project", "project_tools"),
        ("test-promo", "test_exec"),
        ("test-outsource", "test_outsource"),
    ]

    # ── エンジン単体テスト ──

    def test_qa_planning_returns_markdown(self):
        from tools import gen_engines_c as gec
        r = gec.qa_planning_generate("test_plan", "テストPJ", "購入フロー", "", "", "", "", "", "3")
        self.assertIn("markdown", r)
        self.assertIn("ISO/IEC 29119-3", r["markdown"])
        self.assertIn("doc_types", r)
        self.assertEqual(len(r["doc_types"]), 6)

    def test_qa_planning_all_doc_types(self):
        from tools import gen_engines_c as gec
        for dt in gec.DOC_TYPES:
            r = gec.qa_planning_generate(dt, "PJ", "", "", "", "", "", "", "2")
            self.assertIn("markdown", r)
            self.assertTrue(r["markdown"])

    def test_project_tools_wbs_and_risks(self):
        from tools import gen_engines_c as gec
        r = gec.project_tools_generate("ECサイト", "2026-01-01", "2026-03-31", "", "カスタムリスク1")
        self.assertEqual(len(r["wbs"]), 6)
        self.assertGreater(r["n_risks"], 7)
        self.assertTrue(r["p1_risks"])

    def test_quality_roadmap_phases(self):
        from tools import gen_engines_c as gec
        scores = {"process": 1, "metrics": 0, "automation": 2, "culture": 1}
        r = gec.quality_roadmap_generate(scores, ["欠陥0件"], 6)
        self.assertEqual(len(r["roadmap"]), 3)
        self.assertEqual(len(r["kpis"]), 4)
        self.assertGreater(r["n_actions"], 0)

    def test_edu_assess_gap_analysis(self):
        from tools import gen_engines_c as gec
        responses = {}  # 全0=未学習
        r = gec.edu_assess(responses, "FL")
        self.assertEqual(r["readiness"], 0)
        self.assertEqual(r["gap_count"], r["total_topics"])
        self.assertTrue(r["study_plan"])
        self.assertTrue(r["resources"])

    def test_edu_assess_full_readiness(self):
        from tools import gen_engines_c as gec
        keys = gec.edu_item_keys()
        responses = {k["name"]: 2 for k in keys}
        r = gec.edu_assess(responses, "FL")
        self.assertEqual(r["readiness"], 100)
        self.assertEqual(r["gap_count"], 0)

    def test_impl_tracker_default_data(self):
        from tools import gen_engines_c as gec
        r = gec.impl_tracker_process("", "テストPJ")
        self.assertGreater(r["total"], 0)
        self.assertIn("done", r)

    def test_impl_tracker_csv_input(self):
        from tools import gen_engines_c as gec
        csv = "タスクA, 田中, 完了, 2026-01-01\nタスクB, 山田, ブロック, "
        r = gec.impl_tracker_process(csv, "PJ")
        self.assertEqual(r["total"], 2)
        self.assertEqual(r["done"], 1)
        self.assertEqual(r["blocked_count"], 1)

    def test_test_exec_dashboard_release_ok(self):
        from tools import gen_engines_c as gec
        phases = [{"name": "SIT", "planned": 100, "executed": 100,
                   "passed": 100, "failed": 0, "blocked": 0}]
        r = gec.test_exec_dashboard(phases)
        self.assertTrue(r["release_ok"])
        self.assertEqual(r["overall_exec_rate"], 100)

    def test_test_exec_dashboard_not_ok(self):
        from tools import gen_engines_c as gec
        phases = [{"name": "SIT", "planned": 100, "executed": 80,
                   "passed": 70, "failed": 10, "blocked": 0}]
        r = gec.test_exec_dashboard(phases)
        self.assertFalse(r["release_ok"])

    def test_test_outsource_tracker(self):
        from tools import gen_engines_c as gec
        phases = [{"name": "ST", "planned": 50, "executed": 50,
                   "passed": 48, "failed": 2, "blocked": 0}]
        defects = "ログイン後に白画面, Critical, Open, ST\n入力制限不備, Major, Fixed, 結合"
        r = gec.test_outsource_tracker("PJ", "クライアントA", phases, defects)
        self.assertEqual(r["n_defects"], 2)
        self.assertIn("テストサマリーレポート", r["report_md"])

    # ── HTTP 統合テスト ──

    def test_all_tools_get_200(self):
        for slug, _key in self.TOOL_SLUGS:
            r = self.client.get(reverse("service_detail", args=[slug]))
            self.assertEqual(r.status_code, 200, f"{slug} GET が失敗")

    def test_qa_planning_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["planning"]),
            {"doc_type": "test_plan", "project_name": "テスト計画PJ", "team_size": "2"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "ISO/IEC 29119-3")

    def test_qa_planning_download_md(self):
        r = self.client.post(
            reverse("service_detail", args=["planning"]),
            {"doc_type": "test_plan", "project_name": "DL-PJ", "download": "md"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/markdown", r["Content-Type"])

    def test_project_tools_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["project"]),
            {"project_name": "テスト", "start_date": "2026-01-01", "end_date": "2026-03-31"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "WBS")

    def test_project_tools_csv(self):
        r = self.client.post(
            reverse("service_detail", args=["project"]),
            {"project_name": "PJ", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_quality_roadmap_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["advisor"]),
            {"process": "1", "metrics": "0", "automation": "1", "culture": "2",
             "horizon_months": "6"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Phase 1")

    def test_edu_assess_post_htmx(self):
        keys = __import__("tools.gen_engines_c", fromlist=["edu_item_keys"]).edu_item_keys()
        data = {k["name"]: "1" for k in keys}
        data["target_cert"] = "FL"
        r = self.client.post(reverse("service_detail", args=["education"]), data, **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "ISTQB")

    def test_impl_tracker_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["impl"]),
            {"tasks_text": "タスクA, 田中, 完了, \nタスクB, 山田, 進行中, "},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "タスクA")

    def test_test_exec_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["test-promo"]),
            {"phase_name": ["システムテスト"], "planned": ["100"],
             "executed": ["100"], "passed": ["100"], "failed": ["0"], "blocked": ["0"]},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "リリース判定")

    def test_test_outsource_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["test-outsource"]),
            {"project_name": "受託PJ", "client_name": "クライアントA",
             "phase_name": ["ST"], "planned": ["50"], "executed": ["50"],
             "passed": ["48"], "failed": ["2"], "blocked": ["0"],
             "defects_text": "バグ1, Critical, Open, ST"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "フェーズ別進捗")

    def test_tools_are_wired_as_tools(self):
        for slug, key in self.TOOL_SLUGS:
            s = Service.objects.get(slug=slug)
            self.assertEqual(s.kind, "tool", f"{slug} がtoolになっていない")
            self.assertEqual(s.tool_key, key)


class GenEngineATest(TestCase):
    """gen_engines_a.py (testra + exploratory) の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    def test_spec_to_tc_generates_cases(self):
        from tools import gen_engines_a as gea
        r = gea.spec_to_tc("ユーザーはメールとパスワードでログインできる", "ログイン機能",
                            ["func", "boundary", "exception"])
        self.assertGreater(r["total"], 0)
        self.assertFalse(r["error"])
        for tc in r["cases"]:
            self.assertIn("id", tc)
            self.assertIn("title", tc)
            self.assertIn("steps", tc)
            self.assertTrue(tc["steps"])

    def test_spec_to_tc_empty_spec_returns_error(self):
        from tools import gen_engines_a as gea
        r = gea.spec_to_tc("", "テスト", ["func"])
        self.assertTrue(r["error"])
        self.assertEqual(r["total"], 0)

    def test_spec_to_tc_all_types(self):
        from tools import gen_engines_a as gea
        all_types = ["func", "boundary", "exception", "state", "security", "perf"]
        r = gea.spec_to_tc("ユーザーがログインできる。パスワードは8文字以上。", "ログイン", all_types)
        self.assertGreater(r["total"], 0)
        self.assertFalse(r.get("error"))

    def test_exploratory_charters_generated(self):
        from tools import gen_engines_a as gea
        r = gea.exploratory_charters("カートページ", 120, ["func", "security", "perf"], "high")
        self.assertGreater(r["total_charters"], 0)
        self.assertFalse(r["error"])
        for ch in r["charters"]:
            self.assertIn("mission", ch)
            self.assertIn("focus", ch)
            self.assertGreater(ch["duration_min"], 0)

    def test_exploratory_empty_feature_returns_error(self):
        from tools import gen_engines_a as gea
        r = gea.exploratory_charters("", 60, ["func"], "medium")
        self.assertTrue(r["error"])

    def test_testra_get_200(self):
        r = self.client.get(reverse("service_detail", args=["testra"]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "テストケースを生成する")

    def test_testra_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["testra"]),
            {"spec_text": "ユーザーがログインできる", "feature_name": "ログイン",
             "test_types": ["func", "boundary"]},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "TC-")

    def test_testra_csv_export(self):
        r = self.client.post(
            reverse("service_detail", args=["testra"]),
            {"spec_text": "ユーザーがログインできる", "feature_name": "ログイン",
             "test_types": ["func"], "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_exploratory_get_200(self):
        r = self.client.get(reverse("service_detail", args=["exploratory"]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "チャーターを生成する")

    def test_exploratory_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["exploratory"]),
            {"feature": "ログインフォーム", "time_budget_min": "60",
             "areas": ["func", "security"], "risk_level": "high"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "CH-")

    def test_tools_are_wired_as_tools(self):
        for slug, key in [("testra", "testra"), ("exploratory", "exploratory")]:
            s = Service.objects.get(slug=slug)
            self.assertEqual(s.kind, "tool")
            self.assertEqual(s.tool_key, key)


class GenEngineBTest(TestCase):
    """gen_engines_b.py (静的解析・OSSリスク・負荷テスト・SAPシナリオ) の検証。"""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_data")

    # ── 負荷テスト ──

    def test_load_test_gen_produces_4_scenarios(self):
        from tools import gen_engines_b as geb
        r = geb.load_test_gen("web", 500, 2000, 100, 30, "https")
        self.assertEqual(r["total_scenarios"], 4)
        types = {s["type"] for s in r["scenarios"]}
        self.assertIn("スモーク", types)
        self.assertIn("負荷", types)
        self.assertIn("スパイク", types)
        self.assertIn("耐久", types)

    def test_load_test_gen_locust_script(self):
        from tools import gen_engines_b as geb
        r = geb.load_test_gen("api", 200, 1000, 50, 15, "https")
        self.assertIn("locust_script", r)
        self.assertIn("from locust import", r["locust_script"])

    def test_load_test_gen_sla_table(self):
        from tools import gen_engines_b as geb
        r = geb.load_test_gen("web", 100, 3000, 200, 60, "https")
        self.assertGreater(len(r["sla_table"]), 0)
        self.assertIn("metric", r["sla_table"][0])
        self.assertIn("target", r["sla_table"][0])

    def test_load_test_gen_bottleneck_checklist(self):
        from tools import gen_engines_b as geb
        r = geb.load_test_gen("web", 100, 2000, 100, 30, "https")
        self.assertGreater(len(r["bottleneck_checklist"]), 0)

    # ── OSSリスク ──

    def test_oss_risk_python_requirements(self):
        from tools import gen_engines_b as geb
        text = "django==4.2.1\nrequests==2.31.0\nmysqlclient==2.2.0"
        r = geb.oss_risk_calc(text, "python")
        self.assertEqual(len(r["packages"]), 3)
        names = [p["name"] for p in r["packages"]]
        self.assertIn("django", names)
        self.assertIn("requests", names)

    def test_oss_risk_license_detection(self):
        from tools import gen_engines_b as geb
        text = "mysqlclient==2.2.0"
        r = geb.oss_risk_calc(text, "python")
        pkg = r["packages"][0]
        self.assertIn("GPL", pkg["license"])

    def test_oss_risk_summary_keys(self):
        from tools import gen_engines_b as geb
        r = geb.oss_risk_calc("flask==3.0.0\nnumpy==1.26.0", "python")
        self.assertIn("summary", r)
        self.assertIn("sbom", r)
        self.assertIn("recommendations", r)

    def test_oss_risk_node_ecosystem(self):
        from tools import gen_engines_b as geb
        text = '{"dependencies": {"express": "^4.18.0", "lodash": "^4.17.21"}}'
        r = geb.oss_risk_calc(text, "node")
        self.assertGreater(len(r["packages"]), 0)

    # ── 静的解析 ──

    def test_static_analysis_python_findings(self):
        from tools import gen_engines_b as geb
        code = "import os\npassword = 'abc123'\nexec(user_input)\neval(x)"
        r = geb.static_code_analysis(code, "python")
        self.assertGreater(len(r["findings"]), 0)
        self.assertIn("score", r)
        self.assertIn("grade", r)

    def test_static_analysis_grade_scale(self):
        from tools import gen_engines_b as geb
        clean_code = "def add(a, b):\n    return a + b\n"
        r = geb.static_code_analysis(clean_code, "python")
        self.assertIn(r["grade"], ["A", "B", "C", "D", "F"])
        self.assertGreaterEqual(r["score"], 0)
        self.assertLessEqual(r["score"], 100)

    def test_static_analysis_metrics(self):
        from tools import gen_engines_b as geb
        code = "def f():\n    x = 1\n    return x\n"
        r = geb.static_code_analysis(code, "python")
        self.assertIn("metrics", r)
        self.assertIn("lines", r["metrics"])

    def test_static_analysis_javascript(self):
        from tools import gen_engines_b as geb
        code = "var x = eval(input);\nconsole.log(x);"
        r = geb.static_code_analysis(code, "javascript")
        self.assertGreater(len(r["findings"]), 0)

    def test_static_analysis_severity_counts(self):
        from tools import gen_engines_b as geb
        code = "exec(x)\neval(y)\npassword='abc'"
        r = geb.static_code_analysis(code, "python")
        self.assertIn("summary", r)
        s = r["summary"]
        total = s["Critical"] + s["Major"] + s["Minor"] + s["Info"]
        self.assertEqual(total, len(r["findings"]))

    # ── SAPシナリオ ──

    def test_sap_scenario_gen_fi_module(self):
        from tools import gen_engines_b as geb
        r = geb.sap_scenario_gen("FI", "仕入先請求書の照合と支払処理", ["happy_path", "authorization"])
        self.assertGreater(r["total"], 0)
        self.assertIn("FI", r["module"])  # 例: "財務会計（FI）"
        for sc in r["scenarios"]:
            self.assertIn("id", sc)
            self.assertIn("t_code", sc)
            self.assertIn("steps", sc)
            self.assertTrue(sc["steps"])

    def test_sap_scenario_gen_mm_module(self):
        from tools import gen_engines_b as geb
        r = geb.sap_scenario_gen("MM", "購買依頼から発注・検収", ["happy_path"])
        self.assertGreater(r["total"], 0)
        t_codes = [sc["t_code"] for sc in r["scenarios"]]
        self.assertTrue(any("ME" in t for t in t_codes))

    def test_sap_scenario_gen_checklists(self):
        from tools import gen_engines_b as geb
        r = geb.sap_scenario_gen("SD", "受注から出荷・請求", ["happy_path", "regression"])
        self.assertIn("master_data_checklist", r)
        self.assertIn("transport_checklist", r)
        self.assertGreater(len(r["master_data_checklist"]), 0)
        self.assertGreater(len(r["transport_checklist"]), 0)

    def test_sap_scenario_steps_have_required_keys(self):
        from tools import gen_engines_b as geb
        r = geb.sap_scenario_gen("PP", "生産計画から製造指図", ["happy_path"])
        for sc in r["scenarios"]:
            for step in sc["steps"]:
                self.assertIn("action", step)
                self.assertIn("expected", step)
                self.assertIn("t_code", step)

    # ── HTTP 統合テスト ──

    def test_static_analysis_get_200(self):
        r = self.client.get(reverse("service_detail", args=["static-analysis"]))
        self.assertEqual(r.status_code, 200)

    def test_static_analysis_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["static-analysis"]),
            {"code_text": "eval(user_input)\npassword='secret'", "language": "python"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "SA-")

    def test_static_analysis_csv_export(self):
        r = self.client.post(
            reverse("service_detail", args=["static-analysis"]),
            {"code_text": "eval(x)", "language": "python", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_oss_risk_get_200(self):
        r = self.client.get(reverse("service_detail", args=["oss-risk"]))
        self.assertEqual(r.status_code, 200)

    def test_oss_risk_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["oss-risk"]),
            {"dependency_text": "django==4.2.1\nrequests==2.31.0", "ecosystem": "python"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "django")

    def test_oss_risk_csv_export(self):
        r = self.client.post(
            reverse("service_detail", args=["oss-risk"]),
            {"dependency_text": "flask==3.0.0", "ecosystem": "python", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_load_test_get_200(self):
        r = self.client.get(reverse("service_detail", args=["nonfunctional"]))
        self.assertEqual(r.status_code, 200)

    def test_load_test_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["nonfunctional"]),
            {"system_type": "web", "protocol": "https",
             "concurrent_users": "500", "sla_resp_ms": "2000",
             "sla_tps": "100", "duration_min": "30"},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "スモーク")

    def test_load_test_csv_export(self):
        r = self.client.post(
            reverse("service_detail", args=["nonfunctional"]),
            {"system_type": "api", "concurrent_users": "200", "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_sap_verify_get_200(self):
        r = self.client.get(reverse("service_detail", args=["sap-verify"]))
        self.assertEqual(r.status_code, 200)

    def test_sap_verify_post_htmx(self):
        r = self.client.post(
            reverse("service_detail", args=["sap-verify"]),
            {"module": "FI", "process": "請求書照合と支払処理",
             "scope": ["happy_path", "authorization"]},
            **HX)
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "SAP-")

    def test_sap_verify_csv_export(self):
        r = self.client.post(
            reverse("service_detail", args=["sap-verify"]),
            {"module": "MM", "process": "購買依頼から発注",
             "scope": ["happy_path"], "export": "csv"})
        self.assertIn("text/csv", r["Content-Type"])

    def test_batch5_tools_are_wired(self):
        for slug, key in [("static-analysis", "static_analysis"),
                          ("oss-risk", "oss_risk"),
                          ("nonfunctional", "load_test"),
                          ("sap-verify", "sap_verify")]:
            s = Service.objects.get(slug=slug)
            self.assertEqual(s.kind, "tool", f"{slug} がtoolになっていない")
            self.assertEqual(s.tool_key, key)
