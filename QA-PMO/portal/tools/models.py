"""ツール — 欠陥管理の永続データ。

静的版は localStorage 依存だったが、本システムでは DB 永続化する。
これにより複数ユーザー・複数端末で欠陥情報を共有できる（社内実務での運用）。
"""
from django.db import models


class Defect(models.Model):
    """ISTQB severity に基づく欠陥チケット。"""

    SEVERITY_CHOICES = [
        ("Critical", "Critical（システム停止・データ破損）"),
        ("Major", "Major（主要機能が動作不可）"),
        ("Minor", "Minor（機能は動くが一部不具合）"),
        ("Cosmetic", "Cosmetic（見た目・微細な問題）"),
    ]
    PHASE_CHOICES = [
        ("単体テスト", "単体テスト"),
        ("結合テスト", "結合テスト"),
        ("システムテスト", "システムテスト"),
        ("UAT", "UAT"),
        ("本番", "本番"),
    ]
    ROOT_CHOICES = [
        ("仕様漏れ", "仕様漏れ"),
        ("実装誤り", "実装誤り"),
        ("設計誤り", "設計誤り"),
        ("テスト漏れ", "テスト漏れ"),
        ("環境問題", "環境問題"),
        ("外部要因", "外部要因"),
    ]
    STATUS_CHOICES = [
        ("Open", "Open"),
        ("In Progress", "In Progress"),
        ("Fixed", "Fixed"),
        ("Closed", "Closed"),
        ("Rejected", "Rejected"),
    ]

    title = models.CharField("タイトル", max_length=200)
    severity = models.CharField("Severity", max_length=10, choices=SEVERITY_CHOICES, default="Major")
    phase = models.CharField("検出フェーズ", max_length=20, choices=PHASE_CHOICES, default="システムテスト")
    root_cause = models.CharField("根本原因", max_length=20, choices=ROOT_CHOICES, default="実装誤り")
    description = models.TextField("概要・再現手順", blank=True)
    status = models.CharField("ステータス", max_length=12, choices=STATUS_CHOICES, default="Open")
    created_at = models.DateTimeField("登録日時", auto_now_add=True)
    updated_at = models.DateTimeField("更新日時", auto_now=True)

    class Meta:
        verbose_name = "欠陥"
        verbose_name_plural = "欠陥"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"D-{self.id:03d} {self.title}"

    @property
    def code(self):
        return f"D-{self.id:03d}"
