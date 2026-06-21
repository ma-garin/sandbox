from __future__ import annotations

from dataclasses import replace
from urllib.parse import urlparse

from .kano import evaluate_kano_ux_review
from .models import GeneratedDocument, PageAnalysis, SystemAnalysis


def _line_items(values: list[str], empty: str = "未検出") -> str:
    if not values:
        return f"- {empty}"
    return "\n".join(f"- {value}" for value in values)


def _confidence_label(value: float) -> str:
    if value >= 0.75:
        return "高"
    if value >= 0.55:
        return "中"
    return "低"


def _system_name(analysis: PageAnalysis) -> str:
    return analysis.title or urlparse(analysis.url).netloc


def _primary_purpose(analysis: PageAnalysis) -> str:
    if analysis.description:
        return analysis.description
    if analysis.headings:
        return analysis.headings[0]
    return f"{urlparse(analysis.url).netloc} で提供されるWebシステム"


def _feature_candidates(analysis: PageAnalysis) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    for item in analysis.actions:
        if item.label == "名称未取得":
            continue
        candidates.append(
            {
                "name": item.label,
                "source": item.evidence.source,
                "evidence": f"{item.kind}: {item.label}",
                "confidence": _confidence_label(item.evidence.confidence),
                "review_required": "はい",
            }
        )
    for form in analysis.forms:
        candidates.append(
            {
                "name": form.label,
                "source": form.evidence.source,
                "evidence": form.evidence.text,
                "confidence": _confidence_label(form.evidence.confidence),
                "review_required": "はい",
            }
        )
    for link in analysis.links:
        if link.is_external or link.text == "名称未取得":
            continue
        candidates.append(
            {
                "name": link.text,
                "source": link.evidence.source,
                "evidence": link.href,
                "confidence": _confidence_label(link.evidence.confidence),
                "review_required": "いいえ" if link.evidence.confidence >= 0.75 else "はい",
            }
        )
    if not candidates and analysis.headings:
        for heading in analysis.headings[:5]:
            candidates.append(
                {
                    "name": heading,
                    "source": "h1-h3",
                    "evidence": heading,
                    "confidence": "中",
                    "review_required": "はい",
                }
            )
    return candidates


def _doc(
    title: str,
    slug: str,
    body: str,
    *,
    evidence: list[str],
    confidence: str = "中",
    unresolved_questions: list[str] | None = None,
    review_status: str = "未レビュー",
) -> GeneratedDocument:
    questions = unresolved_questions or ["業務ルール、権限、例外処理はURLから断定できないため確認が必要。"]
    review_required = "はい" if review_status != "確認済み" or questions else "いいえ"
    metadata = f"""
## レビュー情報
- レビュー状態: {review_status}
- 確信度: {confidence}
- 人間レビュー要否: {review_required}

## 根拠
{_line_items(evidence, "根拠要素は未検出")}

## 未確認事項
{_line_items(questions, "未確認事項なし")}
"""
    return GeneratedDocument(
        title=title,
        slug=slug,
        markdown=f"# {title}\n\n{body.strip()}\n\n{metadata.strip()}\n",
        review_status=review_status,
        confidence=confidence,
        needs_review=review_required == "はい",
        evidence=evidence,
        unresolved_questions=questions,
    )


def _dedupe_rows(rows: list[dict[str, str]], keys: tuple[str, ...]) -> list[dict[str, str]]:
    seen: set[tuple[str, ...]] = set()
    output: list[dict[str, str]] = []
    for row in rows:
        marker = tuple(row.get(key, "") for key in keys)
        if marker in seen:
            continue
        seen.add(marker)
        output.append(row)
    return output


def _cell(value: object) -> str:
    return str(value).replace("|", "/").replace("\n", " ").strip()


