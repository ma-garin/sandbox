"""ツールのビュー — tool_key ごとに実処理を振り分ける。

各ツールは GET でフォーム＋既定結果、POST で実行結果を返す。
計算は logic.py / engine.py の純粋関数に委譲し、ビューは入出力に専念する。
"""
import csv
import io
import json

from django.http import HttpResponse
from django.shortcuts import redirect, render

from catalog.nav import build_nav
from knowledge.models import Viewpoint, ViewpointCategory, DefectPattern
from knowledge import engine
from . import logic, engines, maturity, nonfunc as nf, assessments, gen_engines_c as gec, gen_engines_a as gea, gen_engines_b as geb
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
    text = request.POST.get("text") or ""
    doc_type = request.POST.get("doc_type") or "general"
    pdf_note = ""
    # 提案A: PDFアップロード時は pdfplumber でテキスト抽出して検証
    upload = request.FILES.get("pdf")
    if upload is not None:
        extracted = engines.pdf_to_text(upload)
        if extracted:
            text = extracted
            pdf_note = f"PDF「{upload.name}」から {len(text)} 文字を抽出して検証しました。"
        else:
            pdf_note = f"PDF「{upload.name}」からテキストを抽出できませんでした（画像PDFの可能性）。"
    if not text:
        text = _DOC_SAMPLE
    result = logic.document_verify(text, doc_type)
    ctx = _base_ctx(service)
    ctx.update({"text": text, "doc_type": doc_type, "result": result, "pdf_note": pdf_note})
    if request.htmx:
        return render(request, "tools/_partials/doc_verify_result.html", ctx)
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
    if request.htmx:
        return render(request, "tools/_partials/traceability_result.html", ctx)
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
    dl = request.POST.get("download")
    if dl == "1":
        resp = HttpResponse(markdown, content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=test_plan.md"
        return resp
    if dl == "pdf":
        # 提案A: WeasyPrint で整形PDFを生成（不可なら Markdown にフォールバック）
        pdf = engines.markdown_to_pdf(markdown)
        if pdf is not None:
            resp = HttpResponse(pdf, content_type="application/pdf")
            resp["Content-Disposition"] = "attachment; filename=test_plan.pdf"
            return resp
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
        ("ai", "AI/生成AI機能"),
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
    elif mode == "st":
        raw = request.POST.get("st_text") or (
            "未ログイン, ログイン成功, ログイン済\nログイン済, ログアウト, 未ログイン\n"
            "ログイン済, タイムアウト, 未ログイン\n未ログイン, ログイン失敗3回, ロック")
        ctx.update({"st_text": raw, "st": logic.state_transition(raw)})
    elif mode == "dt":
        raw = request.POST.get("dt_text") or "会員である\n在庫がある\nクーポンを利用する"
        ctx.update({"dt_text": raw, "dt": logic.decision_table(raw)})
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
    # 田中さん（QAエンジニア）の動線: 生成した条件をチームのExcel/テスト管理へ移す
    if request.POST.get("export") == "csv":
        return _test_design_csv(mode, ctx)
    if request.htmx:
        return render(request, "tools/_partials/test_design_result.html", ctx)
    return render(request, "tools/test_design.html", ctx)


def _csv_response(filename, rows):
    """行リストをExcel互換CSV（UTF-8・BOMは先頭に1回だけ）で返す。"""
    buf = io.StringIO()
    w = csv.writer(buf)
    for row in rows:
        w.writerow(row)
    resp = HttpResponse("﻿" + buf.getvalue(),
                        content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f"attachment; filename={filename}"
    return resp


def _test_design_csv(mode, ctx):
    """テスト設計の生成結果をCSVで書き出す。"""
    if mode == "bva":
        rows = [["ID", "入力", "期待区分"]]
        rows += [[r["id"], r["input"], r["expected"]] for r in ctx["rows"]]
    elif mode == "ep":
        rows = [["ID", "入力", "クラス"]]
        rows += [[r["id"], r["input"], r["klass"]] for r in ctx["rows"]]
    elif mode == "pw":
        pw = ctx["pw"]
        if pw.get("error"):
            rows = [["エラー", pw["error"]]]
        else:
            rows = [pw["headers"]] + pw["rows"]
    elif mode == "st":
        st = ctx["st"]
        if st.get("error"):
            rows = [["エラー", st["error"]]]
        else:
            rows = [["種別", "ID", "開始状態", "イベント", "期待結果"]]
            rows += [["有効(0スイッチ)", v["id"], v["frm"], v["event"], v["expected"]]
                     for v in st["valid"]]
            rows += [["無効(異常系)", n["id"], n["frm"], n["event"], n["expected"]]
                     for n in st["invalid"]]
    elif mode == "dt":
        dt = ctx["dt"]
        if dt.get("error"):
            rows = [["エラー", dt["error"]]]
        else:
            rows = [["規則"] + dt["conditions"] + ["アクション(記入)"]]
            rows += [[r["no"]] + r["values"] + [r["action"]] for r in dt["rules"]]
    else:  # vp
        rows = [["ID", "対象", "テスト観点", "技法", "カテゴリ", "カテゴリ名", "期待結果", "根拠標準"]]
        rows += [[r["id"], r["target"], r["viewpoint"], r["technique"],
                  r["cat"], r["cat_name"], r["expected"], r.get("authority", "")]
                 for r in ctx["vp"]["rows"]]
    return _csv_response(f"test_design_{mode}.csv", rows)


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
    rows = [["ID", "Severity", "タイトル", "検出フェーズ", "根本原因", "ステータス", "登録日", "概要"]]
    for d in Defect.objects.all():
        rows.append([d.code, d.severity, d.title, d.phase, d.root_cause,
                     d.status, d.created_at.strftime("%Y-%m-%d"), d.description])
    return _csv_response("defects.csv", rows)


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
                "industries": logic.ROI_INDUSTRY, "methods": logic.ROI_METHODS,
                "chart_capture": _roi_chart_capture(result),
                "chart_leak": _roi_chart_leak(result)})
    if request.htmx:
        return render(request, "tools/_partials/roi_calc_result.html", ctx)
    return render(request, "tools/roi_calc.html", ctx)


