"""ジェネレータ系エンジン C: 文書・計画・ロードマップ系

planning  / qa_planning  : QA文書スイートジェネレータ（ISO 29119準拠）
project   / project_tools: WBS＋リスク登録簿ジェネレータ
advisor   / quality_roadmap: 品質ロードマップ生成
education / edu_assess   : ISTQB知識アセスメント＆学習プランナー
impl      / impl_tracker  : 実装推進トラッカー
test_promo/ test_exec    : テスト実行ダッシュボード
test_outsource           : フェーズ管理＋受託テストトラッカー

すべて純粋関数。AIなし・外部依存なし・完全再現可能。
将来の AI 換装も同一シグネチャで対応（Strategyパターン）。
"""

from datetime import date, timedelta
import re

TODAY = date.today()


# ═══════════════════════════════════════════
# 1. QA文書スイートジェネレータ（qa_planning）
# ═══════════════════════════════════════════

DOC_TYPES = {
    "test_plan": "テスト計画書（ISO/IEC 29119-3準拠）",
    "test_strategy": "テスト戦略書",
    "quality_plan": "品質計画書",
    "process_def": "テストプロセス定義書",
    "entry_exit": "開始/終了基準書",
    "test_report": "テストサマリーレポートテンプレート",
}

_RISK_MATRIX = """
| リスク | 影響度 | 発生率 | 優先度 | 対策 |
|---|---|---|---|---|
| 要件の凍結遅延 | 高 | 中 | P1 | スコープ確定日をマイルストーンに設定 |
| テスト環境の未整備 | 高 | 中 | P1 | 環境構築をテスト開始2週間前に完了 |
| 主要メンバーの離脱 | 高 | 低 | P2 | バックアップ要員を事前に育成 |
| 外部連携先の遅延 | 中 | 中 | P2 | スタブ・モックで並行進行 |
| 欠陥件数の超過 | 中 | 低 | P3 | 週次でトレンドを監視しリスケ判断 |
"""


