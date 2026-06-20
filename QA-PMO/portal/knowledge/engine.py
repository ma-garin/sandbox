"""観点ベース設計エンジン。

DB の観点ライブラリ（Viewpoint）を仕様（機能・入力項目・特性・業種）に適用し、
観点カバレッジ付きでテスト条件を生成する。各条件は観点→技法→カテゴリに追跡可能。
"""
from knowledge.models import Viewpoint, ViewpointCategory

INDUSTRY_NAME = {
    "finance": "金融", "ecommerce": "EC/小売",
    "healthcare": "医療/ヘルスケア", "saas": "SaaS/B2B",
}

# カテゴリコード → 基本期待結果（ISTQB観点）
_CAT_EXPECTED = {
    "C-FUNC":  "正常に動作すること",
    "C-BVA":   "境界値が正しく処理されること",
    "C-EQ":    "適切なデータ種別として処理されること",
    "C-EXC":   "適切なエラーが表示されること",
    "C-STATE": "正しい状態に遷移すること",
    "C-SEC":   "セキュリティ要件を満たすこと",
    "C-PERF":  "規定の応答時間内に処理されること",
    "C-COMPAT": "正しく表示・動作すること",
    "C-USAB":  "ユーザーが理解できる表示であること",
    "C-I18N":  "ロケール・文字コードが正しく処理されること",
    "C-DATA":  "データが正確に保存・記録されること",
    "C-CONC":  "データの整合性が維持されること",
}

# 技法が攻撃系・負荷系の場合はカテゴリに優先して上書き
_TECHNIQUE_EXPECTED = {
    "攻撃パターン": "攻撃が防御・拒否されること",
    "負荷":        "規定の負荷シナリオ内で正常動作すること",
    "同時実行":    "データの整合性が維持されること",
    "データ整合":  "データが正確に保存・記録されること",
}


def _expected_for(cat_code, technique):
    """カテゴリコードと技法名から期待結果の定型文を返す。"""
    if technique in _TECHNIQUE_EXPECTED:
        return _TECHNIQUE_EXPECTED[technique]
    return _CAT_EXPECTED.get(cat_code, "正しく動作すること")


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
            "expected": _expected_for(vp.category.code, vp.technique),
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
