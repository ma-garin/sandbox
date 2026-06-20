"""ナレッジ資産 — テスト観点ライブラリと欠陥パターンDB。

ベリサーブの差別化資産（観点という知識）をDB化する。
静的JSの viewpoints.js を移植し、社内で「育てられる」資産にする。
"""
from django.db import models


class ViewpointCategory(models.Model):
    """観点カテゴリ（機能 / 境界 / データ / 並行性 / 状態遷移 など）。"""

    code = models.CharField("カテゴリコード", max_length=12, unique=True)
    name = models.CharField("カテゴリ名", max_length=60)
    order = models.PositiveIntegerField("表示順", default=0)

    class Meta:
        verbose_name = "観点カテゴリ"
        verbose_name_plural = "観点カテゴリ"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.code} {self.name}"


class Viewpoint(models.Model):
    """個別のテスト観点。観点→技法→カテゴリで追跡可能（監査証跡）。"""

    SOURCE_ALWAYS = "always"
    SOURCE_FIELD = "field"
    SOURCE_FLAG = "flag"
    SOURCE_INDUSTRY = "industry"
    SOURCE_CHOICES = [
        (SOURCE_ALWAYS, "常時適用"),
        (SOURCE_FIELD, "入力項目別"),
        (SOURCE_FLAG, "機能特性別"),
        (SOURCE_INDUSTRY, "業種別"),
    ]

    category = models.ForeignKey(
        ViewpointCategory, on_delete=models.CASCADE,
        related_name="viewpoints", verbose_name="カテゴリ",
    )
    viewpoint = models.CharField("テスト観点", max_length=200)
    technique = models.CharField("技法", max_length=80)
    source_type = models.CharField("適用契機", max_length=12, choices=SOURCE_CHOICES)
    source_key = models.CharField(
        "適用キー", max_length=40, blank=True,
        help_text="項目型(email等) / 特性(money等) / 業種(finance等)",
    )

    class Meta:
        verbose_name = "テスト観点"
        verbose_name_plural = "テスト観点"
        ordering = ["category__order", "id"]

    def __str__(self):
        return self.viewpoint


class DefectPattern(models.Model):
    """業界で繰り返し発生する既知の欠陥パターン。"""

    pattern_id = models.CharField("パターンID", max_length=16, unique=True)
    category = models.ForeignKey(
        ViewpointCategory, on_delete=models.CASCADE,
        related_name="defect_patterns", verbose_name="カテゴリ",
    )
    pattern = models.CharField("欠陥パターン", max_length=160)
    example = models.CharField("典型例", max_length=240, blank=True)
    prevention = models.CharField("予防策", max_length=240, blank=True)

    class Meta:
        verbose_name = "欠陥パターン"
        verbose_name_plural = "欠陥パターン"
        ordering = ["pattern_id"]

    def __str__(self):
        return f"{self.pattern_id} {self.pattern}"