def _roi_chart_capture(r):
    """バグ捕捉率の比較（Chart.js 棒グラフ設定）。"""
    cfg = {
        "type": "bar",
        "data": {"labels": ["現在の手法", "観点ライブラリ"],
                 "datasets": [{"label": "バグ捕捉率(%)",
                               "data": [r["current_pct"], r["vp_pct"]],
                               "backgroundColor": ["#9aa7b8", "#1a3a6b"]}]},
        "options": {"responsive": True, "maintainAspectRatio": False,
                    "scales": {"y": {"beginAtZero": True, "max": 100,
                                     "title": {"display": True, "text": "捕捉率 (%)"}}},
                    "plugins": {"legend": {"display": False},
                                "title": {"display": True, "text": "バグ捕捉率の比較"}}},
    }
    return json.dumps(cfg, ensure_ascii=False)


def _roi_chart_leak(r):
    """年間の漏れコスト比較（Chart.js 棒グラフ設定）。"""
    cfg = {
        "type": "bar",
        "data": {"labels": ["現在の手法", "観点ライブラリ"],
                 "datasets": [{"label": "年間漏れコスト(万円)",
                               "data": [r["leak_current"], r["leak_vp"]],
                               "backgroundColor": ["#c0392b", "#1f9d63"]}]},
        "options": {"responsive": True, "maintainAspectRatio": False,
                    "scales": {"y": {"beginAtZero": True,
                                     "title": {"display": True, "text": "万円 / 年"}}},
                    "plugins": {"legend": {"display": False},
                                "title": {"display": True, "text": "障害見逃しコストの比較"}}},
    }
    return json.dumps(cfg, ensure_ascii=False)


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