def qa_planning_generate(doc_type, project_name, scope, start_date, end_date,
                          entry_criteria, exit_criteria, risks, team_size):
    """QA文書をISO 29119/ISTQB準拠のMarkdownで生成する。"""
    if not doc_type:
        doc_type = "test_plan"
    doc_label = DOC_TYPES.get(doc_type, "テスト計画書")
    pname = project_name or "プロジェクト名未入力"
    scope_text = scope or "（スコープを入力してください）"
    start = start_date or TODAY.isoformat()
    end = end_date or (TODAY + timedelta(days=30)).isoformat()
    entry = entry_criteria or "・対象機能の結合テスト完了\n・テスト環境の構築完了\n・テストデータの準備完了"
    exit_ = exit_criteria or "・Critical/Major欠陥 0件\n・テスト消化率 100%\n・回帰テスト全件パス"
    risks_text = risks or _RISK_MATRIX.strip()
    ts = int(team_size) if str(team_size).isdigit() else 2

    uid = f"TP-{TODAY.strftime('%Y%m%d')}-{re.sub(r'[^A-Za-z0-9]', '', pname)[:8].upper()}"

    if doc_type == "test_plan":
        md = f"""# {doc_label}

## 1. 文書識別子
**ID**: {uid}　**版**: 1.0　**作成日**: {TODAY.isoformat()}　**ステータス**: ドラフト

## 2. テスト計画概要
本書は「**{pname}**」のテスト計画を定義する。
準拠標準: ISO/IEC 29119-3:2021（ソフトウェアテスト — テスト文書）

## 3. テスト対象・スコープ
{scope_text}

### 3.1 テスト対象（in-scope）
- 上記スコープに記載する全機能・インタフェース

### 3.2 テスト対象外（out-of-scope）
- インフラ・ネットワーク層の負荷試験（別途計画）
- サードパーティAPI内部の品質保証

## 4. テストレベルとアプローチ
| レベル | 担当 | 技法 | 自動化 |
|---|---|---|---|
| 単体テスト | 開発チーム | ホワイトボックス、境界値 | pytest / JUnit（必須） |
| 結合テスト | QAチーム | インタフェーステスト、状態遷移 | API自動化 |
| システムテスト | QAチーム | 同値分割、境界値、ペアワイズ | Playwright（主要シナリオ） |
| 受入テスト | ステークホルダー | ユーザーシナリオ | 手動 |

## 5. 開始基準（Entry Criteria）
{entry}

## 6. 終了基準（Exit Criteria）
{exit_}

## 7. スケジュール
| フェーズ | 開始 | 終了 | 担当 |
|---|---|---|---|
| テスト計画・設計 | {start} | （開始1週後） | テストリード |
| テスト実行（第1サイクル） | （設計完了翌日） | （中間日） | QAチーム |
| 欠陥修正・回帰テスト | （中間日翌日） | {end} | QAチーム |
| テストサマリーレポート | {end} | （終了3日後） | テストリード |

## 8. テスト環境
| 環境 | 用途 | 管理者 |
|---|---|---|
| STG（ステージング） | システムテスト・受入テスト | インフラチーム |
| DEV（開発） | 単体・結合テスト | 開発チーム |

## 9. テストデータ管理
- 本番データのマスキングデータを使用（個人情報保護法準拠）
- 境界値・異常系テスト用データは QAチームが作成・管理

## 10. 体制・役割
| 役割 | 担当 | 責任 |
|---|---|---|
| テストマネージャー | TBD | 計画・進捗管理・リリース判定 |
| テストリード | TBD | 設計・環境・メトリクス |
| テストエンジニア（{ts}名） | TBD | テスト実行・欠陥報告 |

## 11. リスクと対策
{risks_text}

## 12. メトリクス・レポート
- **週次レポート**: 消化率 / 合格率 / 未消化数 / 欠陥推移
- **欠陥密度**: 機能ポイントまたはストーリーポイントあたりの欠陥数
- **欠陥検出効率（DDE）**: テストで検出した欠陥 ÷ 全欠陥数

## 13. 成果物
| 成果物 | 形式 | 提出期限 |
|---|---|---|
| テスト計画書（本書） | Markdown/PDF | {start} |
| テストケース | TestRail / Excel | テスト開始1週間前 |
| テスト実行記録 | TestRail | テスト実行中（随時） |
| 欠陥票 | Jira / 欠陥管理ツール | 検出当日 |
| テストサマリーレポート | Markdown/PDF | {end} |

## 14. 承認
| 役割 | 氏名 | 日付 | 署名 |
|---|---|---|---|
| テストマネージャー | | | |
| PMO / プロジェクトマネージャー | | | |
| 品質責任者 | | | |

---
*本書は ISO/IEC 29119-3:2021 に準拠して作成されました。*
"""
    elif doc_type == "test_strategy":
        md = f"""# テスト戦略書
**プロジェクト**: {pname}　**ID**: {uid}-STR　**版**: 1.0　**作成日**: {TODAY.isoformat()}

## 1. 品質目標
| 指標 | 目標値 | 測定方法 |
|---|---|---|
| Critical/Major欠陥流出率 | 0件 | 本番障害件数 |
| テストカバレッジ（要件） | 100% | RTM消化率 |
| コードカバレッジ（単体） | 80%以上 | Codecov |
| 性能（応答時間95%ile） | 2秒以内 | 負荷テストツール |

## 2. テストアプローチ
### 2.1 リスクベーステスト（RBT）
製品リスクを「影響度 × 発生頻度」でスコアリングし、スコア上位から優先してテストを設計・実行する。

### 2.2 適用テスト技法
- **同値分割・境界値分析**: 全数値・文字列フィールドに適用
- **ペアワイズ（組合せ）**: パラメータが3以上の組合せに適用
- **状態遷移**: ログイン・注文・ワークフロー等に適用
- **ユースケーステスト**: ユーザーシナリオベースの受入基準を検証

### 2.3 非機能テスト
{scope_text}の性能・セキュリティ・互換性は別途「非機能テスト計画」で管理する。

## 3. テスト自動化戦略
- **継続的テスト**: CIパイプライン（GitHub Actions）に回帰テストを統合
- **自動化優先順位**: 回帰テスト > APIテスト > UIテスト（主要シナリオ）
- **手動テスト**: 探索的テスト・ユーザビリティ確認

## 4. 欠陥管理ポリシー
| Severity | 定義 | 対応 SLA |
|---|---|---|
| Critical | システム停止・データ喪失 | 即日対応（4h以内） |
| Major | 主要機能が使用不可 | 翌営業日まで |
| Minor | 機能制限、ワークアラウンドあり | 次スプリント |
| Cosmetic | UI/文言の軽微な問題 | 計画的対応 |

## 5. 終了判定
{exit_}

*準拠: ISTQB Foundation Level / ISO/IEC 29119-3:2021*
"""
    elif doc_type == "quality_plan":
        md = f"""# 品質計画書
**プロジェクト**: {pname}　**ID**: {uid}-QP　**版**: 1.0　**作成日**: {TODAY.isoformat()}

## 1. 品質目標・KPI
| KPI | 目標値 | 測定頻度 | 責任者 |
|---|---|---|---|
| 要件カバレッジ | 100% | 週次 | テストリード |
| Critical欠陥 流出 | 0件 | リリース毎 | QAマネージャー |
| 欠陥密度（システムテスト） | ≤ 3件/FP | テスト完了時 | テストリード |
| 回帰テスト自動化率 | ≥ 50% | 月次 | 開発リード |
| 性能（応答95%ile） | ≤ 2,000ms | 負荷テスト時 | インフラ担当 |

## 2. 品質活動計画
| フェーズ | 品質活動 | インプット | アウトプット |
|---|---|---|---|
| 要件定義 | 要件レビュー・テスタビリティ評価 | 要件定義書 | レビュー指摘票 |
| 設計 | 設計レビュー・テスト設計 | 設計書 | テストケース |
| 実装 | 静的解析・コードレビュー | ソースコード | 是正リスト |
| テスト | テスト実行・欠陥管理 | テストケース | テスト結果・欠陥票 |
| リリース | テストサマリー・リリース判定 | テスト結果 | リリース判定書 |

## 3. 品質リスク
{risks_text}

## 4. 成果物・承認プロセス
主要成果物はすべて担当者レビューと品質責任者の承認を経てベースライン化する。

*準拠: ISO/IEC 25010:2023 / ISO/IEC 29119-3:2021 / ISTQB*
"""
    else:  # process_def, entry_exit, test_report
        md = f"""# {doc_label}
**プロジェクト**: {pname}　**ID**: {uid}　**版**: 1.0　**作成日**: {TODAY.isoformat()}

## 開始基準（Entry Criteria）
{entry}

## 終了基準（Exit Criteria）
{exit_}

## テスト実行概要（サマリーレポート用）
| 項目 | 値 |
|---|---|
| テスト期間 | {start} 〜 {end} |
| 計画件数 | |
| 実行件数 | |
| 合格件数 | |
| 不合格件数 | |
| 欠陥検出数（Critical） | |
| 欠陥検出数（Major） | |
| 欠陥解決数 | |
| カバレッジ | |

## 総合判定
- [ ] リリース承認　- [ ] 条件付き承認　- [ ] リリース不可

## 承認
| テストマネージャー | PMO | 日付 |
|---|---|---|
| | | |

*準拠: ISO/IEC 29119-3:2021*
"""

    return {
        "doc_type": doc_type,
        "doc_label": doc_label,
        "doc_id": uid,
        "project_name": pname,
        "markdown": md,
        "doc_types": DOC_TYPES,
    }


