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
from tools import engines, logic
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