# ── 10. 品質プロセス成熟度アセスメント（TMMi準拠） ──
def _maturity(request, service):
    """シニアQAコンサルの成熟度診断を codify したツール。

    回答（各設問0〜3）→領域別スコア・成熟度レベル・ギャップ・改善ロードマップ。
    """
    qkeys = maturity.question_keys()
    if request.method == "POST":
        responses = {qk["name"]: request.POST.get(qk["name"], 0) for qk in qkeys}
    else:
        # 初期表示はサンプル（全設問「部分的=1」）でレーダーが描ける状態にする
        responses = maturity.blank_responses(default=1)
    result = maturity.assess(responses)

    # 設問を領域ごとにまとめてテンプレートへ（現在値を保持）
    areas_form = []
    for area in maturity.MODEL:
        qs = []
        for i, q in enumerate(area["questions"]):
            name = f"q_{area['code']}_{i}"
            qs.append({"name": name, "label": q,
                       "value": int(responses.get(name, 0) or 0)})
        areas_form.append({"code": area["code"], "name": area["name"],
                           "level": area["level"], "questions": qs})

    ctx = _base_ctx(service)
    ctx.update({"result": result, "areas_form": areas_form,
                "scale": maturity.SCALE,
                "chart_json": json.dumps(result["chart"], ensure_ascii=False)})

    if request.POST.get("export") == "csv":
        return _maturity_csv(result)
    if request.htmx:
        return render(request, "tools/_partials/maturity_result.html", ctx)
    return render(request, "tools/maturity.html", ctx)


def _maturity_csv(result):
    rows = [["品質プロセス成熟度アセスメント結果"]]
    rows.append(["総合成熟度レベル", result["overall_level"], result["overall_level_name"]])
    rows.append(["総合スコア(%)", result["overall_score"]])
    rows.append([])
    rows.append(["領域", "TMMiレベル", "スコア(%)", "達成基準(85%)"])
    for a in result["areas"]:
        rows.append([a["name"], a["level"], a["score"],
                     "達成" if a["satisfied"] else "未達"])
    rows.append([])
    rows.append(["改善ロードマップ（着手順）"])
    rows.append(["優先度", "領域", "目標レベル", "現状(%)", "改善アクション"])
    for r in result["roadmap"]:
        rows.append([r["priority"], r["area"], r["level"], r["score"],
                     " / ".join(r["actions"])])
    return _csv_response("maturity_assessment.csv", rows)


# ── 11. 非機能テスト観点ジェネレータ（ISO/IEC 25010:2023） ──
def _nonfunc(request, service):
    """ISO/IEC 25010:2023 の9特性に準拠した非機能テスト観点を生成する。

    選択した品質特性・SLAパラメータから観点・技法・合否基準・根拠標準を生成。
    ペルソナ: ISTQB AL Technical Test Analyst（非機能テスト設計担当）。
    """
    all_codes = [c["code"] for c in nf.CHARS]
    selected = request.POST.getlist("chars") or all_codes[:3]
    sla_uptime = request.POST.get("sla_uptime") or "99.9"
    try:
        sla_resp_ms = int(request.POST.get("sla_resp_ms") or 3000)
    except ValueError:
        sla_resp_ms = 3000

    result = nf.generate(selected, sla_uptime, sla_resp_ms)

    ctx = _base_ctx(service)
    ctx.update({
        "chars": nf.CHARS,
        "system_types": nf.SYSTEM_TYPES,
        "selected": selected,
        "sla_uptime": sla_uptime,
        "sla_resp_ms": sla_resp_ms,
        "result": result,
    })

    if request.POST.get("export") == "csv":
        return _nonfunc_csv(result)
    if request.htmx:
        return render(request, "tools/_partials/nonfunc_result.html", ctx)
    return render(request, "tools/nonfunc.html", ctx)


def _nonfunc_csv(result):
    rows = [["非機能テスト観点リスト（ISO/IEC 25010:2023）"]]
    rows.append([f"生成件数: {result['total']}件"])
    rows.append([])
    rows.append(["ID", "品質特性", "サブ特性", "テスト観点", "技法", "合否基準（期待結果）", "根拠標準"])
    for r in result["rows"]:
        rows.append([
            r["id"], r["char_name"], r["sub_name"],
            r["viewpoint"], r["technique"], r["expected"], r["authority"],
        ])
    return _csv_response("nonfunc_viewpoints.csv", rows)


