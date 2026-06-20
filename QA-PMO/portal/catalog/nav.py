"""サイドナビ生成と統計のヘルパー。

全ビューで共通のサイドナビ（区分 › グループ › サービス）を組み立てる。
"""
from .models import Category, Service


def build_nav():
    """ナビ構造を返す。

    [{category, groups:[{name, services:[...]}], loose:[...直下サービス]}]
    """
    tree = []
    for cat in Category.objects.prefetch_related("groups", "services").all():
        services = list(cat.services.select_related("group").all())
        groups = []
        for grp in cat.groups.all():
            grp_services = [s for s in services if s.group_id == grp.id]
            if grp_services:
                groups.append({"name": grp.name, "services": grp_services})
        loose = [s for s in services if s.group_id is None]
        tree.append({"category": cat, "groups": groups, "loose": loose})
    return tree


def portal_stats():
    """TOPに出す統計値。"""
    total = Service.objects.count()
    tools = Service.objects.filter(kind=Service.KIND_TOOL).count()
    cats = Category.objects.count()
    return {"services": total, "tools": tools, "categories": cats}