# ═══════════════════════════════════════════
# 2. WBS＋リスク登録簿ジェネレータ（project_tools）
# ═══════════════════════════════════════════

_DEFAULT_PHASES = [
    ("企画・要件定義", 10, ["要件ヒアリング実施", "要件定義書作成", "QAへのテスタビリティ確認依頼", "要件レビュー・承認"]),
    ("設計", 15, ["基本設計書作成", "設計レビュー（QA参加）", "テスト設計開始・観点洗い出し", "詳細設計書作成"]),
    ("実装・単体テスト", 20, ["モジュール実装", "単体テスト実施（カバレッジ80%目標）", "静的解析・コードレビュー", "結合テスト環境構築"]),
    ("結合テスト", 10, ["テスト実行（結合）", "欠陥修正・回帰テスト", "テスト結果集計"]),
    ("システムテスト", 15, ["テスト実行（システム）", "非機能テスト実施", "欠陥修正・回帰テスト", "終了基準充足確認"]),
    ("受入テスト・リリース", 10, ["UAT実施・承認取得", "リリース判定会", "本番リリース・監視", "テストサマリーレポート作成"]),
]

_RISK_TEMPLATES = [
    ("要件の凍結遅延", "スケジュール", "高", "中", "P1",
     "要件確定日をマイルストーンとして契約・合意し、遅延時の判断基準を事前に定める"),
    ("テスト環境の準備遅延", "テスト品質", "高", "中", "P1",
     "テスト開始2週間前を環境完成期限とし、インフラチームと週次で進捗確認する"),
    ("キーパーソンの離脱・長期不在", "リソース", "高", "低", "P2",
     "バックアップ要員を事前に育成し、ドキュメントで知識移転する"),
    ("外部連携先APIの仕様変更・遅延", "スケジュール", "中", "中", "P2",
     "スタブ・モックで並行進行し、実API結合を最終フェーズに集約する"),
    ("欠陥件数が想定を超過する", "品質", "中", "中", "P2",
     "週次で欠陥密度をモニタリングし、P1超えでスケジュール再調整を即断する"),
    ("性能要件を満たさない", "品質", "中", "低", "P3",
     "早期に性能プロトタイプを実施し、ボトルネックを特定・修正する"),
    ("セキュリティ脆弱性の発見", "リリース判断", "高", "低", "P2",
     "OWASP Top10対応チェックをリリース前必須とし、第三者診断を計画する"),
]