# ── 12〜19. 汎用アセスメント（TPI Next / QA4AI / 生成AI / Web脆弱性 / 組込みSec /
#            組込み検証 / 品質コンサル診断 / セキュリティ習熟度） ──
def _assessment(request, service):
    """単一エンジンで複数のアセスメント系ツールを駆動する。

    service.tool_key から assessments.MODELS のモデルを引き当て、
    回答（各項目0〜3）→ 領域別スコア・バンド判定・優先度付き改善提案を生成。
    AIなし・外部依存なし・完全再現可能。AI採点への換装も呼び出し側は不変。
    """
    model = assessments.get_model(service.tool_key)
    if model is None:
        return render(request, "catalog/service_detail.html", _base_ctx(service))

    keys = assessments.item_keys(model)
    if request.method == "POST":
        responses = {k["name"]: request.POST.get(k["name"], 0) for k in keys}
    else:
        responses = assessments.blank_responses(model, default=1)
    result = assessments.assess(model, responses)

    # 設問を領域ごとにまとめる（現在値を保持）
    areas_form = []
    for area in model["areas"]:
        qs = []
        for i, item in enumerate(area["items"]):
            name = f"a_{area['code']}_{i}"
            qs.append({"name": name, "label": item["q"],
                       "value": int(responses.get(name, 0) or 0)})
        areas_form.append({"code": area["code"], "name": area["name"],
                           "authority": area["authority"], "questions": qs})

    ctx = _base_ctx(service)
    ctx.update({"model": model, "result": result, "areas_form": areas_form,
                "scale": assessments.scale_of(model),
                "chart_json": json.dumps(result["chart"], ensure_ascii=False)})

    if request.POST.get("export") == "csv":
        return _assessment_csv(model, result)
    if request.htmx:
        return render(request, "tools/_partials/assessment_result.html", ctx)
    return render(request, "tools/assessment.html", ctx)


def _assessment_csv(model, result):
    rows = [[model["title"]]]
    rows.append(["準拠/出典", model["standard"]])
    rows.append([model["band_label"], result["band"]["label"], f'{result["overall_score"]}%'])
    rows.append([])
    rows.append(["領域", "スコア(%)", "判定", "根拠標準"])
    for a in result["areas"]:
        rows.append([a["name"], a["score"], "良好" if a["satisfied"] else "要改善", a["authority"]])
    rows.append([])
    rows.append(["優先度付き改善提案"])
    rows.append(["優先度", "領域", "項目", "現状", "改善アクション", "出典"])
    for r in result["recommendations"]:
        rows.append([r["priority"], r["area"], r["q"], r["value"], r["fix"], r["authority"]])
    return _csv_response(f"{model['key']}_assessment.csv", rows)


# ── 12a. テストケース生成エージェント（TESTRA / gen_engines_a） ──

_TC_TYPE_CHOICES = [
    ("func", "機能テスト"),
    ("boundary", "境界値テスト"),
    ("exception", "例外・異常系"),
    ("state", "状態遷移テスト"),
    ("security", "セキュリティテスト"),
    ("perf", "性能テスト"),
]

_AREA_CHOICES = [
    ("func", "機能"),
    ("boundary", "境界値"),
    ("ux", "UX/ユーザビリティ"),
    ("security", "セキュリティ"),
    ("perf", "性能"),
    ("integration", "統合/連携"),
    ("data", "データ整合性"),
]

_TESTRA_SAMPLE_SPEC = """ユーザーはメールアドレスとパスワードでログインできる。
パスワードを5回連続で誤入力するとアカウントがロックされる。
ロック解除は管理者またはメール認証で行う。
セッションは30分操作がないと自動タイムアウトする。"""


def _testra(request, service):
    spec_text = request.POST.get("spec_text") or _TESTRA_SAMPLE_SPEC
    feature_name = request.POST.get("feature_name") or "ユーザーログイン機能"
    test_types = request.POST.getlist("test_types") or ["func", "boundary", "exception"]

    result = gea.spec_to_tc(spec_text, feature_name, test_types)

    if request.POST.get("export") == "csv":
        rows = [["ID", "種別", "優先度", "タイトル", "前提条件", "手順", "テストデータ", "根拠"]]
        for tc in result.get("cases", []):
            steps_text = " / ".join(f"{s['action']}→{s['expected']}" for s in tc["steps"])
            rows.append([tc["id"], tc["type"], tc["priority"], tc["title"],
                         tc["precondition"], steps_text, tc.get("test_data", ""), tc.get("authority", "")])
        return _csv_response("testcases.csv", rows)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "spec_text": spec_text,
        "feature_name": feature_name, "selected_types": test_types,
        "test_type_choices": _TC_TYPE_CHOICES,
    })
    if request.htmx:
        return render(request, "tools/_partials/testra_result.html", ctx)
    return render(request, "tools/testra.html", ctx)


