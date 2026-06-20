"""ポータルのスモークテスト（回帰用）。

全サービス詳細・全ツールのGET、主要ツールのPOSTを検証する。
Django test client を使うのでサーバー起動は不要。

    python manage.py test
"""
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from catalog.models import Service
from tools.models import Defect


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