def _markdown_table(rows: list[dict[str, str]], columns: list[tuple[str, str]], empty: str = "未検出") -> str:
    if not rows:
        return f"- {empty}"
    header = "| " + " | ".join(label for _, label in columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    body = [
        "| " + " | ".join(_cell(row.get(key, "")) for key, _ in columns) + " |"
        for row in rows
    ]
    return "\n".join([header, separator, *body])


def build_system_analysis(analyses: list[PageAnalysis], errors: list[dict[str, str]] | None = None) -> SystemAnalysis:
    if not analyses:
        raise ValueError("analyses must not be empty")

    screens: list[dict[str, str]] = []
    features: list[dict[str, str]] = []
    transitions: list[dict[str, str]] = []
    data_items: list[dict[str, str]] = []
    external_interfaces: list[dict[str, str]] = []
    traceability: list[dict[str, str]] = []
    page_ids: dict[str, str] = {}

    for index, analysis in enumerate(analyses, start=1):
        screen_id = f"SC-{index:02d}"
        page_ids[analysis.url] = screen_id
        purpose = _primary_purpose(analysis)
        screens.append(
            {
                "screen_id": screen_id,
                "title": analysis.title,
                "url": analysis.url,
                "screen_type": analysis.screen_type,
                "priority": str(analysis.priority),
                "purpose": purpose,
                "reason": analysis.discovery_reason,
                "confidence": "中" if analysis.title or analysis.headings else "低",
                "review_status": "未レビュー",
            }
        )
        traceability.append(
            {
                "artifact_id": screen_id,
                "artifact_type": "画面",
                "name": analysis.title,
                "source_url": analysis.url,
                "evidence": f"title={analysis.title or '未取得'}, h={len(analysis.headings)}",
                "confidence": "中",
                "review_required": "はい",
            }
        )

        for feature_index, candidate in enumerate(_feature_candidates(analysis), start=1):
            feature_id = f"FN-{len(features) + 1:03d}"
            features.append(
                {
                    "feature_id": feature_id,
                    "screen_id": screen_id,
                    "feature_name": candidate["name"],
                    "related_screen": analysis.title,
                    "source": candidate["source"],
                    "evidence": candidate["evidence"],
                    "confidence": candidate["confidence"],
                    "review_required": candidate["review_required"],
                }
            )
            traceability.append(
                {
                    "artifact_id": feature_id,
                    "artifact_type": "機能",
                    "name": candidate["name"],
                    "source_url": analysis.url,
                    "evidence": candidate["evidence"],
                    "confidence": candidate["confidence"],
                    "review_required": candidate["review_required"],
                }
            )

        for item in analysis.inputs:
            data_id = f"DT-{len(data_items) + 1:03d}"
            data_items.append(
                {
                    "data_id": data_id,
                    "screen_id": screen_id,
                    "screen_title": analysis.title,
                    "label": item.label,
                    "name": item.name or "-",
                    "type": item.input_type,
                    "source": item.evidence.source,
                    "confidence": _confidence_label(item.evidence.confidence),
                    "review_required": "はい",
                }
            )
            traceability.append(
                {
                    "artifact_id": data_id,
                    "artifact_type": "データ項目",
                    "name": item.label,
                    "source_url": analysis.url,
                    "evidence": f"{item.evidence.source}: {item.name or item.label}",
                    "confidence": _confidence_label(item.evidence.confidence),
                    "review_required": "はい",
                }
            )

        for link in analysis.links:
            if link.is_external:
                external_id = f"IF-{len(external_interfaces) + 1:03d}"
                external_interfaces.append(
                    {
                        "interface_id": external_id,
                        "screen_id": screen_id,
                        "kind": "external_link",
                        "name": link.text,
                        "url": link.href,
                        "source": link.evidence.source,
                        "confidence": _confidence_label(link.evidence.confidence),
                        "review_required": "はい",
                    }
                )
                traceability.append(
                    {
                        "artifact_id": external_id,
                        "artifact_type": "外部IF",
                        "name": link.text,
                        "source_url": analysis.url,
                        "evidence": link.href,
                        "confidence": _confidence_label(link.evidence.confidence),
                        "review_required": "はい",
                    }
                )
                continue
            transitions.append(
                {
                    "from_screen_id": screen_id,
                    "from_title": analysis.title,
                    "to": link.href,
                    "label": link.text,
                    "source": link.evidence.source,
                    "confidence": _confidence_label(link.evidence.confidence),
                    "review_required": "いいえ" if link.evidence.confidence >= 0.75 else "はい",
                }
            )

        for asset in analysis.external_assets:
            external_id = f"IF-{len(external_interfaces) + 1:03d}"
            external_interfaces.append(
                {
                    "interface_id": external_id,
                    "screen_id": screen_id,
                    "kind": asset.kind,
                    "name": urlparse(asset.url).netloc,
                    "url": asset.url,
                    "source": asset.evidence.source,
                    "confidence": _confidence_label(asset.evidence.confidence),
                    "review_required": "はい",
                }
            )
            traceability.append(
                {
                    "artifact_id": external_id,
                    "artifact_type": "外部IF",
                    "name": urlparse(asset.url).netloc,
                    "source_url": analysis.url,
                    "evidence": asset.url,
                    "confidence": _confidence_label(asset.evidence.confidence),
                    "review_required": "はい",
                }
            )

    features = _dedupe_rows(features, ("screen_id", "feature_name", "source"))
    transitions = _dedupe_rows(transitions, ("from_screen_id", "to", "label"))
    data_items = _dedupe_rows(data_items, ("screen_id", "label", "name"))
    external_interfaces = _dedupe_rows(external_interfaces, ("kind", "url"))
    traceability = _dedupe_rows(traceability, ("artifact_type", "name", "source_url", "evidence"))

    unanswered_questions = [
        {
            "question_id": "Q-001",
            "topic": "事業目的",
            "question": "対象システムの事業目的、KPI、利用者区分は何か。",
            "related_doc": "企画書 / 要件定義書",
            "status": "未レビュー",
        },
        {
            "question_id": "Q-002",
            "topic": "業務ルール",
            "question": "登録、更新、承認、取消などの業務ルールと例外条件は何か。",
            "related_doc": "業務フロー / 機能仕様書",
            "status": "未レビュー",
        },
        {
            "question_id": "Q-003",
            "topic": "権限",
            "question": "ログイン後画面、管理機能、ロール別権限は存在するか。",
            "related_doc": "要件定義書 / 非機能要件定義書",
            "status": "要確認",
        },
        {
            "question_id": "Q-004",
            "topic": "データ",
            "question": "入力項目の必須/任意、桁数、形式、DB物理名、保存先は何か。",
            "related_doc": "データ項目定義書",
            "status": "未レビュー",
        },
    ]
    if errors:
        unanswered_questions.append(
            {
                "question_id": "Q-005",
                "topic": "取得失敗",
                "question": f"{len(errors)}件のURL取得失敗があり、重要画面の欠落有無を確認する。",
                "related_doc": "画面一覧 / トレーサビリティ",
                "status": "要確認",
            }
        )

    handoff_risks = [
        {
            "risk_id": "R-001",
            "severity": "High",
            "category": "信頼性",
            "risk": "生成文書は未レビューであり、URLから見えない業務ルールが欠落している可能性がある。",
            "evidence": "レビュー状態=未レビュー、未確認事項あり",
            "mitigation": "文書ごとに確認済みに変更し、未確認事項を回答してから引継ぎに使用する。",
        },
        {
            "risk_id": "R-002",
            "severity": "High" if any(screen["screen_type"] in {"ログイン", "管理"} for screen in screens) else "Medium",
            "category": "セキュリティ",
            "risk": "認証、権限、個人情報保護、CSRF/Cookie属性はHTML観測だけでは判定できない。",
            "evidence": "公開HTML解析のみ",
            "mitigation": "ログイン後画面、サーバ設定、セキュリティ要件を別途確認する。",
        },
    ]
    if errors:
        handoff_risks.append(
            {
                "risk_id": "R-003",
                "severity": "High",
                "category": "信頼性",
                "risk": "取得失敗URLがあるため、画面一覧または遷移図が不完全な可能性がある。",
                "evidence": f"取得失敗 {len(errors)}件",
                "mitigation": "失敗URLを再解析するか、手動URL追加で補完する。",
            }
        )

    system = SystemAnalysis(
        pages=analyses,
        screens=screens,
        features=features,
        transitions=transitions,
        data_items=data_items,
        external_interfaces=external_interfaces,
        unanswered_questions=unanswered_questions,
        handoff_risks=handoff_risks,
        traceability=traceability,
        errors=errors or [],
    )
    return replace(system, kano_ux_review=evaluate_kano_ux_review(system))


def build_documents(analysis: PageAnalysis) -> list[GeneratedDocument]:
    return build_documents_for_pages([analysis])


def build_documents_for_pages(
    analyses: list[PageAnalysis],
    errors: list[dict[str, str]] | None = None,
) -> list[GeneratedDocument]:
    system = build_system_analysis(analyses, errors=errors)
    return _build_documents_from_system(system)


def _build_documents_from_system(system: SystemAnalysis) -> list[GeneratedDocument]:
    first = system.pages[0]
    name = _system_name(first)
    purpose = _primary_purpose(first)
    evidence = [f"{row['screen_id']}: {row['title']} / {row['url']}" for row in system.screens[:8]]
    questions = [row["question"] for row in system.unanswered_questions[:5]]
    feature_names = [row["feature_name"] for row in system.features]

    screen_columns = [
        ("screen_id", "ID"),
        ("title", "画面名"),
        ("screen_type", "分類"),
        ("priority", "優先度"),
        ("purpose", "画面目的"),
        ("reason", "探索理由"),
        ("review_status", "レビュー状態"),
    ]
    feature_columns = [
        ("feature_id", "ID"),
        ("feature_name", "機能候補"),
        ("related_screen", "関連画面"),
        ("source", "根拠要素"),
        ("confidence", "確信度"),
        ("review_required", "レビュー要否"),
    ]
    transition_columns = [
        ("from_screen_id", "遷移元"),
        ("from_title", "遷移元画面"),
        ("label", "ラベル"),
        ("to", "遷移先URL"),
        ("confidence", "確信度"),
        ("review_required", "レビュー要否"),
    ]
    data_columns = [
        ("data_id", "ID"),
        ("screen_title", "画面"),
        ("label", "項目名"),
        ("name", "name"),
        ("type", "型候補"),
        ("source", "根拠要素"),
        ("review_required", "レビュー要否"),
    ]
    external_columns = [
        ("interface_id", "ID"),
        ("kind", "種別"),
        ("name", "名称/ホスト"),
        ("url", "URL"),
        ("source", "根拠要素"),
        ("review_required", "レビュー要否"),
    ]
    question_columns = [
        ("question_id", "ID"),
        ("topic", "論点"),
        ("question", "確認事項"),
        ("related_doc", "関連文書"),
        ("status", "状態"),
    ]
    risk_columns = [
        ("risk_id", "ID"),
        ("severity", "Severity"),
        ("category", "ISO 25010"),
        ("risk", "引継ぎ阻害リスク"),
        ("evidence", "根拠"),
        ("mitigation", "対応"),
    ]
    kano_columns = [
        ("item_id", "ID"),
        ("classification", "狩野分類"),
        ("severity", "Severity"),
        ("iso25010", "ISO 25010"),
        ("finding", "UX課題/価値"),
        ("evidence", "根拠"),
        ("recommendation", "改善提案"),
        ("completion_gate", "完了条件"),
    ]
    trace_columns = [
        ("artifact_id", "ID"),
        ("artifact_type", "種別"),
        ("name", "対象"),
        ("source_url", "根拠URL"),
        ("evidence", "根拠要素"),
        ("confidence", "確信度"),
        ("review_required", "レビュー要否"),
    ]

    documents = [
        _doc(
            "企画書",
            "proposal",
            f"""
## 背景
対象URL群から観測できる公開画面情報をもとに、既存Webシステム `{name}` の目的と引継ぎ価値を整理する。

## 想定目的
{purpose}

## 想定ユーザー価値
{_line_items([f"{name} で `{feature}` を利用または参照できる" for feature in feature_names[:8]], "主要機能候補は未検出")}

## 対象範囲
- 解析ページ数: {len(system.pages)}
- 取得失敗URL数: {len(system.errors)}
- 標準方式: ルールベース / APIキー不要
""",
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "システム概要書",
            "system-overview",
            f"""
## システム名候補
{name}

## 概要
{purpose}

## 解析サマリー
- 画面候補: {len(system.screens)}
- 機能候補: {len(system.features)}
- 入力データ項目候補: {len(system.data_items)}
- 外部IF候補: {len(system.external_interfaces)}

## 重要画面候補
{_markdown_table(system.screens[:12], screen_columns, "画面候補は未検出")}
""",
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "要件定義書",
            "requirements",
            f"""
## 機能要求候補
{_markdown_table(system.features[:30], feature_columns, "機能要求候補は未検出")}

## 非機能要求候補
- 使用性: 主要導線と入力項目が利用者に理解できるラベルで提示されること。
- 信頼性: 入力フォーム送信時のエラー表示と再入力導線を備えること。
- セキュリティ: 認証・個人情報入力がある場合、通信と保存の保護を確認すること。
- 保守性: 画面、機能、データ項目の対応関係を追跡できること。

## 制約
- 本書は公開URLからの観測に基づくため、業務ルールとバックエンド仕様は推定扱い。
""",
            evidence=evidence + [row["evidence"] for row in system.features[:8]],
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "業務フロー / ユースケース一覧",
            "use-cases",
            f"""
## ユースケース候補
{_line_items([f"UC-{index:02d}: 利用者は `{feature}` を実行または参照する。" for index, feature in enumerate(feature_names[:20], start=1)], "ユースケース候補は未検出")}

## 業務フロー候補
1. 利用者が `{name}` にアクセスする。
2. 重要画面候補から目的画面を選択する。
3. 必要に応じて入力項目へ情報を入力する。
4. ボタン、フォーム、リンクにより処理または遷移を実行する。
5. 結果画面または関連画面へ遷移する。

## 遷移候補
{_markdown_table(system.transitions[:30], transition_columns, "遷移候補は未検出")}
""",
            evidence=evidence + [row["to"] for row in system.transitions[:8]],
            confidence="低" if not system.transitions else "中",
            unresolved_questions=questions,
        ),
        _doc(
            "アーキテクチャ設計書",
            "architecture",
            f"""
## 観測できた事実
- 解析ページ数: {len(system.pages)}
- 外部IF候補数: {len(system.external_interfaces)}
- 取得失敗URL数: {len(system.errors)}

## 推定アーキテクチャ
- クライアント: Webブラウザ
- フロントエンド: HTML/CSS/JavaScriptを配信するWeb UI
- バックエンド: フォーム送信または画面遷移を処理するWebアプリケーション
- 外部連携: 外部ドメインへのリンク、スクリプト、画像、CSSから推定

## 外部サービス候補
{_markdown_table(system.external_interfaces[:30], external_columns, "外部IF候補は未検出")}
""",
            evidence=evidence + [row["url"] for row in system.external_interfaces[:8]],
            confidence="低",
            unresolved_questions=[
                "サーバ構成、DB、認証基盤、CI/CD、監視、バックアップはURLのみでは断定不可。",
                *questions[:3],
            ],
        ),
        _doc(
            "画面一覧",
            "screen-list",
            f"""
## 画面候補
{_markdown_table(system.screens, screen_columns, "画面候補は未検出")}

## 取得失敗
{_markdown_table(system.errors, [("url", "URL"), ("reason", "探索理由"), ("error", "理由")], "取得失敗は未検出")}
""",
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "画面仕様書",
            "screen-spec",
            _screen_spec_markdown(system),
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "機能一覧",
            "feature-list",
            f"""
## 機能候補
{_markdown_table(system.features, feature_columns, "機能候補は未検出")}

## 抽出根拠
- ボタン、フォーム、主要リンクラベルから抽出。
- 同じ画面内で同一ラベル・同一根拠の候補は重複除外。
""",
            evidence=evidence + [row["evidence"] for row in system.features[:8]],
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "機能仕様書",
            "feature-spec",
            f"""
## 機能仕様候補
{_line_items([f"{row['feature_id']}: `{row['feature_name']}` は `{row['related_screen']}` の `{row['source']}` から推定。入力、遷移、権限、例外処理はレビューが必要。" for row in system.features[:30]], "機能仕様候補は未検出")}

## 共通例外
- 入力不備
- 通信失敗
- 権限不足
- 対象データなし
""",
            evidence=evidence + [row["evidence"] for row in system.features[:8]],
            confidence="低",
            unresolved_questions=questions,
        ),
        _doc(
            "データ項目定義書",
            "data-dictionary",
            f"""
## データ項目候補
{_markdown_table(system.data_items, data_columns, "データ項目候補は未検出")}

## 補完が必要な属性
- 必須/任意
- 桁数、形式、初期値
- DB論理名/物理名
- マスキング、暗号化、保持期間
""",
            evidence=evidence + [f"{row['source']}: {row['label']}" for row in system.data_items[:8]],
            confidence="中" if system.data_items else "低",
            unresolved_questions=questions,
        ),
        _doc(
            "外部インターフェース仕様書",
            "external-interface",
            f"""
## 外部IF候補
{_markdown_table(system.external_interfaces, external_columns, "外部IF候補は未検出")}

## 確認が必要なIF属性
- 通信方式、認証方式、タイムアウト、リトライ
- 障害時の縮退動作
- 個人情報または秘密情報の送受信有無
""",
            evidence=evidence + [row["url"] for row in system.external_interfaces[:8]],
            confidence="中" if system.external_interfaces else "低",
            unresolved_questions=questions,
        ),
        _doc(
            "非機能要件定義書",
            "non-functional-requirements",
            f"""
## 引継ぎ阻害リスク
{_markdown_table(system.handoff_risks, risk_columns, "阻害リスクは未検出")}

## ISO/IEC 25010 観点
- 使用性: 主要操作が明確なラベルで提示されること。
- 性能効率性: 初期表示と主要遷移が業務利用に支障ない時間で完了すること。
- 信頼性: フォーム送信の失敗時に再試行または復旧手段を提示すること。
- セキュリティ: HTTPS、Cookie属性、CSRF対策、権限管理を確認すること。
- 保守性: 画面、機能、データ項目、外部IFの対応関係を維持すること。
""",
            evidence=evidence + [row["evidence"] for row in system.handoff_risks],
            confidence="低",
            unresolved_questions=questions,
        ),
        _doc(
            "テスト観点表",
            "test-viewpoints",
            f"""
| 観点 | 対象 | 期待 |
|---|---|---|
| Guidebook Tour | 主要導線 | 見出し・リンクどおりに遷移できる |
| Money Tour | {feature_names[0] if feature_names else "主要機能"} | 中核機能が利用できる |
| Landmark Tour | 画面遷移 | 重要画面間の遷移が破綻しない |
| Intellectual Tour | 入力フォーム | 境界値・不正値で適切に扱われる |
| FedEx Tour | 入力データ | 入力から結果表示まで追跡できる |
| Saboteur Tour | フォーム/操作 | 連打、空送信、不正形式で破綻しない |
| Back Alley Tour | 補助リンク | 低頻度導線も破綻しない |

## 未確認事項一覧
{_markdown_table(system.unanswered_questions, question_columns, "確認事項は未検出")}
""",
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "狩野モデルUXレビュー",
            "kano-ux-review",
            f"""
## 分類別UXレビュー
{_markdown_table(system.kano_ux_review, kano_columns, "狩野モデルUXレビュー項目は未検出")}

## 判定方針
- 当たり前品質: 未レビュー、未確認事項、High以上リスク、取得失敗など、引継ぎ前に満たすべき最低条件。
- 一元的品質: 解析ページ数、根拠行数、レビュー済み率など、増えるほど実務価値が上がる条件。
- 魅力的品質: 品質ゲートや狩野分類など、迷いを減らす追加価値。
- 無関心品質: 開発引継ぎ短縮に直結しない装飾要素。
- 逆品質: 補助設定を出しすぎるなど、かえって主導線を妨げる要素。
""",
            evidence=evidence + [row["evidence"] for row in system.kano_ux_review[:8]],
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "RFD / ADR",
            "rfd-adr",
            f"""
## RFD: URL観測に基づくドキュメント生成

### 背景
アジャイル/DevOps/AIDDでは実装が先行し、人間が後から理解するための上流成果物が不足しやすい。

### 決定
公開URLから観測できる事実を根拠として、上流工程ドキュメントを推定生成する。AI/APIは標準機能にせず、必要時の任意補助に限定する。

### トレードオフ
- メリット: 既存システムの理解と引継ぎを高速化できる。
- デメリット: URLから見えない業務ルール、DB、インフラ、権限は断定できない。

### 適用範囲
- 対象ページ数: {len(system.pages)}
- 対象外: ログイン後画面、バックエンド実装、内部設計の断定
""",
            evidence=evidence,
            confidence="中",
            unresolved_questions=questions,
        ),
        _doc(
            "トレーサビリティマトリクス",
            "traceability",
            f"""
## トレーサビリティ
{_markdown_table(system.traceability, trace_columns, "追跡対象は未検出")}

## 未確認事項
{_markdown_table(system.unanswered_questions, question_columns, "確認事項は未検出")}
""",
            evidence=evidence + [row["evidence"] for row in system.traceability[:8]],
            confidence="中",
            unresolved_questions=questions,
        ),
    ]
    return documents


def _screen_spec_markdown(system: SystemAnalysis) -> str:
    sections: list[str] = []
    for analysis, screen in zip(system.pages, system.screens, strict=False):
        input_rows = [
            {
                "label": item.label,
                "name": item.name or "-",
                "type": item.input_type,
                "source": item.evidence.source,
                "confidence": _confidence_label(item.evidence.confidence),
            }
            for item in analysis.inputs
        ]
        action_rows = [
            {
                "label": item.label,
                "kind": item.kind,
                "type": item.input_type,
                "source": item.evidence.source,
                "confidence": _confidence_label(item.evidence.confidence),
            }
            for item in analysis.actions
        ]
        sections.append(
            f"""
## {screen['screen_id']} {analysis.title}
- URL: {analysis.url}
- 分類: {analysis.screen_type}
- 画面目的: {_primary_purpose(analysis)}
- レビュー状態: 未レビュー

### 表示項目
{_line_items(analysis.headings[:25], "見出しは未検出")}

### 主要操作
{_markdown_table(action_rows[:30], [("label", "ラベル"), ("kind", "種別"), ("type", "型"), ("source", "根拠"), ("confidence", "確信度")], "操作要素は未検出")}

### 入力項目
{_markdown_table(input_rows[:40], [("label", "項目名"), ("name", "name"), ("type", "型候補"), ("source", "根拠"), ("confidence", "確信度")], "入力項目は未検出")}
"""
        )
    return "\n".join(section.strip() for section in sections)


def bundle_markdown(documents: list[GeneratedDocument]) -> str:
    return "\n\n---\n\n".join(document.markdown for document in documents)