def _exploratory(request, service):
    feature = request.POST.get("feature") or "ユーザー登録フォーム"
    time_budget_min = int(request.POST.get("time_budget_min") or 120)
    areas = request.POST.getlist("areas") or ["func", "boundary", "ux"]
    risk_level = request.POST.get("risk_level") or "medium"

    result = gea.exploratory_charters(feature, time_budget_min, areas, risk_level)

    if request.POST.get("export") == "csv":
        rows = [["ID", "ミッション", "領域", "時間(分)", "優先度", "フォーカス", "ヒント", "合否基準"]]
        for ch in result.get("charters", []):
            rows.append([ch["id"], ch["mission"], ch["area"], ch["duration_min"],
                         ch["priority"], " / ".join(ch["focus"]),
                         " / ".join(ch["hints"]), ch["oracle"]])
        return _csv_response("exploratory_charters.csv", rows)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "feature": feature,
        "time_budget_min": time_budget_min, "selected_areas": areas,
        "risk_level": risk_level, "area_choices": _AREA_CHOICES,
    })
    if request.htmx:
        return render(request, "tools/_partials/exploratory_result.html", ctx)
    return render(request, "tools/exploratory.html", ctx)


# ── 12b. QA文書スイートジェネレータ（ISO 29119準拠） ──
_DEFAULT_PHASES_EXEC = [
    {"name": "結合テスト", "planned": 120, "executed": 0, "passed": 0, "failed": 0, "blocked": 0},
    {"name": "システムテスト", "planned": 300, "executed": 0, "passed": 0, "failed": 0, "blocked": 0},
    {"name": "回帰テスト", "planned": 80, "executed": 0, "passed": 0, "failed": 0, "blocked": 0},
]

_DOMAINS = {
    "process": "テストプロセス標準化",
    "metrics": "メトリクス・可視化",
    "automation": "テスト自動化・CI",
    "culture": "品質文化・人材育成",
}


def _qa_planning(request, service):
    doc_type = request.POST.get("doc_type") or "test_plan"
    project_name = request.POST.get("project_name") or ""
    scope = request.POST.get("scope") or ""
    start_date = request.POST.get("start_date") or ""
    end_date = request.POST.get("end_date") or ""
    entry_criteria = request.POST.get("entry_criteria") or ""
    exit_criteria = request.POST.get("exit_criteria") or ""
    risks = request.POST.get("risks") or ""
    team_size = request.POST.get("team_size") or "2"

    result = gec.qa_planning_generate(
        doc_type, project_name, scope, start_date, end_date,
        entry_criteria, exit_criteria, risks, team_size)

    if request.POST.get("download") == "md":
        resp = HttpResponse(result["markdown"],
                            content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = f"attachment; filename={result['doc_id']}.md"
        return resp

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "doc_type": doc_type, "project_name": project_name,
        "scope": scope, "start_date": start_date, "end_date": end_date,
        "entry_criteria": entry_criteria, "exit_criteria": exit_criteria,
        "team_size": team_size, "doc_types": gec.DOC_TYPES,
    })
    if request.htmx:
        return render(request, "tools/_partials/qa_planning_result.html", ctx)
    return render(request, "tools/qa_planning.html", ctx)


