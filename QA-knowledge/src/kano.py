from __future__ import annotations

from .models import GeneratedDocument, SystemAnalysis


KANO_CATEGORIES = ("当たり前品質", "一元的品質", "魅力的品質", "無関心品質", "逆品質")
HIGH_SEVERITIES = {"Critical", "High"}
DONE_STATUS = "確認済み"
ANSWERED_STATUSES = {"回答済み", "確認済み"}


def _question_answered(question: dict[str, str], answers: dict[str, str]) -> bool:
    answer = answers.get(question.get("question_id", ""), "").strip()
    return bool(answer) or question.get("status", "") in ANSWERED_STATUSES


def build_completion_gate(
    system: SystemAnalysis,
    *,
    documents: list[GeneratedDocument] | None = None,
    review_statuses: dict[str, str] | None = None,
    question_answers: dict[str, str] | None = None,
    high_risk_confirmed: bool = False,
) -> dict[str, object]:
    """レビュー完了条件をUIと狩野レビューで共有する。"""
    documents = documents or []
    review_statuses = review_statuses or {}
    question_answers = question_answers or {}

    unreviewed_documents = [
        document
        for document in documents
        if review_statuses.get(document.slug, document.review_status) != DONE_STATUS
    ]
    unanswered_questions = [
        question for question in system.unanswered_questions if not _question_answered(question, question_answers)
    ]
    high_risks = [risk for risk in system.handoff_risks if risk.get("severity") in HIGH_SEVERITIES]

    documents_reviewed = bool(documents) and not unreviewed_documents
    questions_answered = not unanswered_questions
    high_risks_reviewed = not high_risks or high_risk_confirmed
    export_ready = documents_reviewed and questions_answered and high_risks_reviewed

    remaining: list[str] = []
    if not documents_reviewed:
        remaining.append(f"未レビュー文書 {len(unreviewed_documents)}件を確認済みにする")
    if not high_risks_reviewed:
        remaining.append(f"High以上リスク {len(high_risks)}件を確認する")
    if not questions_answered:
        remaining.append(f"未確認事項 {len(unanswered_questions)}件に回答する")
    if documents and not export_ready:
        remaining.append("品質ゲート達成後にレビュー済み版を出力する")

    return {
        "total_documents": len(documents),
        "unreviewed_documents": len(unreviewed_documents),
        "unanswered_questions": len(unanswered_questions),
        "high_risk_count": len(high_risks),
        "documents_reviewed": documents_reviewed,
        "questions_answered": questions_answered,
        "high_risks_reviewed": high_risks_reviewed,
        "export_ready": export_ready,
        "remaining": remaining,
    }


