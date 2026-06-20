"""ツールのビュー — tool_key ごとに実処理を振り分ける。

各ツールは GET でフォーム＋既定結果、POST で実行結果を返す。
計算は logic.py / engine.py の純粋関数に委譲し、ビューは入出力に専念する。
"""
import csv

from django.http import HttpResponse
from django.shortcuts import redirect, render

from catalog.nav import build_nav
from knowledge.models import Viewpoint, ViewpointCategory, DefectPattern
from knowledge import engine
from . import logic
from .models import Defect


def _base_ctx(service):
    return {"nav": build_nav(), "service": service,
            "active_slug": service.slug, "is_home": False}


def render_tool(request, service):
    handler = HANDLERS.get(service.tool_key)
    if handler is None:
        return render(request, "catalog/service_detail.html", _base_ctx(service))
    return handler(request, service)


# ── 1. ドキュメント検証 ──
_DOC_SAMPLE = """1. 目的
本システムは業務効率を可能な限り向上させることを目的とする。
2. 機能
ユーザーは適宜データを登録できる等、必要に応じて操作する。詳細はTBD。"""


def _doc_verify(request, service):
    text = request.POST.get("text") or _DOC_SAMPLE
    doc_type = request.POST.get("doc_type") or "general"
    result = logic.document_verify(text, doc_type)
    ctx = _base_ctx(service)
    ctx.update({"text": text, "doc_type": doc_type, "result": result})
    return render(request, "tools/doc_verify.html", ctx)


# ── 2. トレーサビリティ ──
_TR_REQ = "REQ-001, ログイン機能\nREQ-002, パスワード再設定\nREQ-003, 利用履歴の表示"
_TR_TEST = "TC-001, REQ-001, 正常ログイン\nTC-002, REQ-001, ロックアウト\nTC-003, REQ-009, 期限切れリンク"


def _traceability(request, service):
    req_text = request.POST.get("req_text") or _TR_REQ
    test_text = request.POST.get("test_text") or _TR_TEST
    result = logic.traceability(req_text, test_text)
    ctx = _base_ctx(service)
    ctx.update({"req_text": req_text, "test_text": test_text, "result": result})
    return render(request, "tools/traceability.html", ctx)