def project_tools_generate(project_name, start_date, end_date, phases_text, risks_text):
    """WBS（テーブル形式）＋リスク登録簿を生成する。"""
    pname = project_name or "プロジェクト名未入力"
    start = date.fromisoformat(start_date) if start_date else TODAY
    end = date.fromisoformat(end_date) if end_date else (TODAY + timedelta(days=80))
    total_days = (end - start).days or 80

    # WBS生成
    wbs = []
    cursor = start
    task_no = 1
    for phase_name, pct, tasks in _DEFAULT_PHASES:
        phase_days = max(1, round(total_days * pct / 100))
        phase_end = cursor + timedelta(days=phase_days)
        wbs.append({
            "no": f"WBS-{task_no:02d}",
            "level": 1,
            "name": phase_name,
            "start": cursor.isoformat(),
            "end": phase_end.isoformat(),
            "duration": phase_days,
            "owner": "TBD",
            "subtasks": [],
        })
        sub_no = 1
        sub_cursor = cursor
        sub_days = max(1, phase_days // len(tasks))
        for t in tasks:
            sub_end = min(sub_cursor + timedelta(days=sub_days), phase_end)
            wbs[-1]["subtasks"].append({
                "no": f"WBS-{task_no:02d}-{sub_no:02d}",
                "name": t,
                "start": sub_cursor.isoformat(),
                "end": sub_end.isoformat(),
                "duration": sub_days,
            })
            sub_cursor = sub_end
            sub_no += 1
        cursor = phase_end
        task_no += 1

    # リスク登録簿
    risks = []
    for i, (name, category, impact, prob, pri, mitigation) in enumerate(_RISK_TEMPLATES, 1):
        risks.append({
            "id": f"RSK-{i:03d}",
            "name": name,
            "category": category,
            "impact": impact,
            "probability": prob,
            "priority": pri,
            "mitigation": mitigation,
            "owner": "TBD",
            "status": "オープン",
        })

    # カスタムリスクをテキストから追加
    if risks_text:
        for line in risks_text.splitlines():
            line = line.strip()
            if line:
                risks.append({
                    "id": f"RSK-{len(risks)+1:03d}",
                    "name": line,
                    "category": "カスタム",
                    "impact": "中",
                    "probability": "中",
                    "priority": "P2",
                    "mitigation": "（対策を記入してください）",
                    "owner": "TBD",
                    "status": "オープン",
                })

    return {
        "project_name": pname,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_days": total_days,
        "wbs": wbs,
        "risks": risks,
        "n_tasks": sum(len(p["subtasks"]) for p in wbs),
        "n_risks": len(risks),
        "p1_risks": [r for r in risks if r["priority"] == "P1"],
    }


# ═══════════════════════════════════════════
# 3. 品質ロードマップ生成（quality_roadmap / advisor）
# ═══════════════════════════════════════════

_ROADMAP_ACTIONS = {
    "process": {
        1: [("テスト計画書テンプレートを1枚で策定し、プロジェクト必須化", "1週"),
            ("ISO 29119-3準拠の用語・フォーマットを標準化", "2週")],
        2: [("リスクベーステスト（RBT）のプロセスを定義", "1ヶ月"),
            ("欠陥管理プロセスとSeverity分類を標準化", "2週")],
        3: [("テスト自動化率30%以上を目標に設定・計測", "3ヶ月"),
            ("RCAを重大欠陥に定例化", "継続")],
    },
    "metrics": {
        1: [("週次QAレポート（欠陥件数・消化率）を開始", "2週"),
            ("要件↔テストのRTMを導入", "1ヶ月")],
        2: [("コードカバレッジ80%目標を設定・測定", "2ヶ月"),
            ("欠陥密度のベースライン化", "1ヶ月")],
        3: [("品質スコアカードをリリース判定に接続", "2ヶ月"),
            ("傾向分析による予防的対策", "継続")],
    },
    "automation": {
        1: [("CIに基本テスト（単体）を組み込む", "2週"),
            ("テスト管理ツールを導入（TestRail等）", "1ヶ月")],
        2: [("API自動テストを主要エンドポイントに整備", "2ヶ月"),
            ("UI自動化（主要シナリオ）をCIに統合", "3ヶ月")],
        3: [("自動化率70%超を達成・維持", "継続"),
            ("静的解析をCIに組み込む", "1ヶ月")],
    },
    "culture": {
        1: [("開発者テスト（TDD/BDD）の意識啓発研修", "1ヶ月"),
            ("ISTQB-FL取得支援制度を創設", "2ヶ月")],
        2: [("シフトレフト：上流レビューにQA参加を定例化", "1ヶ月"),
            ("QAナレッジの観点ライブラリ化", "3ヶ月")],
        3: [("QA Championを各チームに配置", "6ヶ月"),
            ("品質文化の定量測定（サーベイ）", "継続")],
    },
}


def quality_roadmap_generate(maturity_scores, goals, horizon_months):
    """品質改善ロードマップ（3/6/12ヶ月）を生成する。

    maturity_scores: {"process": 0-3, "metrics": 0-3, "automation": 0-3, "culture": 0-3}
    goals: list of str（達成したいこと）
    horizon_months: 3 or 6 or 12
    """
    horizon = int(horizon_months) if str(horizon_months).isdigit() else 6
    scores = {
        "process": int(maturity_scores.get("process", 1) or 1),
        "metrics": int(maturity_scores.get("metrics", 1) or 1),
        "automation": int(maturity_scores.get("automation", 1) or 1),
        "culture": int(maturity_scores.get("culture", 1) or 1),
    }
    domain_names = {
        "process": "テストプロセス標準化",
        "metrics": "メトリクス・可視化",
        "automation": "テスト自動化・CI",
        "culture": "品質文化・人材育成",
    }

    milestones = []
    ms_no = 1

    # Phase 1（0〜horizon/3ヶ月）: 最も弱い領域を優先
    phase1_end = TODAY + timedelta(days=round(horizon / 3 * 30))
    phase2_end = TODAY + timedelta(days=round(horizon * 2 / 3 * 30))
    phase3_end = TODAY + timedelta(days=round(horizon * 30))

    phases = [
        ("Phase 1: 基盤構築", TODAY.isoformat(), phase1_end.isoformat(), "quick wins"),
        ("Phase 2: 定着・拡張", phase1_end.isoformat(), phase2_end.isoformat(), "scale up"),
        ("Phase 3: 最適化・文化醸成", phase2_end.isoformat(), phase3_end.isoformat(), "optimize"),
    ]

    # 優先領域を弱いスコア順に並べる
    sorted_domains = sorted(scores.items(), key=lambda x: x[1])

    roadmap = []
    for phase_name, phase_start, phase_end, theme in phases:
        actions_in_phase = []
        for domain, score in sorted_domains:
            level = min(score + 1, 3)
            acts = _ROADMAP_ACTIONS.get(domain, {}).get(level, [])
            for action, timing in acts[:2]:  # 各領域から2件
                actions_in_phase.append({
                    "id": f"RM-{ms_no:03d}",
                    "domain": domain_names.get(domain, domain),
                    "action": action,
                    "timing": timing,
                    "effect": "★★★" if score == 0 else ("★★" if score == 1 else "★"),
                })
                ms_no += 1
        roadmap.append({
            "phase": phase_name,
            "theme": theme,
            "start": phase_start,
            "end": phase_end,
            "actions": actions_in_phase[:6],  # フェーズあたり最大6件
        })

    # KPI目標
    kpis = [
        {"kpi": "Critical欠陥 本番流出数", "current": "（現状入力）", "target": "0件", "when": f"{horizon}ヶ月後"},
        {"kpi": "テストカバレッジ（要件）", "current": "（現状入力）", "target": "100%", "when": f"{round(horizon*2/3)}ヶ月後"},
        {"kpi": "回帰テスト自動化率", "current": f"{scores['automation']*25}%", "target": f"{min(scores['automation']*25+30, 80)}%", "when": f"{horizon}ヶ月後"},
        {"kpi": "週次品質レポート実施率", "current": "（現状入力）", "target": "100%", "when": "3ヶ月後"},
    ]

    return {
        "roadmap": roadmap,
        "kpis": kpis,
        "horizon_months": horizon,
        "scores": scores,
        "goals": goals or [],
        "phase1_end": phase1_end.isoformat(),
        "phase3_end": phase3_end.isoformat(),
        "n_actions": ms_no - 1,
    }


# ═══════════════════════════════════════════
# 4. ISTQB知識アセスメント＆学習プランナー（edu_assess）
# ═══════════════════════════════════════════

ISTQB_TOPICS = [
    {
        "code": "FL-1", "level": "FL", "chapter": "テストの基礎",
        "topics": [
            ("テストとデバッグの違い", "テストは欠陥を検出し、デバッグは原因を特定する"),
            ("テストの7原則（欠陥クラスタリング等）", "ISTQB FLシラバス §1.3 7原則"),
            ("テストプロセスの活動（計画・設計・実行・完了）", "ISO/IEC 29119準拠"),
        ],
    },
    {
        "code": "FL-2", "level": "FL", "chapter": "SDLCとテスト",
        "topics": [
            ("各開発モデル（V字/スクラム/DevOps）でのテスト", "アジャイル・ウォーターフォール比較"),
            ("シフトレフト・継続的テストの実践", "CIへのテスト統合"),
            ("テストレベル（単体/結合/システム/受入）の定義", "ISTQB FLシラバス §2"),
        ],
    },
    {
        "code": "FL-3", "level": "FL", "chapter": "静的テスト",
        "topics": [
            ("レビューの種類（非公式/ウォークスルー/技術/公式）", "レビュープロセス・役割"),
            ("静的解析ツールの活用", "SAST・コードスメル検出"),
        ],
    },
    {
        "code": "FL-4", "level": "FL", "chapter": "テスト分析・設計技法",
        "topics": [
            ("境界値分析（2値/3値）の適用", "BVA: min-1/min/min+1/max-1/max/max+1"),
            ("同値分割の有効・無効クラス", "EP: 有効・無効の代表値を選択"),
            ("デシジョンテーブル・状態遷移テスト", "条件組合せと状態遷移網羅"),
            ("ペアワイズ（All-Pairs）テスト", "組合せ爆発の圧縮技法"),
            ("探索的テスト・チャーター設計", "SBTM・セッションベーステスト"),
        ],
    },
    {
        "code": "FL-5", "level": "FL", "chapter": "テストマネジメント",
        "topics": [
            ("リスクベーステスト（RBT）の実践", "製品リスク×プロセスリスク評価"),
            ("テストメトリクス（欠陥密度・DDE・カバレッジ）", "メトリクス定義・収集・活用"),
            ("テスト見積り手法（3点見積り等）", "工数見積りと不確実性管理"),
        ],
    },
    {
        "code": "FL-6", "level": "FL", "chapter": "ツール支援",
        "topics": [
            ("テスト管理ツール・欠陥管理ツールの活用", "TestRail・Jira・Zephyr等"),
            ("テスト自動化の基礎・導入判断", "ROI・保守性・適用範囲"),
        ],
    },
]

STUDY_RESOURCES = {
    "FL": [
        "ISTQB Certified Tester Foundation Level シラバス（JSTQB公開PDF）",
        "JSTQB公式サンプル問題集（40問）",
        "「ソフトウェアテスト ISTQB準拠」（翔泳社）",
    ],
    "AL-TM": [
        "ISTQB Advanced Level Test Manager シラバス",
        "「テストマネジメント」（技術評論社）",
        "ISO/IEC 29119シリーズ（規格本文）",
    ],
    "AL-TTA": [
        "ISTQB Advanced Level Technical Test Analyst シラバス",
        "「ソフトウェアテスト技法ドリル」（日科技連）",
        "「はじめて学ぶソフトウェアのテスト技法」（日経BP）",
    ],
}


def edu_assess(responses, target_cert):
    """ISTQB知識アセスメント → ギャップ分析 → 学習プラン生成。

    responses: {topic_key: 0|1|2} (0=未学習, 1=理解, 2=実践)
    target_cert: "FL" | "AL-TM" | "AL-TTA"
    """
    cert = target_cert or "FL"
    topics_flat = []
    for ch in ISTQB_TOPICS:
        for i, (topic, memo) in enumerate(ch["topics"]):
            key = f"t_{ch['code']}_{i}"
            val = int(responses.get(key, 0) or 0)
            topics_flat.append({
                "key": key, "chapter": ch["chapter"], "chapter_code": ch["code"],
                "topic": topic, "memo": memo, "level": val,
                "status": ["未学習", "理解", "実践"][val],
                "gap": val < 1,
            })

    total = len(topics_flat)
    learned = sum(1 for t in topics_flat if t["level"] >= 1)
    practiced = sum(1 for t in topics_flat if t["level"] >= 2)
    readiness = round(learned / total * 100) if total else 0

    # 章ごとに集計
    chapters = {}
    for t in topics_flat:
        ch = t["chapter_code"]
        if ch not in chapters:
            chapters[ch] = {"name": t["chapter"], "code": ch, "topics": [], "gap_count": 0}
        chapters[ch]["topics"].append(t)
        if t["gap"]:
            chapters[ch]["gap_count"] += 1

    gaps = [t for t in topics_flat if t["gap"]]

    # 学習計画（1日1〜2トピック想定）
    study_days = max(1, len(gaps))
    exam_date = TODAY + timedelta(days=study_days + 14)  # 14日の余裕

    study_plan = []
    day = 1
    for t in gaps[:20]:  # 最大20件を計画に
        study_plan.append({
            "day": day,
            "topic": t["topic"],
            "chapter": t["chapter"],
            "memo": t["memo"],
            "date": (TODAY + timedelta(days=day - 1)).isoformat(),
        })
        day += 1

    return {
        "cert": cert,
        "total_topics": total,
        "learned": learned,
        "practiced": practiced,
        "readiness": readiness,
        "gap_count": len(gaps),
        "chapters": list(chapters.values()),
        "gaps": gaps,
        "study_plan": study_plan,
        "exam_date": exam_date.isoformat(),
        "resources": STUDY_RESOURCES.get(cert, STUDY_RESOURCES["FL"]),
        "topics_flat": topics_flat,
        "istqb_topics": ISTQB_TOPICS,
    }


def edu_item_keys():
    """フォームの設問キー一覧。"""
    keys = []
    for ch in ISTQB_TOPICS:
        for i, (topic, _) in enumerate(ch["topics"]):
            keys.append({"name": f"t_{ch['code']}_{i}", "label": topic, "chapter": ch["chapter"]})
    return keys


# ═══════════════════════════════════════════
# 5. 実装推進トラッカー（impl_tracker）
# ═══════════════════════════════════════════

def impl_tracker_process(tasks_text, project_name):
    """タスクリストをパースして進捗ダッシュボードデータを生成する。

    tasks_text: 1行に「タスク名, 担当者, ステータス, 期日」(CSV形式)
    ステータス: 未着手/進行中/完了/遅延/ブロック
    """
    pname = project_name or "プロジェクト"
    tasks = []
    VALID_STATUS = {"未着手", "進行中", "完了", "遅延", "ブロック"}

    if tasks_text:
        for i, line in enumerate(tasks_text.splitlines(), 1):
            parts = [p.strip() for p in line.split(",")]
            if not parts or not parts[0]:
                continue
            name = parts[0]
            owner = parts[1] if len(parts) > 1 else "TBD"
            status = parts[2] if len(parts) > 2 and parts[2] in VALID_STATUS else "未着手"
            due = parts[3] if len(parts) > 3 else ""
            is_late = False
            if due:
                try:
                    is_late = date.fromisoformat(due) < TODAY and status not in ("完了",)
                except ValueError:
                    pass
            tasks.append({
                "id": f"T-{i:03d}", "name": name, "owner": owner,
                "status": status, "due": due, "is_late": is_late,
            })

    if not tasks:
        tasks = [
            {"id": "T-001", "name": "テスト計画書作成", "owner": "QAリード", "status": "完了", "due": "", "is_late": False},
            {"id": "T-002", "name": "テスト環境構築", "owner": "インフラ", "status": "進行中", "due": "", "is_late": False},
            {"id": "T-003", "name": "テストケース設計", "owner": "QAチーム", "status": "進行中", "due": "", "is_late": False},
            {"id": "T-004", "name": "テスト実行（第1サイクル）", "owner": "QAチーム", "status": "未着手", "due": "", "is_late": False},
            {"id": "T-005", "name": "欠陥是正確認・回帰テスト", "owner": "QAチーム", "status": "未着手", "due": "", "is_late": False},
        ]

    counts = {}
    for t in tasks:
        counts[t["status"]] = counts.get(t["status"], 0) + 1
    total = len(tasks)
    done = counts.get("完了", 0)
    blocked = counts.get("ブロック", 0)
    late = sum(1 for t in tasks if t["is_late"])
    progress_pct = round(done / total * 100) if total else 0

    risks = []
    if blocked:
        risks.append(f"ブロック中タスクが {blocked}件あります。即時エスカレーションが必要です。")
    if late:
        risks.append(f"期日超過タスクが {late}件あります。スケジュール見直しを検討してください。")
    in_progress = counts.get("進行中", 0)
    if in_progress > total * 0.5:
        risks.append("進行中タスクが過多です。WIPリミットの設定を検討してください。")

    return {
        "project_name": pname,
        "tasks": tasks,
        "total": total,
        "done": done,
        "progress_pct": progress_pct,
        "counts": counts,
        "risks": risks,
        "late_count": late,
        "blocked_count": blocked,
        "statuses": ["未着手", "進行中", "完了", "遅延", "ブロック"],
    }


# ═══════════════════════════════════════════
# 6. テスト実行ダッシュボード（test_exec / test-promo）
# ═══════════════════════════════════════════

def test_exec_dashboard(phases_data):
    """テスト実行進捗ダッシュボード。

    phases_data: [{"name": str, "planned": int, "executed": int,
                   "passed": int, "failed": int, "blocked": int}]
    """
    if not phases_data:
        phases_data = [
            {"name": "結合テスト", "planned": 120, "executed": 120, "passed": 115, "failed": 5, "blocked": 0},
            {"name": "システムテスト", "planned": 300, "executed": 180, "passed": 165, "failed": 12, "blocked": 3},
            {"name": "回帰テスト", "planned": 80, "executed": 0, "passed": 0, "failed": 0, "blocked": 0},
        ]

    phases = []
    total_p, total_e, total_pass, total_fail, total_block = 0, 0, 0, 0, 0
    for ph in phases_data:
        planned = int(ph.get("planned", 0) or 0)
        executed = int(ph.get("executed", 0) or 0)
        passed = int(ph.get("passed", 0) or 0)
        failed = int(ph.get("failed", 0) or 0)
        blocked = int(ph.get("blocked", 0) or 0)
        exec_rate = round(executed / planned * 100) if planned else 0
        pass_rate = round(passed / executed * 100) if executed else 0
        phases.append({
            "name": ph.get("name", "フェーズ"),
            "planned": planned, "executed": executed,
            "passed": passed, "failed": failed, "blocked": blocked,
            "exec_rate": exec_rate, "pass_rate": pass_rate,
        })
        total_p += planned; total_e += executed
        total_pass += passed; total_fail += failed; total_block += blocked

    overall_exec = round(total_e / total_p * 100) if total_p else 0
    overall_pass = round(total_pass / total_e * 100) if total_e else 0

    # 終了基準チェック
    exit_checks = [
        {"item": "テスト消化率 100%", "ok": overall_exec == 100, "current": f"{overall_exec}%"},
        {"item": "合格率 95%以上", "ok": overall_pass >= 95, "current": f"{overall_pass}%"},
        {"item": "Critical欠陥 0件", "ok": total_fail == 0, "current": f"不合格 {total_fail}件"},
        {"item": "ブロック 0件", "ok": total_block == 0, "current": f"ブロック {total_block}件"},
    ]
    release_ok = all(c["ok"] for c in exit_checks)

    return {
        "phases": phases,
        "total_planned": total_p,
        "total_executed": total_e,
        "total_passed": total_pass,
        "total_failed": total_fail,
        "total_blocked": total_block,
        "overall_exec_rate": overall_exec,
        "overall_pass_rate": overall_pass,
        "exit_checks": exit_checks,
        "release_ok": release_ok,
        "release_status": "リリース判定：承認可能" if release_ok else "リリース判定：要解決事項あり",
    }


# ═══════════════════════════════════════════
# 7. 受託テストトラッカー（test_outsource）
# ═══════════════════════════════════════════

def test_outsource_tracker(project_name, client_name, phases_data, defects_text):
    """受託テスト進捗管理 + 欠陥サマリー + 報告書テンプレートを生成する。"""
    pname = project_name or "受託テストプロジェクト"
    cname = client_name or "クライアント名"

    # フェーズ進捗
    dashboard = test_exec_dashboard(phases_data)

    # 欠陥サマリー
    defects = []
    if defects_text:
        for i, line in enumerate(defects_text.splitlines(), 1):
            parts = [p.strip() for p in line.split(",")]
            if not parts or not parts[0]:
                continue
            defects.append({
                "id": f"BUG-{i:03d}",
                "title": parts[0],
                "severity": parts[1] if len(parts) > 1 else "Major",
                "status": parts[2] if len(parts) > 2 else "Open",
                "phase": parts[3] if len(parts) > 3 else "システムテスト",
            })

    sev_counts = {}
    for d in defects:
        sev_counts[d["severity"]] = sev_counts.get(d["severity"], 0) + 1

    # 報告書テンプレート
    report_md = f"""# テストサマリーレポート
**プロジェクト**: {pname}　**クライアント**: {cname}　**報告日**: {TODAY.isoformat()}

## 1. エグゼクティブサマリー
| 指標 | 値 |
|---|---|
| テスト消化率 | {dashboard['overall_exec_rate']}% |
| 合格率 | {dashboard['overall_pass_rate']}% |
| 総欠陥数 | {len(defects)} |
| Critical欠陥 | {sev_counts.get('Critical', 0)} |
| Major欠陥 | {sev_counts.get('Major', 0)} |

## 2. フェーズ別進捗
（進捗ダッシュボード参照）

## 3. 欠陥サマリー
| Severity | 件数 |
|---|---|
| Critical | {sev_counts.get('Critical', 0)} |
| Major | {sev_counts.get('Major', 0)} |
| Minor | {sev_counts.get('Minor', 0)} |

## 4. リリース判定
{dashboard['release_status']}

## 5. 残課題・推奨事項
（未解決欠陥・リスクを記載）

## 6. 次のアクション
| # | アクション | 担当 | 期日 |
|---|---|---|---|
| 1 | 未解決欠陥の是正 | 開発チーム | TBD |
| 2 | 回帰テスト実施 | QAチーム | TBD |

---
*本報告書は第三者検証機関として独立した立場で作成されました。*
"""

    return {
        "project_name": pname,
        "client_name": cname,
        "dashboard": dashboard,
        "defects": defects,
        "sev_counts": sev_counts,
        "report_md": report_md,
        "n_defects": len(defects),
    }
