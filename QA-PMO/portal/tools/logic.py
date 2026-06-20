"""ツールの計算ロジック（AIなし・決定的アルゴリズム）。

静的版 tools.js を Python へ移植したもの。
各関数は素の Python 型を受け取り、テンプレートで描画しやすい dict/list を返す。
ビュー層から独立した純粋関数なので、単体テストが容易（QAグレード）。
"""
import re

from . import engines


# ─────────────────────────────────────────────
# 1. 境界値分析（Boundary Value Analysis）
# ─────────────────────────────────────────────
def boundary_value_analysis(name, mn, mx):
    name = name or "項目"
    cases = [
        (mn - 1, "無効（下限未満）"),
        (mn, "有効（下限）"),
        (mn + 1, "有効（下限+1）"),
        (mx - 1, "有効（上限-1）"),
        (mx, "有効（上限）"),
        (mx + 1, "無効（上限超）"),
    ]
    return [
        {"id": f"BVA-{i + 1}", "input": f"{name} = {val}", "expected": label}
        for i, (val, label) in enumerate(cases)
    ]


# ─────────────────────────────────────────────
# 2. 同値分割（Equivalence Partitioning）
# ─────────────────────────────────────────────
def equivalence_partitioning(name, mn, mx):
    name = name or "項目"
    nominal = (mn + mx) // 2
    cases = [
        (f"{mn}〜{mx}（代表値 {nominal}）", "有効同値クラス"),
        (f"{mn - 1}", "無効同値クラス（小さすぎ）"),
        (f"{mx + 1}", "無効同値クラス（大きすぎ）"),
    ]
    return [
        {"id": f"EP-{i + 1}", "input": f"{name} = {val}", "klass": label}
        for i, (val, label) in enumerate(cases)
    ]


# ─────────────────────────────────────────────
# 3. ペアワイズ（all-pairs 貪欲法）
# ─────────────────────────────────────────────
def _all_pairs(params):
    """params: [{"name": str, "values": [..]}] → 全ペアを網羅する最小ケース集合。"""
    n = len(params)

    def key(i, j, a, b):
        return (i, j, a, b)

    covered = set()
    all_keys = []
    for i in range(n):
        for j in range(i + 1, n):
            for a in params[i]["values"]:
                for b in params[j]["values"]:
                    all_keys.append(key(i, j, a, b))

    cases = []
    guard = 0
    while any(k not in covered for k in all_keys) and guard < 2000:
        guard += 1
        test = [None] * n
        seed = next(k for k in all_keys if k not in covered)
        si, sj, sa, sb = seed
        test[si], test[sj] = sa, sb
        for k in range(n):
            if test[k] is not None:
                continue
            best, best_score = params[k]["values"][0], -1
            for val in params[k]["values"]:
                score = 0
                for m in range(n):
                    if m == k or test[m] is None:
                        continue
                    i2, j2 = min(k, m), max(k, m)
                    a2 = val if i2 == k else test[m]
                    b2 = val if j2 == k else test[m]
                    if key(i2, j2, a2, b2) not in covered:
                        score += 1
                if score > best_score:
                    best_score, best = score, val
            test[k] = best
        for i in range(n):
            for j in range(i + 1, n):
                covered.add(key(i, j, test[i], test[j]))
        cases.append(test)
    return cases


def pairwise(raw_text):
    """1行に「パラメータ名, 値1, 値2, ...」形式のテキストを受け取る。"""
    params = []
    for line in raw_text.splitlines():
        parts = [s.strip() for s in line.split(",") if s.strip()]
        if len(parts) >= 2:
            params.append({"name": parts[0], "values": parts[1:]})
    if len(params) < 2:
        return {"error": "2つ以上のパラメータが必要です。", "headers": [], "rows": [], "params": params}

    # 提案A: まず実績OSS allpairspy（PICT系）を試し、無ければ純Python貪欲法へ
    cases = engines.pairwise_cases(params)
    engine_name = "allpairspy"
    if cases is None:
        cases = _all_pairs(params)
        engine_name = "builtin"
    total = 1
    for p in params:
        total *= len(p["values"])
    headers = ["ID"] + [p["name"] for p in params]
    rows = [[f"PW-{i + 1}"] + case for i, case in enumerate(cases)]
    return {"error": "", "headers": headers, "rows": rows,
            "count": len(cases), "total": total, "params": params,
            "engine": engine_name}


