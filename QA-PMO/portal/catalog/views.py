"""カタログのビュー — TOP（ホーム）とサービス詳細。"""
from django.shortcuts import render, get_object_or_404

from .models import Category, Service
from .nav import build_nav, portal_stats


def home(request):
    """TOPページ。区分ごとにサービスカードを並べる。"""
    categories = Category.objects.prefetch_related("services").all()
    cats = []
    for c in categories:
        cats.append({"obj": c, "services": list(c.services.all())})
    ctx = {
        "nav": build_nav(),
        "categories": cats,
        "stats": portal_stats(),
        "active_slug": None,
        "is_home": True,
    }
    return render(request, "catalog/home.html", ctx)


def service_detail(request, slug):
    """サービス詳細。tool は専用画面へ振り分け、catalog は解説を表示。"""
    service = get_object_or_404(Service.objects.select_related("category", "group"), slug=slug)
    if service.is_tool and service.tool_key:
        from tools.views import render_tool
        return render_tool(request, service)
    ctx = {
        "nav": build_nav(),
        "service": service,
        "active_slug": slug,
        "is_home": False,
    }
    return render(request, "catalog/service_detail.html", ctx)


def search(request):
    """サービス横断検索（名称・概要・タグ・製品名）。"""
    q = (request.GET.get("q") or "").strip()
    results = []
    if q:
        ql = q.lower()
        for s in Service.objects.select_related("category").all():
            hay = " ".join([s.title, s.summary, s.product, " ".join(s.tags)]).lower()
            if ql in hay:
                results.append(s)
    ctx = {
        "nav": build_nav(),
        "q": q,
        "results": results,
        "active_slug": None,
        "is_home": False,
    }
    return render(request, "catalog/search.html", ctx)