# ── 3. 計画策定 ──
def _test_plan(request, service):
    fields = ["name", "scope", "env", "start", "end", "entry", "exit", "risk"]
    data = {k: request.POST.get(k, "") for k in fields}
    if not any(data.values()):
        data = dict(name="新規ECサイト構築", scope="購入フロー（カート〜決済）",
                    env="ステージング環境 / Chrome・Safari", start="", end="",
                    entry="対象機能の結合完了",
                    exit="Critical/Major欠陥0件、テスト消化率100%",
                    risk="決済外部連携の遅延")
    markdown = logic.test_plan(data)
    if request.POST.get("download") == "1":
        resp = HttpResponse(markdown, content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=test_plan.md"
        return resp
    ctx = _base_ctx(service)
    ctx.update({"data": data, "markdown": markdown})
    return render(request, "tools/test_plan.html", ctx)


# ── 4. テスト設計（観点/BVA/同値/ペアワイズ） ──
def _test_design(request, service):
    mode = request.POST.get("mode") or request.GET.get("mode") or "vp"
    ctx = _base_ctx(service)
    ctx["mode"] = mode
    ctx["field_types"] = ["text", "number", "date", "select", "email", "file"]
    ctx["flag_choices"] = [
        ("auth", "認証あり"), ("integration", "外部連携あり"), ("money", "金額を扱う"),
        ("pii", "個人情報を扱う"), ("state", "状態遷移あり"),
        ("concurrent", "同時実行あり"), ("perf", "性能要件あり"),
    ]

    if mode == "bva":
        name = request.POST.get("name") or "年齢"
        mn = int(request.POST.get("min") or 18)
        mx = int(request.POST.get("max") or 65)
        ctx.update({"name": name, "min": mn, "max": mx,
                    "rows": logic.boundary_value_analysis(name, mn, mx)})
    elif mode == "ep":
        name = request.POST.get("name") or "数量"
        mn = int(request.POST.get("min") or 1)
        mx = int(request.POST.get("max") or 99)
        ctx.update({"name": name, "min": mn, "max": mx,
                    "rows": logic.equivalence_partitioning(name, mn, mx)})
    elif mode == "pw":
        raw = request.POST.get("pw_text") or "OS, Windows, macOS, Linux\nブラウザ, Chrome, Firefox, Safari\n権限, 管理者, 一般"
        ctx.update({"pw_text": raw, "pw": logic.pairwise(raw)})
    else:  # vp 観点ベース
        feature = request.POST.get("feature") or "ユーザー登録フォーム"
        industry = request.POST.get("industry") or ""
        if request.method == "POST":
            fnames = request.POST.getlist("field_name")
            ftypes = request.POST.getlist("field_type")
            fields = [{"name": n or "(無名)", "type": t}
                      for n, t in zip(fnames, ftypes) if n or t]
            flags = request.POST.getlist("flags")
        else:
            fields = [{"name": "メールアドレス", "type": "email"},
                      {"name": "年齢", "type": "number"},
                      {"name": "プロフィール", "type": "text"}]
            flags = []
        if not fields:
            fields = [{"name": "メールアドレス", "type": "email"}]
        ctx.update({"feature": feature, "industry": industry,
                    "fields": fields, "flags": flags,
                    "vp": engine.generate(feature, fields, flags, industry)})
    return render(request, "tools/test_design.html", ctx)


# ── 5. 欠陥管理（DB永続化） ──
def _defect_mgr(request, service):
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            title = (request.POST.get("title") or "").strip()
            if title:
                Defect.objects.create(
                    title=title,
                    severity=request.POST.get("severity") or "Major",
                    phase=request.POST.get("phase") or "システムテスト",
                    root_cause=request.POST.get("root_cause") or "実装誤り",
                    description=request.POST.get("description") or "")
        elif action == "delete":
            Defect.objects.filter(id=request.POST.get("id")).delete()
        elif action == "status":
            d = Defect.objects.filter(id=request.POST.get("id")).first()
            if d:
                d.status = request.POST.get("status") or d.status
                d.save(update_fields=["status"])
        elif action == "csv":
            return _defect_csv()
        return redirect(request.path)

    defects = list(Defect.objects.all())
    counts = {}
    for d in defects:
        counts[d.severity] = counts.get(d.severity, 0) + 1
    ctx = _base_ctx(service)
    ctx.update({"defects": defects, "counts": counts,
                "severities": Defect.SEVERITY_CHOICES, "phases": Defect.PHASE_CHOICES,
                "roots": Defect.ROOT_CHOICES, "statuses": Defect.STATUS_CHOICES})
    return render(request, "tools/defect_mgr.html", ctx)


def _defect_csv():
    resp = HttpResponse(content_type="text/csv; charset=utf-8-sig")
    resp["Content-Disposition"] = "attachment; filename=defects.csv"
    w = csv.writer(resp)
    w.writerow(["ID", "Severity", "タイトル", "検出フェーズ", "根本原因", "ステータス", "登録日", "概要"])
    for d in Defect.objects.all():
        w.writerow([d.code, d.severity, d.title, d.phase, d.root_cause,
                    d.status, d.created_at.strftime("%Y-%m-%d"), d.description])
    return resp


# ── 6. ROI計算機 ──
def _roi_calc(request, service):
    industry = request.POST.get("industry") or "saas"
    ind = logic.ROI_INDUSTRY.get(industry, logic.ROI_INDUSTRY["saas"])
    incidents = request.POST.get("incidents") or ind["incidents"]
    cost = request.POST.get("cost") or ind["cost"]
    method = request.POST.get("method") or "5"
    result = logic.roi_calc(incidents, cost, method)
    ctx = _base_ctx(service)
    ctx.update({"industry": industry, "incidents": int(incidents), "cost": int(cost),
                "method": method, "result": result,
                "industries": logic.ROI_INDUSTRY, "methods": logic.ROI_METHODS})
    return render(request, "tools/roi_calc.html", ctx)


# ── 7. テスト自動化 scaffold ──
def _test_auto(request, service):
    kind = request.POST.get("kind") or "ui"
    defaults = {"ui": ("https://example.com/login", "ログインボタン押下で /home へ遷移"),
                "api": ("https://api.example.com/health", "200"),
                "bat": ("./deploy.sh", "Deploy success")}
    p1 = request.POST.get("p1") or defaults[kind][0]
    p2 = request.POST.get("p2") or defaults[kind][1]
    code, fname = logic.test_auto(kind, p1, p2)
    if request.POST.get("download") == "1":
        resp = HttpResponse(code, content_type="text/plain; charset=utf-8")
        resp["Content-Disposition"] = f"attachment; filename={fname}"
        return resp
    ctx = _base_ctx(service)
    ctx.update({"kind": kind, "p1": p1, "p2": p2, "code": code, "fname": fname})
    return render(request, "tools/test_auto.html", ctx)


# ── 8. CI/CD構築 ──
def _cicd(request, service):
    runtime = request.POST.get("runtime") or "node"
    presets = {"node": "npm test", "python": "pytest", "java": "mvn test"}
    test_cmd = request.POST.get("test_cmd") or presets[runtime]
    deploy = request.POST.get("deploy") or "none"
    yml = logic.cicd(runtime, test_cmd, deploy)
    if request.POST.get("download") == "1":
        resp = HttpResponse(yml, content_type="text/yaml; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=ci.yml"
        return resp
    ctx = _base_ctx(service)
    ctx.update({"runtime": runtime, "test_cmd": test_cmd, "deploy": deploy, "yml": yml})
    return render(request, "tools/cicd.html", ctx)


# ── 9. 観点ライブラリ ──
def _viewpoint_kb(request, service):
    tab = request.GET.get("tab") or "browse"
    ctx = _base_ctx(service)
    ctx["tab"] = tab
    ctx["stats"] = {
        "viewpoints": Viewpoint.objects.count(),
        "categories": ViewpointCategory.objects.count(),
        "industries": Viewpoint.objects.filter(
            source_type=Viewpoint.SOURCE_INDUSTRY).values("source_key").distinct().count(),
        "defects": DefectPattern.objects.count(),
    }
    if tab == "defects":
        ctx["defect_patterns"] = DefectPattern.objects.select_related("category").all()
    elif tab == "coverage":
        cats = list(ViewpointCategory.objects.all())
        counts = {c.code: 0 for c in cats}
        for vp in Viewpoint.objects.all():
            counts[vp.category.code] = counts.get(vp.category.code, 0) + 1
        mx = max(counts.values()) if counts else 1
        ctx["coverage"] = [{"name": c.name, "count": counts[c.code],
                            "pct": round(counts[c.code] / mx * 100)} for c in cats]
        ctx["total_vp"] = Viewpoint.objects.count()
    else:
        q = (request.GET.get("q") or "").strip().lower()
        cat = request.GET.get("cat") or ""
        src = request.GET.get("src") or ""
        qs = Viewpoint.objects.select_related("category").all()
        if cat:
            qs = qs.filter(category__code=cat)
        if src:
            qs = qs.filter(source_type=src)
        items = []
        src_labels = dict(Viewpoint.SOURCE_CHOICES)
        for vp in qs:
            label = src_labels.get(vp.source_type, vp.source_type)
            if vp.source_key:
                label += f": {vp.source_key}"
            if q and q not in vp.viewpoint.lower() and q not in vp.technique.lower() and q not in label.lower():
                continue
            items.append({"vp": vp, "label": label})
        ctx.update({"items": items, "q": q, "cat": cat, "src": src,
                    "categories": ViewpointCategory.objects.all(),
                    "sources": Viewpoint.SOURCE_CHOICES})
    return render(request, "tools/viewpoint_kb.html", ctx)


HANDLERS = {
    "doc_verify": _doc_verify,
    "traceability": _traceability,
    "test_plan": _test_plan,
    "test_design": _test_design,
    "defect_mgr": _defect_mgr,
    "roi_calc": _roi_calc,
    "test_auto": _test_auto,
    "cicd": _cicd,
    "viewpoint_kb": _viewpoint_kb,
}