def _project_tools(request, service):
    project_name = request.POST.get("project_name") or ""
    start_date = request.POST.get("start_date") or ""
    end_date = request.POST.get("end_date") or ""
    phases_text = request.POST.get("phases_text") or ""
    risks_text = request.POST.get("risks_text") or ""

    result = gec.project_tools_generate(project_name, start_date, end_date, phases_text, risks_text)

    if request.POST.get("export") == "csv":
        rows = [["WBS", "No", "タスク名", "開始", "終了", "日数", "担当"]]
        for ph in result["wbs"]:
            rows.append([ph["no"], ph["level"], ph["name"], ph["start"], ph["end"], ph["duration"], ph["owner"]])
            for sub in ph["subtasks"]:
                rows.append(["", sub["no"], sub["name"], sub["start"], sub["end"], sub["duration"], ""])
        rows.append([])
        rows.append(["リスクID", "リスク名", "カテゴリ", "影響度", "発生率", "優先度", "対策", "担当", "ステータス"])
        for r in result["risks"]:
            rows.append([r["id"], r["name"], r["category"], r["impact"], r["probability"], r["priority"], r["mitigation"], r["owner"], r["status"]])
        return _csv_response("wbs_risk.csv", rows)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "project_name": project_name,
        "start_date": start_date, "end_date": end_date, "risks_text": risks_text,
    })
    if request.htmx:
        return render(request, "tools/_partials/project_tools_result.html", ctx)
    return render(request, "tools/project_tools.html", ctx)


def _quality_roadmap(request, service):
    scores = {d: int(request.POST.get(d) or 1) for d in _DOMAINS}
    horizon_months = request.POST.get("horizon_months") or "6"
    goals_raw = request.POST.get("goals") or ""
    goals = [g.strip() for g in goals_raw.splitlines() if g.strip()]

    result = gec.quality_roadmap_generate(scores, goals, horizon_months)

    if request.POST.get("export") == "csv":
        rows = [["品質改善ロードマップ"]]
        rows.append(["フェーズ", "アクションID", "領域", "アクション", "目安期間", "効果"])
        for phase in result["roadmap"]:
            for a in phase["actions"]:
                rows.append([phase["phase"], a["id"], a["domain"], a["action"], a["timing"], a["effect"]])
        rows.append([])
        rows.append(["KPI", "現状", "目標", "期限"])
        for k in result["kpis"]:
            rows.append([k["kpi"], k["current"], k["target"], k["when"]])
        return _csv_response("quality_roadmap.csv", rows)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "domains": _DOMAINS,
        "scores": scores, "horizon_months": horizon_months, "goals": goals_raw,
    })
    if request.htmx:
        return render(request, "tools/_partials/quality_roadmap_result.html", ctx)
    return render(request, "tools/quality_roadmap.html", ctx)


_EDU_SCALE = [(0, "未学習"), (1, "理解"), (2, "実践")]


def _edu_assess(request, service):
    target_cert = request.POST.get("target_cert") or "FL"
    keys = gec.edu_item_keys()
    if request.method == "POST":
        responses = {k["name"]: int(request.POST.get(k["name"]) or 0) for k in keys}
    else:
        responses = {k["name"]: 0 for k in keys}

    result = gec.edu_assess(responses, target_cert)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "target_cert": target_cert,
        "istqb_topics": gec.ISTQB_TOPICS, "edu_scale": _EDU_SCALE,
    })
    if request.htmx:
        return render(request, "tools/_partials/edu_assess_result.html", ctx)
    return render(request, "tools/edu_assess.html", ctx)


def _impl_tracker(request, service):
    tasks_text = request.POST.get("tasks_text") or ""
    project_name = request.POST.get("project_name") or ""

    result = gec.impl_tracker_process(tasks_text, project_name)

    if request.POST.get("export") == "csv":
        rows = [["ID", "タスク名", "担当者", "ステータス", "期日", "期日超過"]]
        for t in result["tasks"]:
            rows.append([t["id"], t["name"], t["owner"], t["status"], t["due"], "超過" if t["is_late"] else ""])
        return _csv_response("impl_tracker.csv", rows)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "tasks_text": tasks_text, "project_name": project_name,
        "default_tasks_text": "テスト計画書作成, QAリード, 完了, \nテスト環境構築, インフラ, 進行中, \nテストケース設計, QAチーム, 進行中, ",
    })
    if request.htmx:
        return render(request, "tools/_partials/impl_tracker_result.html", ctx)
    return render(request, "tools/impl_tracker.html", ctx)


