"""カタログ — サービス区分とサービス定義。

社内ポータルの情報設計の中核。
上司依頼の区分（品質PMO / 第三者検証 / AIサービス / セキュリティ）を
Category として持ち、その配下に Service（実務ツール or 参照カタログ）を並べる。
"""
from django.db import models


class Category(models.Model):
    """トップレベルのサービス区分（ナビの第1階層）。"""

    slug = models.SlugField("スラッグ", unique=True)
    name = models.CharField("区分名", max_length=60)
    icon = models.CharField("アイコン(絵文字)", max_length=8, blank=True)
    tagline = models.CharField("ひとこと説明", max_length=160, blank=True)
    order = models.PositiveIntegerField("表示順", default=0)

    class Meta:
        verbose_name = "サービス区分"
        verbose_name_plural = "サービス区分"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class ServiceGroup(models.Model):
    """区分内のサブグループ（ナビの第2階層・任意）。"""

    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="groups", verbose_name="区分"
    )
    name = models.CharField("グループ名", max_length=60)
    order = models.PositiveIntegerField("表示順", default=0)

    class Meta:
        verbose_name = "サービスグループ"
        verbose_name_plural = "サービスグループ"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.category.name} › {self.name}"


class Service(models.Model):
    """個別サービス。実務ツール(kind=tool) か 参照カタログ(kind=catalog)。"""

    KIND_TOOL = "tool"
    KIND_CATALOG = "catalog"
    KIND_CHOICES = [
        (KIND_TOOL, "実務ツール（画面で実行できる）"),
        (KIND_CATALOG, "参照カタログ（手順・観点の解説）"),
    ]

    slug = models.SlugField("スラッグ", unique=True)
    title = models.CharField("サービス名", max_length=80)
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="services", verbose_name="区分"
    )
    group = models.ForeignKey(
        ServiceGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
        verbose_name="グループ",
    )
    icon = models.CharField("アイコン(絵文字)", max_length=8, blank=True)
    summary = models.CharField("概要（1行）", max_length=220)
    description = models.TextField("説明", blank=True)
    product = models.CharField(
        "提供製品名", max_length=40, blank=True,
        help_text="ベリサーブ製品との対応（GIHOZ / ConTrack / Vex 等）",
    )
    kind = models.CharField("種別", max_length=10, choices=KIND_CHOICES, default=KIND_CATALOG)
    tool_key = models.CharField(
        "ツールキー", max_length=40, blank=True,
        help_text="kind=tool のとき、tools アプリのどのツールを呼ぶか",
    )
    tags = models.JSONField("タグ", default=list, blank=True)
    features = models.JSONField("特徴カード", default=list, blank=True)
    steps = models.JSONField("支援フロー", default=list, blank=True)
    order = models.PositiveIntegerField("表示順", default=0)

    class Meta:
        verbose_name = "サービス"
        verbose_name_plural = "サービス"
        ordering = ["order", "id"]

    def __str__(self):
        return self.title

    @property
    def is_tool(self):
        return self.kind == self.KIND_TOOL

    @property
    def breadcrumb(self):
        """パンくず要素のリスト（区分 › グループ › サービス名）。"""
        parts = [self.category.name]
        if self.group:
            parts.append(self.group.name)
        parts.append(self.title)
        return parts