# ─────────────────────────────────────────────
# 4. トレーサビリティ（RTM）
# ─────────────────────────────────────────────
def traceability(req_text, test_text):
    reqs = {}
    for line in req_text.splitlines():
        p = line.split(",")
        if p and p[0].strip():
            reqs[p[0].strip()] = (p[1].strip() if len(p) > 1 else "")

    tests = []
    for line in test_text.splitlines():
        p = line.split(",")
        if not p or not p[0].strip():
            continue
        links = [s.strip() for s in (p[1] if len(p) > 1 else "").split(";") if s.strip()]
        tests.append({"id": p[0].strip(), "links": links,
                      "name": (p[2].strip() if len(p) > 2 else "")})

    cov = {r: [] for r in reqs}
    orphans = []
    for t in tests:
        matched = False
        for r in t["links"]:
            if r in cov:
                cov[r].append(t["id"])
                matched = True
        if not matched:
            orphans.append(t)

    uncovered = [r for r in reqs if not cov[r]]
    coverage = round((len(reqs) - len(uncovered)) / len(reqs) * 100) if reqs else 0

    matrix = [{"req": r, "name": reqs[r], "tests": cov[r]} for r in reqs]
    gaps = []
    for r in uncovered:
        gaps.append({"sev": "Major", "msg": f"要件 {r}（{reqs[r]}）にテストが存在しない"})
    for t in orphans:
        gaps.append({"sev": "Minor",
                     "msg": f"テスト {t['id']} が未登録要件（{','.join(t['links']) or 'なし'}）を参照"})
    return {"coverage": coverage, "matrix": matrix, "gaps": gaps,
            "n_req": len(reqs), "n_test": len(tests),
            "n_uncovered": len(uncovered), "n_orphan": len(orphans)}


# ─────────────────────────────────────────────
# 5. ドキュメント検証（ルールベース校正）
# ─────────────────────────────────────────────
_AMBIGUOUS = [
    (r"TBD|未定|要検討|追って|別途|可及的", "Major", "未確定・先送り表現"),
    (r"適宜|随時|なるべく|可能な限り|極力|柔軟に|臨機応変|必要に応じて", "Minor", "あいまいな程度表現"),
    (r"など|その他|(?<![平均同高対上初中本])等(?=[、。\sのをがにはでや）)]|$)", "Minor", "列挙の不完全（範囲が曖昧）"),
    (r"基本的に|原則|一般的に", "Minor", "例外が不明確な表現"),
    (r"と思われる|はずである|だろう|可能性がある", "Minor", "推量・非断定表現"),
]
_DOC_TYPE_RULES = {
    "general": {"label": "汎用", "required": ["目的", "範囲", "前提", "受入基準"], "extra": []},
    "requirements": {
        "label": "要件定義書",
        "required": ["目的", "範囲", "前提", "受入基準", "ステークホルダー"],
        "extra": [
            (r"するものとする|することができる|してもよい", "Minor", "要件の義務度が不明確（MUST/SHOULDで明示を推奨）"),
            (r"詳細は別途|詳細は後述|後で決定", "Major", "要件の先送り（実装前に確定が必要）"),
        ],
    },
    "test-design": {
        "label": "テスト設計書",
        "required": ["テスト対象", "合否基準", "テスト環境", "テスト手順"],
        "extra": [
            (r"確認する|テストする", "Cosmetic", "観点と期待値を具体的に記述（何をどう確認するか）"),
            (r"正しく動作|正常に動く", "Minor", "「正しく」の基準を定量的に定義する"),
        ],
    },
    "api-spec": {
        "label": "API仕様書",
        "required": ["エンドポイント", "リクエスト", "レスポンス", "エラー"],
        "extra": [
            (r"TBD|未定|後ほど", "Critical", "API仕様の未確定項目は実装ブロッカー（即座に解決が必要）"),
            (r"任意|optional", "Minor", "オプションフィールドはデフォルト値・null許容を明記"),
            (r"エラーの場合|エラー時", "Minor", "エラーケースはHTTPステータスコードと本文スキーマを明記"),
        ],
    },
}


