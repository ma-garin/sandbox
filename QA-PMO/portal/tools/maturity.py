"""品質プロセス成熟度アセスメント（TMMi準拠・決定的アルゴリズム）。

シニアQAコンサルタントが実施する「成熟度診断」をソフトに codify したもの。
回答（各設問 0〜3）から、領域別スコア・TMMi成熟度レベル・ギャップ分析・
優先度付き改善ロードマップを生成する。AIなし・外部依存なし・完全に再現可能。

参考: TMMi (Test Maturity Model integration) Level 2〜5 のプロセスエリア。
本モデルは実務向けに代表領域へ凝縮した版（16→8領域）。
"""

# 回答スケール（0〜3）
SCALE = [
    (0, "未実施", "プロセスが存在しない、または場当たり的"),
    (1, "部分的", "一部で実施されるが標準化・文書化されていない"),
    (2, "概ね確立", "標準として定義され、多くの場面で実施されている"),
    (3, "定着", "全社で定着し、継続的に運用・改善されている"),
]
MAX_PER_Q = 3
SATISFIED_PCT = 85  # TMMi: largely/fully achieved 相当

LEVEL_NAME = {
    1: "Initial（初期）",
    2: "Managed（管理された）",
    3: "Defined（定義された）",
    4: "Measured（測定された）",
    5: "Optimization（最適化）",
}

LEVEL_THEME = {
    1: "テストは場当たり的。成功は個人の力量に依存し、再現性がない。",
    2: "プロジェクト単位でテストが計画・管理される。方針と計画が確立。",
    3: "テストが組織標準として定義され、開発ライフサイクルに統合される。",
    4: "テストと製品品質が定量的に測定・評価され、データで意思決定する。",
    5: "欠陥予防とプロセス最適化により、継続的に品質を作り込む。",
}