def _parse_phases_post(request):
    """POST からフェーズ行を読み取る（test_exec / test_outsource 共通）。"""
    names = request.POST.getlist("phase_name")
    planneds = request.POST.getlist("planned")
    executeds = request.POST.getlist("executed")
    passeds = request.POST.getlist("passed")
    faileds = request.POST.getlist("failed")
    blockeds = request.POST.getlist("blocked")
    phases = []
    for i, name in enumerate(names):
        if not name:
            continue
        phases.append({
            "name": name,
            "planned": int(planneds[i] or 0) if i < len(planneds) else 0,
            "executed": int(executeds[i] or 0) if i < len(executeds) else 0,
            "passed": int(passeds[i] or 0) if i < len(passeds) else 0,
            "failed": int(faileds[i] or 0) if i < len(faileds) else 0,
            "blocked": int(blockeds[i] or 0) if i < len(blockeds) else 0,
        })
    return phases


def _test_exec(request, service):
    if request.method == "POST":
        phases_data = _parse_phases_post(request)
    else:
        phases_data = None

    result = gec.test_exec_dashboard(phases_data)

    ctx = _base_ctx(service)
    ctx.update({
        "result": result,
        "default_phases": result["phases"] if phases_data else _DEFAULT_PHASES_EXEC,
    })
    if request.htmx:
        return render(request, "tools/_partials/test_exec_result.html", ctx)
    return render(request, "tools/test_exec.html", ctx)