def _builtin_prose_findings(text, doc_type):
    """純Python版の文章校正（曖昧語・冗長文）。textlint不在時のフォールバック。"""
    cfg = _DOC_TYPE_RULES.get(doc_type, _DOC_TYPE_RULES["general"])
    findings = []
    for ln, line in enumerate(text.splitlines(), start=1):
        for pattern, sev, msg in _AMBIGUOUS:
            for m in re.finditer(pattern, line):
                term = m.group(0)
                if term == "":
                    continue
                findings.append({"sev": sev, "line": ln, "term": term,
                                 "msg": msg, "text": line.strip(), "engine": "builtin"})
        for s in line.split("。"):
            if len(s) > 100:
                findings.append({"sev": "Minor", "line": ln, "term": f"{len(s)}字",
                                 "msg": "一文が長く可読性が低い（100字超）",
                                 "text": s.strip()[:40] + "…", "engine": "builtin"})
    return findings


def _domain_findings(text, doc_type):
    """ドキュメント種別固有のルール＋必須セクション欠落（textlintでは検出不可の領域）。"""
    cfg = _DOC_TYPE_RULES.get(doc_type, _DOC_TYPE_RULES["general"])
    findings = []
    for ln, line in enumerate(text.splitlines(), start=1):
        for pattern, sev, msg in cfg["extra"]:
            for m in re.finditer(pattern, line):
                term = m.group(0)
                if term == "":
                    continue
                findings.append({"sev": sev, "line": ln, "term": term,
                                 "msg": msg, "text": line.strip(), "engine": "rule"})
    for h in cfg["required"]:
        if h not in text:
            findings.append({"sev": "Major", "line": "-", "term": h,
                             "msg": f"必須セクションが見当たらない（{cfg['label']}）",
                             "text": "", "engine": "rule"})
    return findings


def document_verify(text, doc_type="general"):
    cfg = _DOC_TYPE_RULES.get(doc_type, _DOC_TYPE_RULES["general"])

    # 提案A: 文章校正は textlint（日本語技術文書の60+ルール）を優先。
    #         無ければ純Python版（曖昧語・冗長文）へフォールバック。
    prose = engines.textlint_findings(text)
    if prose is None:
        prose = _builtin_prose_findings(text, doc_type)
        prose_engine = "builtin"
    else:
        prose_engine = "textlint"

    # ドメイン固有ルール＋必須節は常に純Pythonで判定（textlintの守備範囲外）
    findings = prose + _domain_findings(text, doc_type)

    counts = {}
    for f in findings:
        counts[f["sev"]] = counts.get(f["sev"], 0) + 1
    score = max(0, 100 - counts.get("Major", 0) * 10
                - counts.get("Minor", 0) * 3 - counts.get("Critical", 0) * 25
                - counts.get("Cosmetic", 0) * 1)
    return {"findings": findings, "counts": counts, "score": score,
            "label": cfg["label"], "engine": prose_engine}


# ─────────────────────────────────────────────
# 6. ROI計算機（バリデーション研究結果 → 年間削減額）
# ─────────────────────────────────────────────
ROI_INDUSTRY = {
    "finance": {"label": "金融・保険", "incidents": 10, "cost": 1000},
    "ecommerce": {"label": "EC・小売", "incidents": 20, "cost": 200},
    "healthcare": {"label": "医療・ヘルスケア", "incidents": 8, "cost": 800},
    "saas": {"label": "SaaS・B2B", "incidents": 15, "cost": 300},
    "manufacturing": {"label": "製造・組込み", "incidents": 6, "cost": 600},
    "other": {"label": "その他", "incidents": 12, "cost": 200},
}
ROI_METHODS = [
    ("5", "ISTQB/一般チェックリスト"),
    ("10", "GPT-4o等AI活用"),
    ("0", "経験則・アドホック"),
    ("50", "独自観点を整備済み"),
]
VP_CAPTURE = 85
SETUP_COST = 240  # 万円（3人月 × 80万円）


def roi_calc(incidents, cost_per, current_pct):
    incidents = max(1, int(incidents))
    cost_per = max(1, int(cost_per))
    current_pct = int(current_pct)
    delta = (VP_CAPTURE - current_pct) / 100
    prevented = max(0, round(incidents * delta))
    annual_saving = prevented * cost_per
    total_cost = incidents * cost_per
    monthly = annual_saving / 12
    payback = round(SETUP_COST / monthly, 1) if monthly > 0 else None
    roi3y = round((annual_saving * 3 - SETUP_COST) / SETUP_COST * 100) if monthly > 0 else 0
    return {
        "incidents": incidents, "cost_per": cost_per, "current_pct": current_pct,
        "vp_pct": VP_CAPTURE, "prevented": prevented, "annual_saving": annual_saving,
        "total_cost": total_cost, "payback": payback, "roi3y": roi3y, "setup_cost": SETUP_COST,
        "leak_current": round(total_cost * (1 - current_pct / 100)),
        "leak_vp": round(total_cost * (1 - VP_CAPTURE / 100)),
    }