# ── 成熟度モデル（領域 → TMMiレベル・設問・改善アクション） ──
# 各領域: code, name, level, questions[list[str]], actions[list[str]]（ギャップ時の改善策）
MODEL = [
    {
        "code": "POLICY", "name": "テスト方針・戦略", "level": 2,
        "questions": [
            "全社のテスト方針（目的・品質目標・役割）が文書化され合意されている",
            "プロダクト/プロジェクト横断のテスト戦略が定義されている",
            "テストの目標が事業目標・品質リスクと紐づいている",
        ],
        "actions": [
            "テスト方針書を1ページで策定し経営層の承認を得る（目的・品質目標・体制）",
            "テスト戦略テンプレート（対象範囲・技法・自動化方針・終了基準）を整備する",
            "品質目標を事業KPI（障害率・手戻り工数）に接続して可視化する",
        ],
    },
    {
        "code": "PLAN", "name": "テスト計画", "level": 2,
        "questions": [
            "リスク分析に基づきテスト範囲・工数・スケジュールを見積もっている",
            "テスト計画書（ISO29119相当）が標準テンプレートで作成される",
            "計画は関係者レビューを経て承認され、変更が管理されている",
        ],
        "actions": [
            "プロダクトリスクマトリクス（影響度×発生頻度）で優先度を決める手順を導入",
            "ISO/IEC 29119-3準拠の計画書テンプレートを標準化（本ポータルの計画策定ツール活用）",
            "計画のベースライン化と変更履歴管理のルールを定める",
        ],
    },
    {
        "code": "MONITOR", "name": "テスト監視・制御", "level": 2,
        "questions": [
            "テスト進捗・消化率・欠陥状況を定期的に可視化している",
            "計画との乖離に対し是正アクションを取る仕組みがある",
            "リリース判定の基準（終了基準）が事前に定義されている",
        ],
        "actions": [
            "進捗ダッシュボード（消化率・未消化・欠陥推移）を週次で運用する",
            "乖離20%超でエスカレーションするトリガールールを定義する",
            "終了基準（Critical/Major欠陥0・消化率100%等）をリリース判定会で運用",
        ],
    },
    {
        "code": "DESIGN", "name": "テスト設計・実行", "level": 2,
        "questions": [
            "観点・技法（境界値/同値/状態遷移/デシジョン）に基づき設計している",
            "テスト条件→ケース→手順がトレース可能に文書化される",
            "実行結果とエビデンスが記録・保管されている",
        ],
        "actions": [
            "テスト観点ライブラリを適用した設計を標準化（本ポータルのテスト設計ツール活用）",
            "要件↔テストのトレーサビリティを維持（本ポータルのトレーサビリティツール活用）",
            "実行エビデンス（スクショ・ログ）の保管ルールと欠陥管理を整備",
        ],
    },
    {
        "code": "REVIEW", "name": "ピアレビュー", "level": 3,
        "questions": [
            "要件・設計・テスト成果物に対しレビューを定常的に実施している",
            "レビュー指摘が分類・記録され、再発防止に活用される",
            "レビューの観点チェックリストが整備されている",
        ],
        "actions": [
            "成果物別レビュー観点チェックリストを整備し定例レビューを設定する",
            "指摘を欠陥パターンとして蓄積し、上流で予防する（欠陥パターンDB活用）",
            "レビュー実施率・指摘密度をメトリクス化する",
        ],
    },
    {
        "code": "NONFUNC", "name": "非機能テスト", "level": 3,
        "questions": [
            "性能・セキュリティ・互換性等の非機能要件をテストしている",
            "非機能の合否基準（応答時間・脆弱性深刻度等）が定量化されている",
            "非機能テストが開発ライフサイクルに組み込まれている",
        ],
        "actions": [
            "非機能要件を ISO/IEC 25010 品質特性で網羅的に洗い出す",
            "性能（応答時間SLA）・セキュリティ（OWASP）の合否基準を数値で定義",
            "CIに非機能チェック（負荷・脆弱性スキャン）を組み込む",
        ],
    },
    {
        "code": "MEASURE", "name": "テスト測定・製品品質評価", "level": 4,
        "questions": [
            "欠陥密度・摘出効率・カバレッジ等のメトリクスを継続収集している",
            "製品品質を定量指標で評価しリリース判断に使っている",
            "メトリクスのベースラインがあり、傾向を分析している",
        ],
        "actions": [
            "コアメトリクス（欠陥密度・DDE・カバレッジ）の定義と収集自動化",
            "製品品質スコアカードを作りリリースゲートに接続する",
            "過去プロジェクトのベースライン化と統計的傾向分析を始める",
        ],
    },
    {
        "code": "PREVENT", "name": "欠陥予防・プロセス最適化", "level": 5,
        "questions": [
            "欠陥の根本原因分析（RCA）を行い、上流での予防策を講じている",
            "テストプロセスを定量データに基づき継続的に改善している",
            "新技法・自動化・ツールを評価し計画的に導入している",
        ],
        "actions": [
            "重大欠陥に対し RCA（なぜなぜ分析）を定例化し予防策を標準へ反映",
            "プロセス改善をPDCAで回し、効果をメトリクスで検証する",
            "技法・ツールの評価制度（PoC→展開）を設け継続的に最新化する",
        ],
    },
]

LEVELS_IN_MODEL = sorted({a["level"] for a in MODEL})  # [2,3,4,5]


def question_keys():
    """フォームの各設問に対応するキー一覧（area_code, q_index, name, label）。"""
    out = []
    for area in MODEL:
        for i, q in enumerate(area["questions"]):
            out.append({"area": area["code"], "idx": i,
                        "name": f"q_{area['code']}_{i}", "label": q})
    return out


def blank_responses(default=1):
    """全設問を default 値で初期化した回答辞書。"""
    return {qk["name"]: default for qk in question_keys()}


