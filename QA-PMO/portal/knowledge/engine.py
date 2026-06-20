"""観点ベース設計エンジン。

DB の観点ライブラリ（Viewpoint）を仕様（機能・入力項目・特性・業種）に適用し、
観点カバレッジ付きでテスト条件を生成する。各条件は観点→技法→カテゴリに追跡可能。
"""
from knowledge.models import Viewpoint, ViewpointCategory

INDUSTRY_NAME = {
    "finance": "金融", "ecommerce": "EC/小売",
    "healthcare": "医療/ヘルスケア", "saas": "SaaS/B2B",
}


def generate(feature, fields, flags, industry):
    """fields: [{"name","type"}], flags: [str], industry: str|"" 。"""
    feature = feature or "対象機能"
    rows = []
    n = 0

    def add(target, vp):
        nonlocal n
        n += 1
        rows.append({
            "id": f"TC-{n:03d}", "target": target,
            "viewpoint": vp.viewpoint, "technique": vp.technique,
            "cat": vp.category.code, "cat_name": vp.category.name,
        })

    # 常時観点
    for vp in Viewpoint.objects.filter(source_type=Viewpoint.SOURCE_ALWAYS).select_related("category"):
        add(feature, vp)

    # 入力項目の型別観点
    for f in fields:
        ftype = f.get("type", "text")
        qs = Viewpoint.objects.filter(
            source_type=Viewpoint.SOURCE_FIELD, source_key=ftype
        ).select_related("category")
        for vp in qs:
            add(f"{f['name']}（{ftype}）", vp)

    # 機能特性別観点
    for fl in flags:
        qs = Viewpoint.objects.filter(
            source_type=Viewpoint.SOURCE_FLAG, source_key=fl
        ).select_related("category")
        for vp in qs:
            add(feature, vp)

    # 業種別観点
    if industry:
        label = f"{feature}（{INDUSTRY_NAME.get(industry, industry)}）"
        qs = Viewpoint.objects.filter(
            source_type=Viewpoint.SOURCE_INDUSTRY, source_key=industry
        ).select_related("category")
        for vp in qs:
            add(label, vp)

    # カバレッジ算出
    all_cats = list(ViewpointCategory.objects.all())
    touched = {r["cat"] for r in rows}
    covered = [c for c in all_cats if c.code in touched]
    missing = [c for c in all_cats if c.code not in touched]
    coverage = round(len(covered) / len(all_cats) * 100) if all_cats else 0

    return {
        "feature": feature, "industry": industry, "rows": rows,
        "total": len(all_cats), "covered": covered, "missing": missing,
        "n_covered": len(covered), "coverage": coverage,
    }