def _test_outsource(request, service):
    project_name = request.POST.get("project_name") or ""
    client_name = request.POST.get("client_name") or ""
    defects_text = request.POST.get("defects_text") or ""

    if request.method == "POST":
        phases_data = _parse_phases_post(request)
    else:
        phases_data = None

    result = gec.test_outsource_tracker(project_name, client_name, phases_data, defects_text)

    if request.POST.get("download") == "md":
        resp = HttpResponse(result["report_md"],
                            content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=test_summary_report.md"
        return resp

    ctx = _base_ctx(service)
    ctx.update({
        "result": result, "project_name": project_name, "client_name": client_name,
        "defects_text": defects_text,
        "default_phases": result["dashboard"]["phases"] if phases_data
                         else _DEFAULT_PHASES_EXEC,
    })
    if request.htmx:
        return render(request, "tools/_partials/test_outsource_result.html", ctx)
    return render(request, "tools/test_outsource.html", ctx)


# ── gen_engines_b: 静的解析・OSSリスク・負荷テスト・SAPシナリオ ──

_SCOPE_CHOICES = [
    ("happy_path", "ハッピーパス"),
    ("regression", "回帰テスト"),
    ("data_migration", "データ移行検証"),
    ("integration", "統合テスト"),
    ("performance", "性能テスト"),
    ("authorization", "認可テスト"),
]


def _static_analysis(request, service):
    code_text = request.POST.get("code_text") or ""
    language = request.POST.get("language") or "python"
    result = None
    if request.method == "POST" and code_text.strip():
        result = geb.static_code_analysis(code_text, language)
        if request.POST.get("export") == "csv" and result:
            rows = [["ID", "重大度", "行", "カテゴリ", "メッセージ", "修正案"]]
            for f in result.get("findings", []):
                rows.append([f["id"], f["severity"], f.get("line", ""),
                             f.get("category", ""), f["message"], f.get("fix", "")])
            return _csv_response("static_analysis.csv", rows)
    ctx = _base_ctx(service)
    ctx.update({"result": result, "code_text": code_text, "language": language})
    if request.htmx:
        return render(request, "tools/_partials/static_analysis_result.html", ctx)
    return render(request, "tools/static_analysis.html", ctx)


def _oss_risk(request, service):
    dependency_text = request.POST.get("dependency_text") or ""
    ecosystem = request.POST.get("ecosystem") or "python"
    result = None
    if request.method == "POST" and dependency_text.strip():
        result = geb.oss_risk_calc(dependency_text, ecosystem)
        if request.POST.get("export") == "csv" and result:
            rows = [["パッケージ", "バージョン", "ライセンス", "総合リスク", "ライセンスリスク", "保守リスク", "備考"]]
            for p in result.get("packages", []):
                rows.append([p["name"], p["version"], p["license"],
                             p.get("overall_risk", ""), p.get("license_risk", ""),
                             p.get("maintenance_risk", ""), p.get("notes", "")])
            return _csv_response("oss_risk.csv", rows)
    ctx = _base_ctx(service)
    ctx.update({"result": result, "dependency_text": dependency_text, "ecosystem": ecosystem})
    if request.htmx:
        return render(request, "tools/_partials/oss_risk_result.html", ctx)
    return render(request, "tools/oss_risk.html", ctx)


def _load_test(request, service):
    system_type = request.POST.get("system_type") or "web"
    protocol = request.POST.get("protocol") or "https"
    concurrent_users = int(request.POST.get("concurrent_users") or 500)
    sla_resp_ms = int(request.POST.get("sla_resp_ms") or 2000)
    sla_tps = int(request.POST.get("sla_tps") or 100)
    duration_min = int(request.POST.get("duration_min") or 30)
    result = geb.load_test_gen(system_type, concurrent_users, sla_resp_ms, sla_tps, duration_min, protocol)
    if request.POST.get("export") == "csv":
        rows = [["ID", "種別", "シナリオ名", "ユーザー数", "ランプアップ(分)", "実行時間(分)", "目標TPS", "合否基準", "優先度"]]
        for s in result.get("scenarios", []):
            rows.append([s["id"], s["type"], s["name"], s["users"], s["ramp_up_min"],
                         s["duration_min"], s["target_tps"], s["acceptance_criteria"], s["priority"]])
        return _csv_response("load_test.csv", rows)
    ctx = _base_ctx(service)
    ctx.update({"result": result, "system_type": system_type, "protocol": protocol,
                "concurrent_users": concurrent_users, "sla_resp_ms": sla_resp_ms,
                "sla_tps": sla_tps, "duration_min": duration_min})
    if request.htmx:
        return render(request, "tools/_partials/load_test_result.html", ctx)
    return render(request, "tools/load_test.html", ctx)


def _sap_verify(request, service):
    module = request.POST.get("module") or "FI"
    process = request.POST.get("process") or ""
    selected_scope = request.POST.getlist("scope") or ["happy_path", "regression", "authorization"]
    result = None
    if request.method == "POST":
        result = geb.sap_scenario_gen(module, process, selected_scope)
        if request.POST.get("export") == "csv" and result:
            rows = [["ID", "タイトル", "範囲", "Tコード", "優先度", "前提条件", "ステップ数"]]
            for sc in result.get("scenarios", []):
                rows.append([sc["id"], sc["title"], sc["scope_type"], sc["t_code"],
                             sc["priority"], sc["precondition"], len(sc.get("steps", []))])
            return _csv_response("sap_verify.csv", rows)
    ctx = _base_ctx(service)
    ctx.update({"result": result, "module": module, "process": process,
                "selected_scope": selected_scope, "scope_choices": _SCOPE_CHOICES})
    if request.htmx:
        return render(request, "tools/_partials/sap_verify_result.html", ctx)
    return render(request, "tools/sap_verify.html", ctx)


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
    "maturity": _maturity,
    "nonfunc": _nonfunc,
    # gen_engines_a: テストケース生成・探索的テスト（2ツール）
    "testra": _testra,
    "exploratory": _exploratory,
    # gen_engines_c: 文書・計画・ロードマップ系（7ツール）
    "qa_planning": _qa_planning,
    "project_tools": _project_tools,
    "quality_roadmap": _quality_roadmap,
    "edu_assess": _edu_assess,
    "impl_tracker": _impl_tracker,
    "test_exec": _test_exec,
    "test_outsource": _test_outsource,
    # gen_engines_b: 静的解析・OSSリスク・負荷テスト・SAPシナリオ（4ツール）
    "static_analysis": _static_analysis,
    "oss_risk": _oss_risk,
    "load_test": _load_test,
    "sap_verify": _sap_verify,
    # 汎用アセスメント（8ツールを単一エンジンで駆動）
    "tpi_next": _assessment,
    "qa4ai": _assessment,
    "genai_qa": _assessment,
    "vuln_web": _assessment,
    "vuln_embedded": _assessment,
    "embedded_verify": _assessment,
    "consultant": _assessment,
    "sec_training": _assessment,
}