def assess(responses):
    """responses: {q_<AREA>_<idx>: 0..3} → 診断結果 dict。

    欠損や範囲外は 0 に丸める（堅牢性）。
    """
    areas = []
    for area in MODEL:
        vals = []
        for i in range(len(area["questions"])):
            raw = responses.get(f"q_{area['code']}_{i}", 0)
            try:
                v = int(raw)
            except (TypeError, ValueError):
                v = 0
            v = max(0, min(MAX_PER_Q, v))
            vals.append(v)
        n = len(vals)
        score = round(sum(vals) / (n * MAX_PER_Q) * 100) if n else 0
        areas.append({
            "code": area["code"], "name": area["name"], "level": area["level"],
            "score": score, "satisfied": score >= SATISFIED_PCT,
            "values": vals, "actions": area["actions"],
            "questions": area["questions"],
        })

    # レベル達成判定（下位から累積。あるレベルの全領域が満たされて初めて達成）
    level_status = {}
    overall = 1
    broken = False
    for lv in LEVELS_IN_MODEL:
        lv_areas = [a for a in areas if a["level"] == lv]
        achieved = all(a["satisfied"] for a in lv_areas) if lv_areas else False
        level_status[lv] = achieved
        if achieved and not broken and overall == lv - 1:
            overall = lv
        else:
            broken = True

    level_chips = [{"lv": lv, "achieved": level_status[lv]} for lv in LEVELS_IN_MODEL]
    overall_score = round(sum(a["score"] for a in areas) / len(areas)) if areas else 0

    # ギャップ（未達領域）を「レベル昇順 → スコア昇順」で並べる＝改善の着手順
    gaps = sorted([a for a in areas if not a["satisfied"]],
                  key=lambda a: (a["level"], a["score"]))

    # 改善ロードマップ（次に到達すべきレベルに必要な未達領域を束ねる）
    target_level = min((lv for lv in LEVELS_IN_MODEL if not level_status[lv]),
                       default=LEVELS_IN_MODEL[-1])
    roadmap = []
    for a in gaps:
        roadmap.append({
            "area": a["name"], "level": a["level"], "score": a["score"],
            "actions": a["actions"],
            "priority": "最優先" if a["level"] == target_level else "次段階",
        })

    # レーダーチャート（Chart.js radar 設定）
    chart = {
        "type": "radar",
        "data": {
            "labels": [a["name"] for a in areas],
            "datasets": [
                {"label": "現状スコア(%)",
                 "data": [a["score"] for a in areas],
                 "backgroundColor": "rgba(26,58,107,0.15)",
                 "borderColor": "#1a3a6b", "pointBackgroundColor": "#1a3a6b"},
                {"label": "達成基準(85%)",
                 "data": [SATISFIED_PCT for _ in areas],
                 "backgroundColor": "rgba(192,57,43,0.04)",
                 "borderColor": "#c0392b", "borderDash": [5, 4],
                 "pointRadius": 0, "fill": False},
            ],
        },
        "options": {
            "responsive": True, "maintainAspectRatio": False,
            "scales": {"r": {"beginAtZero": True, "max": 100,
                             "ticks": {"stepSize": 20}}},
            "plugins": {"legend": {"position": "bottom"},
                        "title": {"display": True, "text": "プロセス成熟度プロファイル"}},
        },
    }

    return {
        "areas": areas,
        "overall_level": overall,
        "overall_level_name": LEVEL_NAME[overall],
        "overall_level_theme": LEVEL_THEME[overall],
        "next_level": min(overall + 1, 5),
        "next_level_name": LEVEL_NAME[min(overall + 1, 5)],
        "overall_score": overall_score,
        "level_status": level_status,
        "level_chips": level_chips,
        "levels": LEVELS_IN_MODEL,
        "gaps": gaps,
        "n_gaps": len(gaps),
        "roadmap": roadmap,
        "target_level": target_level,
        "chart": chart,
        "satisfied_pct": SATISFIED_PCT,
    }