# ─────────────────────────────────────────────
# 7. 計画策定（ISO/IEC 29119-3 テンプレート）
# ─────────────────────────────────────────────
def test_plan(d):
    def v(key):
        return d.get(key) or "（未入力）"
    from datetime import date
    now = date.today().isoformat()
    return f"""# テスト計画書（ISO/IEC 29119-3準拠）

## 1. テスト計画識別子
TP-{now}-{v('name')}

## 2. 概要
本書は「{v('name')}」のテスト計画を定義する。

## 3. テスト対象・範囲
{v('scope')}

## 4. テスト環境
{v('env')}

## 5. テストアプローチ
- レベル: 結合テスト / システムテスト
- 技法: 境界値分析・同値分割・ペアワイズ（ISTQB）
- 自動化: UI(Playwright) / API(pytest) を併用

## 6. 合否基準
- 開始基準（Entry）: {v('entry')}
- 終了基準（Exit）: {v('exit')}

## 7. スケジュール
- 開始予定: {v('start')}
- 終了予定: {v('end')}

## 8. リスクと対策
- {v('risk')}（早期に連携テストを前倒しで実施）

## 9. 成果物
- テストケース、テスト結果、欠陥一覧（ISTQB severity付き）、テストサマリーレポート

## 10. 承認
| 役割 | 氏名 | 日付 |
|---|---|---|
| テストマネージャー | | |
| PMO | | |
"""


# ─────────────────────────────────────────────
# 8. CI/CD構築（GitHub Actions YAML）
# ─────────────────────────────────────────────
def cicd(runtime, test_cmd, deploy):
    setup = {
        "node": "      - uses: actions/setup-node@v4\n        with: { node-version: '20' }\n      - run: npm ci",
        "python": "      - uses: actions/setup-python@v5\n        with: { python-version: '3.12' }\n      - run: pip install -r requirements.txt",
        "java": "      - uses: actions/setup-java@v4\n        with: { distribution: 'temurin', java-version: '21' }",
    }.get(runtime, "")
    deploy_job = ""
    if deploy == "pages":
        deploy_job = """
  deploy:
    needs: build-test
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: '.' }
      - uses: actions/deploy-pages@v4"""
    return f"""name: CI
on:
  push: {{ branches: [ main ] }}
  pull_request: {{ branches: [ main ] }}

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
{setup}
      - name: テスト実行
        run: {test_cmd}
      - name: 品質ゲート（カバレッジ/静的解析はここに追加）
        run: echo "Critical/Major欠陥0件・カバレッジ閾値をここで検証"
{deploy_job}"""


# ─────────────────────────────────────────────
# 9. テスト自動化 scaffold（Playwright / pytest / bats）
# ─────────────────────────────────────────────
def test_auto(kind, p1, p2):
    if kind == "ui":
        code = f"""// Playwright UIテスト（Page Objectパターン）
import {{ test, expect }} from '@playwright/test';

class LoginPage {{
  constructor(page) {{ this.page = page; }}
  async goto() {{ await this.page.goto('{p1}'); }}
  async submit() {{ await this.page.getByRole('button', {{ name: /ログイン|login/i }}).click(); }}
}}

test('{p2}', async ({{ page }}) => {{
  const login = new LoginPage(page);
  await login.goto();
  await login.submit();
  await expect(page).toHaveURL(/home/);
}});
"""
        return code, "login.spec.ts"
    if kind == "api":
        status = re.search(r"\d+", p2)
        status = status.group(0) if status else "200"
        code = f"""# API テスト（pytest + requests）
import requests

BASE = "{p1}"

def test_endpoint_returns_expected_status():
    \"\"\"期待: {p2}\"\"\"
    resp = requests.get(BASE, timeout=10)
    assert resp.status_code == {status}
"""
        return code, "test_api.py"
    code = f"""#!/usr/bin/env bats
# BAT テスト（bats-core）

@test "{p2}" {{
  run {p1}
  [ "$status" -eq 0 ]
  [[ "$output" == *"{p2}"* ]]
}}
"""
    return code, "test.bats"