def evaluate_kano_ux_review(
    system: SystemAnalysis,
    *,
    documents: list[GeneratedDocument] | None = None,
    review_statuses: dict[str, str] | None = None,
    question_answers: dict[str, str] | None = None,
    high_risk_confirmed: bool = False,
) -> list[dict[str, str]]:
    gate = build_completion_gate(
        system,
        documents=documents,
        review_statuses=review_statuses,
        question_answers=question_answers,
        high_risk_confirmed=high_risk_confirmed,
    )
    rows: list[dict[str, str]] = []

    def add(
        classification: str,
        severity: str,
        iso25010: str,
        finding: str,
        evidence: str,
        recommendation: str,
        completion_gate: str,
    ) -> None:
        rows.append(
            {
                "item_id": f"KANO-{len(rows) + 1:03d}",
                "classification": classification,
                "severity": severity,
                "iso25010": iso25010,
                "finding": finding,
                "evidence": evidence,
                "recommendation": recommendation,
                "completion_gate": completion_gate,
            }
        )

    if gate["unreviewed_documents"]:
        add(
            "当たり前品質",
            "High",
            "使用性",
            "未レビュー文書が残っており、引継ぎ前の判断状態が不明確。",
            f"未レビュー文書 {gate['unreviewed_documents']}件 / 全{gate['total_documents']}件",
            "文書レビューで全成果物を確認済みにする。",
            "全文書が確認済み",
        )
    elif documents:
        add(
            "一元的品質",
            "Low",
            "使用性",
            "文書レビュー済み率が100%で、出力前確認の効率が高い。",
            f"確認済み {gate['total_documents']}件 / 全{gate['total_documents']}件",
            "レビュー済み版MarkdownとZIPを引継ぎ単位で出力する。",
            "全文書が確認済み",
        )
    else:
        unreviewed_screens = [screen for screen in system.screens if screen.get("review_status") != DONE_STATUS]
        if unreviewed_screens:
            add(
                "当たり前品質",
                "High",
                "使用性",
                "画面候補が未レビューで、成果物化前の確認状態が弱い。",
                f"未レビュー画面 {len(unreviewed_screens)}件",
                "画面一覧と根拠を確認し、重要画面の欠落有無を判断する。",
                "画面候補を確認",
            )

    if gate["unanswered_questions"]:
        add(
            "当たり前品質",
            "High",
            "信頼性",
            "未確認事項が残っており、URLから断定できない業務ルールが未解決。",
            f"未回答 {gate['unanswered_questions']}件",
            "根拠・確認事項で回答メモを入力し、CSVに反映する。",
            "未確認事項が回答済み",
        )

    if gate["high_risk_count"] and not gate["high_risks_reviewed"]:
        add(
            "当たり前品質",
            "High",
            "信頼性",
            "High以上の引継ぎ阻害リスクが確認未了。",
            f"High以上リスク {gate['high_risk_count']}件",
            "High以上リスクを確認し、引継ぎ時の注意点として明示する。",
            "High以上リスク確認済み",
        )

    if system.errors:
        add(
            "当たり前品質",
            "High",
            "信頼性",
            "取得失敗URLがあり、画面一覧や遷移候補が不完全な可能性がある。",
            f"取得失敗 {len(system.errors)}件",
            "失敗URLを再解析するか、追加URLで補完する。",
            "取得失敗の扱いを確認",
        )

    add(
        "一元的品質",
        "Medium",
        "保守性",
        "解析ページ数とトレーサビリティ行数が増えるほど、引継ぎ時の追跡性が上がる。",
        f"解析ページ {len(system.pages)}件 / トレーサビリティ {len(system.traceability)}件",
        "重要画面候補を優先度順に確認し、根拠の薄い候補を補完する。",
        "根拠付き成果物を維持",
    )
    add(
        "一元的品質",
        "Medium",
        "使用性",
        "レビュー完了条件を可視化すると、次に何を確認すべきか判断しやすい。",
        f"残作業 {len(gate['remaining'])}件",
        "ダッシュボードで残作業と出力可能性を継続表示する。",
        "レビュー完了条件を表示",
    )
    add(
        "魅力的品質",
        "Low",
        "使用性",
        "狩野分類でUX課題を分けることで、今直すべき項目を説明しやすい。",
        "分類軸=当たり前品質/一元的品質/魅力的品質",
        "改善タブで分類別件数とHigh以上項目を提示する。",
        "改善優先度を提示",
    )
    add(
        "魅力的品質",
        "Low",
        "保守性",
        "出力前の品質ゲートにより、未確認のまま成果物を渡すリスクを下げられる。",
        f"出力可能性={'可' if gate['export_ready'] else '不可'}",
        "ZIP出力とレビュー済み版Markdownの前に品質ゲートを確認する。",
        "出力可能性を表示",
    )
    add(
        "無関心品質",
        "Low",
        "使用性",
        "装飾的な表現は開発引継ぎ短縮に直結しない。",
        "目的=開発引継ぎ短縮、主要成果物=レビュー済み文書/根拠/CSV",
        "大きなヒーロー装飾より、入力、残作業、根拠確認を優先する。",
        "業務導線を優先",
    )
    add(
        "逆品質",
        "Medium",
        "使用性",
        "詳細設定や補助入力を初期導線に出しすぎると、起点URL投入の迷いが増える。",
        "補助入力=追加URL/安全上限ページ数",
        "追加URLと安全上限は詳細設定に収め、起点URLを主操作にする。",
        "初期入力を単純化",
    )

    return rows
