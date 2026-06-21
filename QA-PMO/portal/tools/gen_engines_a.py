"""テストケース生成エンジン A（決定的アルゴリズム・AIなし・外部依存なし）。

提供する2つのエンジン:
  1. spec_to_tc(spec_text, feature_name, test_types)
     仕様テキスト → 実行可能なテストケース一覧（ISTQB FL / ISO 29119準拠）

  2. exploratory_charters(feature, time_budget_min, areas, risk_level)
     探索的テスト セッション憲章 SBTM形式（Session-Based Test Management）

どちらも純Python・外部API不使用・完全決定的。
Djangoテンプレートが直接描画できるdict/listを返す。
"""
from __future__ import annotations

import re
from typing import Any

# ─────────────────────────────────────────────────────────────────────
#  共通ユーティリティ
# ─────────────────────────────────────────────────────────────────────

_TYPE_LABEL = {
    "func":     "機能",
    "boundary": "境界値",
    "exception": "例外",
    "state":    "状態遷移",
    "security": "セキュリティ",
    "perf":     "性能",
}

_AREA_LABEL = {
    "func":        "機能",
    "boundary":    "境界値",
    "ux":          "UX/ユーザビリティ",
    "security":    "セキュリティ",
    "perf":        "性能",
    "integration": "統合/連携",
    "data":        "データ整合性",
}


def _tc_id(n: int) -> str:
    return f"TC-{n:03d}"


def _ch_id(n: int) -> str:
    return f"CH-{n:03d}"


# ─────────────────────────────────────────────────────────────────────
#  ドメインキーワード検出
# ─────────────────────────────────────────────────────────────────────

_DOMAIN_PATTERNS: list[tuple[str, str]] = [
    (r"ログイン|サインイン|認証|auth", "login"),
    (r"検索|サーチ|フィルタ|絞り込み", "search"),
    (r"登録|新規作成|作成|create|post", "create"),
    (r"更新|編集|変更|edit|update|put|patch", "update"),
    (r"削除|remove|delete", "delete"),
    (r"一覧|リスト|list|index", "list"),
    (r"詳細|detail|show|view", "detail"),
    (r"API|エンドポイント|endpoint|REST|GraphQL", "api"),
    (r"ファイル|アップロード|upload|ダウンロード|download|CSV|PDF|Excel", "file"),
    (r"メール|通知|notification|email|smtp", "mail"),
    (r"パスワード|password|passwd", "password"),
    (r"権限|ロール|role|permission|アクセス制御|RBAC", "rbac"),
    (r"支払|決済|購入|payment|cart|カート|注文|order", "payment"),
    (r"レポート|集計|統計|dashboard|ダッシュボード", "report"),
]

_CRUD_PATTERNS: list[tuple[str, str]] = [
    (r"作成|登録|新規|create|post|add|insert", "create"),
    (r"参照|表示|閲覧|取得|一覧|詳細|read|get|list|show|view|fetch", "read"),
    (r"更新|編集|変更|修正|update|put|patch|edit", "update"),
    (r"削除|remove|delete|destroy", "delete"),
]


def _detect_domains(text: str) -> set[str]:
    domains: set[str] = set()
    combined = text
    for pattern, label in _DOMAIN_PATTERNS:
        if re.search(pattern, combined, re.IGNORECASE):
            domains.add(label)
    return domains


def _detect_crud(text: str) -> set[str]:
    ops: set[str] = set()
    for pattern, label in _CRUD_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            ops.add(label)
    return ops


# ─────────────────────────────────────────────────────────────────────
#  知識ベース: テストケーステンプレート
#  各テンプレートは (title, priority, precondition, steps, test_data, authority)
#  steps は (action, expected) タプルのリスト
# ─────────────────────────────────────────────────────────────────────

Step = tuple[str, str]
Template = dict[str, Any]


def _t(title: str, priority: str, precondition: str,
       steps: list[Step], test_data: str, authority: str,
       domains: frozenset[str] | None = None,
       crud: frozenset[str] | None = None) -> Template:
    return {
        "title": title,
        "priority": priority,
        "precondition": precondition,
        "steps": steps,
        "test_data": test_data,
        "authority": authority,
        "domains": domains or frozenset(),
        "crud": crud or frozenset(),
    }


# ── 機能テスト (func) ─────────────────────────────────────────────
_FUNC_KB: list[Template] = [
    _t(
        title="正常系：新規データ登録が正常に完了すること",
        priority="High",
        precondition="対象機能にアクセス可能なユーザーでログイン済み、テストデータが未登録の状態",
        steps=[
            ("登録フォームを開く", "登録フォームが正常に表示される"),
            ("必須項目をすべて入力する", "入力内容がフォームに反映される"),
            ("「登録」ボタンをクリックする", "確認ダイアログまたはプレビューが表示される"),
            ("内容を確認し「確定」をクリックする", "「登録が完了しました」等の成功メッセージが表示される"),
            ("一覧画面へ遷移し登録したデータを確認する", "入力したデータが一覧に表示される"),
        ],
        test_data="氏名: 山田太郎、メールアドレス: test001@example.com、電話番号: 03-0000-0001",
        authority="ISTQB FL 4.3（ユースケーステスト）/ ISO 29119-4 テスト設計技法",
        domains=frozenset({"create"}),
        crud=frozenset({"create"}),
    ),
    _t(
        title="正常系：既存データの詳細が正しく表示されること",
        priority="High",
        precondition="テストデータが1件以上登録済み、参照権限を持つユーザーでログイン済み",
        steps=[
            ("一覧画面を開く", "登録済みデータの一覧が表示される"),
            ("対象レコードの「詳細」リンクをクリックする", "詳細画面へ遷移する"),
            ("表示されたデータを登録済みデータと照合する", "全フィールドが正確に表示される"),
            ("ブラウザの戻るボタンで一覧へ戻る", "一覧画面に正常に戻れる"),
        ],
        test_data="ID: 1001、登録済みレコードを使用",
        authority="ISTQB FL 4.3（ユースケーステスト）",
        domains=frozenset({"detail", "read"}),
        crud=frozenset({"read"}),
    ),
    _t(
        title="正常系：データ更新が正常に完了すること",
        priority="High",
        precondition="更新権限を持つユーザーでログイン済み、更新対象レコードが存在する",
        steps=[
            ("対象レコードの詳細画面を開く", "詳細画面が表示される"),
            ("「編集」ボタンをクリックする", "編集フォームが表示され、現在の値が入力されている"),
            ("変更したいフィールドを新しい値に書き換える", "変更内容がフォームに反映される"),
            ("「保存」ボタンをクリックする", "更新成功メッセージが表示される"),
            ("詳細画面で更新後の値を確認する", "変更が正しく反映されている"),
        ],
        test_data="更新前: 氏名=山田太郎 → 更新後: 氏名=山田花子",
        authority="ISTQB FL 4.3（ユースケーステスト）/ ISO 29119-4",
        crud=frozenset({"update"}),
    ),
    _t(
        title="正常系：データ削除が正常に完了すること",
        priority="High",
        precondition="削除権限を持つユーザーでログイン済み、削除対象レコードが存在する",
        steps=[
            ("削除対象レコードの詳細画面または一覧を開く", "対象レコードが表示される"),
            ("「削除」ボタンをクリックする", "削除確認ダイアログが表示される"),
            ("「OK」をクリックして削除を確定する", "削除成功メッセージが表示される"),
            ("一覧画面でレコードが消えていることを確認する", "削除したレコードが一覧に存在しない"),
            ("削除レコードのURLへ直接アクセスする", "404またはアクセス不可のメッセージが表示される"),
        ],
        test_data="削除対象ID: 1002（関連データなし）",
        authority="ISTQB FL 4.3（ユースケーステスト）",
        crud=frozenset({"delete"}),
    ),
    _t(
        title="正常系：検索・フィルタリングが正しく動作すること",
        priority="High",
        precondition="検索対象データが複数件登録済み、検索権限を持つユーザーでログイン済み",
        steps=[
            ("検索フォームにキーワードを入力する", "入力フィールドにキーワードが表示される"),
            ("「検索」ボタンをクリックする", "キーワードに一致するデータのみ一覧表示される"),
            ("一致件数を確認する", "実際の件数とUIの件数表示が一致する"),
            ("別のキーワードで再検索する", "新しいキーワードに一致するデータのみ表示される"),
            ("検索フォームをクリアして再表示する", "全件が一覧表示される"),
        ],
        test_data="検索キーワード: 「山田」（3件ヒット想定）",
        authority="ISTQB FL 4.3 / ユースケーステスト",
        domains=frozenset({"search"}),
    ),
    _t(
        title="正常系：ログイン機能が正常に動作すること",
        priority="High",
        precondition="有効なテストアカウントが登録済み（ユーザー名・パスワード既知）",
        steps=[
            ("ログインページを開く", "ログインフォームが表示される"),
            ("正しいユーザー名とパスワードを入力する", "入力内容がフォームに反映される"),
            ("「ログイン」ボタンをクリックする", "ホーム画面または指定のリダイレクト先へ遷移する"),
            ("ログインユーザーの情報（ヘッダ等）を確認する", "ログインしたユーザー名が表示される"),
            ("ブラウザを別タブで開き同一セッションが有効か確認する", "認証状態が維持され同じユーザーとして操作できる"),
        ],
        test_data="テストユーザー: qa_tester@example.com / Test@2024",
        authority="ISTQB FL 4.3 / OWASP Authentication Cheat Sheet",
        domains=frozenset({"login"}),
    ),
    _t(
        title="正常系：ファイルアップロードが正常に完了すること",
        priority="High",
        precondition="アップロード権限を持つユーザーでログイン済み、許可形式のテストファイルを用意",
        steps=[
            ("ファイルアップロード画面を開く", "ファイル選択ボタンが表示される"),
            ("許可形式（PDF/Excel/CSV等）のファイルを選択する", "ファイル名が選択欄に表示される"),
            ("「アップロード」ボタンをクリックする", "アップロード進捗が表示される"),
            ("アップロード完了メッセージを確認する", "「アップロードが完了しました」等のメッセージが表示される"),
            ("アップロードされたファイルを一覧で確認する", "ファイル名・サイズ・日時が正しく表示される"),
        ],
        test_data="テストファイル: sample_data.csv（100行、10KB）",
        authority="ISTQB FL 4.3 / ISO 29119-4",
        domains=frozenset({"file"}),
    ),
    _t(
        title="正常系：メール通知が正しく送信されること",
        priority="Medium",
        precondition="メール送信設定が完了、受信確認用メールアドレスを用意済み",
        steps=[
            ("メール通知をトリガーするアクションを実行する", "操作が正常に完了する"),
            ("「メールを送信しました」等の通知を確認する", "UIに送信完了の旨が表示される"),
            ("受信用メールクライアントを開く（数分待つ）", "メールが受信される"),
            ("メール件名・本文・差出人を確認する", "件名・本文・差出人が仕様通りである"),
            ("メール内リンクをクリックする（存在する場合）", "指定のページへ正しく遷移する"),
        ],
        test_data="送信先: qa-receive@example.com",
        authority="ISTQB FL 4.3",
        domains=frozenset({"mail"}),
    ),
    _t(
        title="正常系：APIエンドポイントが正しいレスポンスを返すこと",
        priority="High",
        precondition="APIサーバーが起動済み、有効な認証トークンを取得済み",
        steps=[
            ("APIクライアント（curl/Postman等）でGETリクエストを送信する", "HTTP 200 OKが返る"),
            ("レスポンスボディのJSONスキーマを確認する", "仕様書のスキーマと一致している"),
            ("必須フィールドの存在と型を確認する", "全必須フィールドが存在し正しい型である"),
            ("Content-Typeヘッダを確認する", "application/jsonが返る"),
            ("応答時間を計測する", "2秒以内にレスポンスが返る（性能基準値）"),
        ],
        test_data="GET /api/v1/items?limit=10&offset=0 Authorization: Bearer {token}",
        authority="ISTQB FL 4.3 / OpenAPI Specification 3.x",
        domains=frozenset({"api"}),
    ),
    _t(
        title="正常系：権限に応じた画面・機能の表示制御が正しく動作すること",
        priority="High",
        precondition="異なる権限（管理者・一般ユーザー・閲覧のみ）のテストアカウントを用意済み",
        steps=[
            ("管理者アカウントでログインし機能一覧を確認する", "管理者向けの全機能が表示される"),
            ("一般ユーザーアカウントでログインし機能を確認する", "制限された機能のみ表示される"),
            ("閲覧専用アカウントで操作ボタンの有無を確認する", "編集・削除ボタンが非表示または無効化されている"),
            ("URLを直接入力して権限外ページへのアクセスを試みる", "403 Forbiddenまたはリダイレクトされる"),
        ],
        test_data="管理者: admin@example.com / 一般: user@example.com / 閲覧: readonly@example.com",
        authority="ISTQB FL 4.3 / OWASP Access Control Cheat Sheet",
        domains=frozenset({"rbac"}),
    ),
    _t(
        title="正常系：ページネーション・ソートが正しく動作すること",
        priority="Medium",
        precondition="一覧表示対象データが30件以上登録済み",
        steps=[
            ("一覧画面を開く", "先頭ページのデータが表示される（デフォルトページサイズ通り）"),
            ("「次へ」ボタンをクリックする", "次ページのデータが表示され、ページ番号が増加する"),
            ("最終ページへ移動する", "最終ページのデータのみ表示される"),
            ("ソート列をクリックする", "昇順にソートされる"),
            ("同列を再クリックする", "降順にソートされる"),
        ],
        test_data="データ件数: 50件、ページサイズ: 20件",
        authority="ISTQB FL 4.3 / ISO 29119-4",
        domains=frozenset({"list"}),
    ),
    _t(
        title="業務ルール：必須フィールド未入力時に登録が阻止されること",
        priority="High",
        precondition="登録フォームへアクセス可能なユーザーでログイン済み",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("必須フィールドを空欄のまま「登録」ボタンをクリックする", "登録されずエラーメッセージが表示される"),
            ("エラーメッセージの内容を確認する", "どのフィールドが未入力かを示すメッセージが表示される"),
            ("必須フィールドのみ入力し再度「登録」をクリックする", "登録が成功する"),
        ],
        test_data="全必須フィールドを意図的に空欄",
        authority="ISTQB FL 4.3（デシジョンテーブルテスト）",
        crud=frozenset({"create"}),
    ),
    _t(
        title="業務ルール：重複データの登録が阻止されること",
        priority="High",
        precondition="同一ユニークキー（メールアドレス等）のデータが1件登録済み",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("既存データと同じユニークキー値を入力する", "入力内容がフォームに反映される"),
            ("「登録」ボタンをクリックする", "登録が阻止され「既に登録済みです」等のエラーが表示される"),
            ("別の一意な値に変更して再登録する", "登録が正常に完了する"),
        ],
        test_data="重複メール: existing@example.com（既登録済み）",
        authority="ISTQB FL 4.3（デシジョンテーブル）/ データ整合性制約",
        crud=frozenset({"create"}),
    ),
    _t(
        title="業務ルール：ログアウト後にセッションが無効化されること",
        priority="High",
        precondition="ログイン済みの状態",
        steps=[
            ("ログアウトボタンをクリックする", "ログアウト完了画面またはログイン画面へ遷移する"),
            ("ブラウザの戻るボタンで前のページへ戻ろうとする", "ログイン画面へリダイレクトされる"),
            ("ログイン必須ページへURLを直接入力する", "ログイン画面へリダイレクトされる"),
            ("Cookieを確認する", "セッションCookieが削除またはInvalid化されている"),
        ],
        test_data="ログインユーザー: qa_tester@example.com",
        authority="OWASP Session Management Cheat Sheet / ISTQB FL 4.3",
        domains=frozenset({"login"}),
    ),
]

# ── 境界値テスト (boundary) ──────────────────────────────────────
_BOUNDARY_KB: list[Template] = [
    _t(
        title="境界値：文字列入力フィールドの最小文字数（下限）で登録できること",
        priority="High",
        precondition="登録フォームにアクセス可能な状態",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("対象フィールドに仕様の最小文字数と同数の文字を入力する（例：1文字）", "入力が受け付けられる"),
            ("他必須フィールドを入力し「登録」をクリックする", "登録が正常に完了する"),
            ("登録されたデータを詳細画面で確認する", "入力した最小文字数の値が正しく保存されている"),
        ],
        test_data="フィールド名: 氏名（最小1文字）、入力値: 「山」",
        authority="ISTQB FL 4.2（境界値分析：下限値 min）",
    ),
    _t(
        title="境界値：文字列入力フィールドの最大文字数（上限）で登録できること",
        priority="High",
        precondition="登録フォームにアクセス可能な状態",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("対象フィールドに仕様の最大文字数と同数の文字を入力する", "入力が受け付けられる"),
            ("他必須フィールドを入力し「登録」をクリックする", "登録が正常に完了する"),
            ("登録されたデータを確認する", "最大文字数の値が正しく保存されている"),
        ],
        test_data="フィールド名: 氏名（最大50文字）、入力値: 50文字の日本語文字列",
        authority="ISTQB FL 4.2（境界値分析：上限値 max）",
    ),
    _t(
        title="境界値：最大文字数+1文字の入力が拒否されること",
        priority="High",
        precondition="登録フォームにアクセス可能な状態",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("対象フィールドに最大文字数+1文字を入力する", "入力が拒否される（または入力が途中で切れる）"),
            ("エラーメッセージを確認する", "最大文字数超過を示すエラーメッセージが表示される"),
            ("最大文字数ちょうどに修正して登録する", "登録が正常に完了する"),
        ],
        test_data="フィールド名: 氏名（最大50文字）、入力値: 51文字の文字列",
        authority="ISTQB FL 4.2（境界値分析：max+1）",
    ),
    _t(
        title="境界値：最小文字数-1文字（0文字/空欄）の入力が拒否されること",
        priority="High",
        precondition="登録フォームにアクセス可能な状態",
        steps=[
            ("登録フォームを開く", "フォームが表示される"),
            ("必須フィールドを空欄のまま「登録」をクリックする", "登録が拒否される"),
            ("エラーメッセージを確認する", "「入力してください」等の必須エラーが表示される"),
        ],
        test_data="フィールド名: 氏名（最小1文字）、入力値: 空欄（0文字）",
        authority="ISTQB FL 4.2（境界値分析：min-1）",
    ),
    _t(
        title="境界値：数値フィールドの下限値（最小値）で登録できること",
        priority="High",
        precondition="数値入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("数値フィールドに仕様の最小値を入力する", "入力が受け付けられる"),
            ("「登録」をクリックする", "登録が正常に完了する"),
            ("保存された値を確認する", "最小値が正しく保存されている"),
        ],
        test_data="フィールド名: 年齢（最小0歳）、入力値: 0",
        authority="ISTQB FL 4.2（境界値分析）",
    ),
    _t(
        title="境界値：数値フィールドの上限値（最大値）で登録できること",
        priority="High",
        precondition="数値入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("数値フィールドに仕様の最大値を入力する", "入力が受け付けられる"),
            ("「登録」をクリックする", "登録が正常に完了する"),
            ("保存された値を確認する", "最大値が正しく保存されている"),
        ],
        test_data="フィールド名: 年齢（最大150歳）、入力値: 150",
        authority="ISTQB FL 4.2（境界値分析）",
    ),
    _t(
        title="境界値：数値フィールドの最大値+1が拒否されること",
        priority="High",
        precondition="数値入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("数値フィールドに最大値+1を入力する", "入力が受け付けられるか確認"),
            ("「登録」をクリックする", "登録が拒否されバリデーションエラーが表示される"),
            ("エラーメッセージを確認する", "「最大値を超えています」等のメッセージが表示される"),
        ],
        test_data="フィールド名: 年齢（最大150）、入力値: 151",
        authority="ISTQB FL 4.2（境界値分析：max+1）",
    ),
    _t(
        title="境界値：日付フィールドの最小日付（システム開始日）で登録できること",
        priority="Medium",
        precondition="日付入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("日付フィールドにシステム許容の最小日付を入力する", "入力が受け付けられる"),
            ("「登録」をクリックする", "登録が正常に完了する"),
            ("保存された日付を確認する", "最小日付が正しく保存されている"),
        ],
        test_data="フィールド名: 開始日、最小日付: 2000-01-01",
        authority="ISTQB FL 4.2（境界値分析）",
    ),
    _t(
        title="境界値：日付フィールドで「本日」が正しく扱われること",
        priority="Medium",
        precondition="日付入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("日付フィールドに今日の日付を入力する", "入力が受け付けられる"),
            ("「登録」をクリックする", "登録が完了する"),
            ("翌日にシステムを開いてデータを確認する", "前日に登録した日付が正しく表示される"),
        ],
        test_data="フィールド名: 開始日、入力値: 本日の日付（システム日付と同一）",
        authority="ISTQB FL 4.2（境界値分析：日時）",
    ),
    _t(
        title="境界値：ファイルアップロードの最大許容サイズで成功すること",
        priority="High",
        precondition="ファイルアップロード機能にアクセス可能",
        steps=[
            ("ファイルアップロード画面を開く", "アップロード画面が表示される"),
            ("最大許容サイズ（例：10MB）のファイルを選択する", "ファイルが選択される"),
            ("「アップロード」をクリックする", "アップロードが正常に完了する"),
        ],
        test_data="ファイル: test_max.csv（10MB）",
        authority="ISTQB FL 4.2（境界値分析）",
        domains=frozenset({"file"}),
    ),
    _t(
        title="境界値：ファイルアップロードの最大サイズ+1バイトで拒否されること",
        priority="High",
        precondition="ファイルアップロード機能にアクセス可能",
        steps=[
            ("ファイルアップロード画面を開く", "アップロード画面が表示される"),
            ("最大許容サイズを超えるファイルを選択する（例：10MB+1byte）", "選択または即時バリデーションエラーが発生する"),
            ("「アップロード」をクリックする（選択できた場合）", "アップロードが拒否されエラーメッセージが表示される"),
            ("エラーメッセージを確認する", "「ファイルサイズが上限を超えています」等が表示される"),
        ],
        test_data="ファイル: test_oversize.bin（10MB+1byte）",
        authority="ISTQB FL 4.2（境界値分析：max+1）",
        domains=frozenset({"file"}),
    ),
]

# ── 例外テスト (exception) ──────────────────────────────────────
_EXCEPTION_KB: list[Template] = [
    _t(
        title="例外：ネットワーク遮断時に適切なエラーメッセージが表示されること",
        priority="High",
        precondition="ブラウザの開発者ツールでネットワーク制限を設定可能な環境",
        steps=[
            ("ブラウザ開発者ツールでネットワークを「オフライン」に設定する", "設定が反映される"),
            ("登録ボタン等のサーバー通信を伴う操作を実行する", "エラーメッセージが表示される"),
            ("エラーメッセージの内容を確認する", "「ネットワークエラー」等のユーザーフレンドリーなメッセージが表示される"),
            ("ネットワークを復旧し再操作する", "操作が正常に完了する"),
        ],
        test_data="ブラウザ: Chrome 開発者ツール → Network → Throttling: Offline",
        authority="ISTQB FL 4.3（エラー推測）/ ISO 29119-4",
    ),
    _t(
        title="例外：サーバーエラー（500）発生時に適切なエラー画面が表示されること",
        priority="High",
        precondition="サーバー側にエラーを意図的に発生させる手段がある（またはモックで再現）",
        steps=[
            ("サーバー側で500エラーを返すよう設定する", "設定が反映される"),
            ("対象APIまたは画面にリクエストを送る", "500エラーがUIに通知される"),
            ("エラー画面またはメッセージを確認する", "スタックトレース等の機密情報が露出していない"),
            ("ユーザーへの案内（問い合わせ先等）を確認する", "適切な案内文が表示される"),
        ],
        test_data="エラーコード: HTTP 500 Internal Server Error（モック/設定で再現）",
        authority="OWASP Error Handling Cheat Sheet / ISTQB FL 4.3",
    ),
    _t(
        title="例外：セッションタイムアウト後に操作した場合に再ログインへ誘導されること",
        priority="High",
        precondition="セッションタイムアウト時間が既知（例：30分）",
        steps=[
            ("ログイン後、タイムアウト時間が経過するまで操作をしない（または開発者ツールでCookie削除）", "セッションが期限切れになる"),
            ("画面内の操作（保存・更新等）を実行する", "ログイン画面へリダイレクトされる"),
            ("「セッションが切れました」等のメッセージを確認する", "適切なメッセージが表示される"),
            ("再ログイン後に操作を再試行する", "正常に操作が完了する"),
        ],
        test_data="セッションタイムアウト: 30分（またはCookie削除で即時再現）",
        authority="OWASP Session Management Cheat Sheet / ISTQB FL 4.3",
        domains=frozenset({"login"}),
    ),
    _t(
        title="例外：不正なファイル形式のアップロードが拒否されること",
        priority="High",
        precondition="ファイルアップロード機能にアクセス可能",
        steps=[
            ("ファイルアップロード画面を開く", "画面が表示される"),
            ("許可されていない形式のファイル（例：.exe）を選択する", "選択できるか確認する"),
            ("「アップロード」をクリックする（選択できた場合）", "アップロードが拒否されエラーが表示される"),
            ("エラーメッセージを確認する", "「このファイル形式はアップロードできません」等が表示される"),
            ("許可ファイル形式を確認する", "UIに許可形式が案内されている"),
        ],
        test_data="不正ファイル: malicious.exe（拡張子偽装: malicious_csv.csv→実体はEXE）",
        authority="OWASP File Upload Cheat Sheet / ISTQB FL 4.3",
        domains=frozenset({"file"}),
    ),
    _t(
        title="例外：不正なメールアドレス形式の入力が拒否されること",
        priority="High",
        precondition="メールアドレスフィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("メールアドレスフィールドに不正な形式を入力する", "入力が受け付けられる（フロント側の制御を確認）"),
            ("「登録」をクリックする", "登録が拒否されバリデーションエラーが表示される"),
            ("エラーメッセージを確認する", "「メールアドレスの形式が正しくありません」等が表示される"),
            ("正しい形式に修正して再登録する", "登録が正常に完了する"),
        ],
        test_data="不正値: user@、user @example.com、user@.com、@@example.com",
        authority="RFC 5322 / ISTQB FL 4.3（エラー推測）",
    ),
    _t(
        title="例外：数値フィールドへの文字列入力が拒否されること",
        priority="Medium",
        precondition="数値入力フィールドを含むフォームにアクセス可能",
        steps=[
            ("フォームを開く", "フォームが表示される"),
            ("数値フィールドに文字列「abc」を入力する", "入力が拒否されるまたはバリデーションエラーになる"),
            ("「登録」をクリックする", "登録が拒否されエラーが表示される"),
            ("エラーメッセージを確認する", "「数値を入力してください」等が表示される"),
        ],
        test_data="入力値: 'abc'、'十'、'１２３'（全角数字）、'1.2.3'（複数ドット）",
        authority="ISTQB FL 4.2（同値分割：無効クラス）",
    ),
    _t(
        title="例外：存在しないリソースへのアクセス時に404が返ること",
        priority="Medium",
        precondition="システムにアクセス可能な状態",
        steps=[
            ("存在しないIDのURLへ直接アクセスする（例：/items/99999999）", "404エラーページまたはリダイレクトが表示される"),
            ("404エラーページの内容を確認する", "ユーザーフレンドリーな404メッセージが表示される"),
            ("機密情報（スタックトレース・DB情報等）が露出していないか確認する", "機密情報が含まれていない"),
            ("「トップへ戻る」等のリンクを確認する", "ナビゲーションリンクが提供されている"),
        ],
        test_data="存在しないURL: /api/v1/items/99999999",
        authority="OWASP Error Handling / ISTQB FL 4.3",
    ),
    _t(
        title="例外：タイムアウト設定時間内にレスポンスがない場合の挙動確認",
        priority="Medium",
        precondition="ネットワーク遅延をシミュレート可能な環境（開発者ツール等）",
        steps=[
            ("ブラウザ開発者ツールでネットワーク速度を「Slow 3G」等に制限する", "制限が反映される"),
            ("サーバー応答に時間がかかる操作を実行する", "ローディングインジケーターが表示される"),
            ("タイムアウト時間を経過させる", "タイムアウトエラーメッセージが表示される"),
            ("エラー後の操作を確認する", "再試行ボタンまたは案内が表示される"),
        ],
        test_data="タイムアウト設定: 30秒、遅延: 60秒（開発者ツールで設定）",
        authority="ISTQB FL 4.3（エラー推測）/ ISO 29119-4",
    ),
    _t(
        title="例外：SQLに特殊文字を含む入力でもシステムが正常動作すること",
        priority="High",
        precondition="フォームまたは検索機能にアクセス可能",
        steps=[
            ("検索または入力フィールドに「'; DROP TABLE users; --」を入力する", "入力が受け付けられる"),
            ("「検索」または「登録」をクリックする", "操作が完了するかエラーが表示される（DBエラーでないこと）"),
            ("DBまたはレスポンスにSQL文が混入していないか確認する", "SQLが実行されずエラーまたは通常の結果が返る"),
            ("システムログに異常がないか確認する", "Exceptionが記録されているが機密情報は含まれない"),
        ],
        test_data="入力値: 「'; DROP TABLE users; --」「1 OR 1=1」「UNION SELECT * FROM users」",
        authority="OWASP SQLi Cheat Sheet / ISTQB FL 4.3",
    ),
]

# ── 状態遷移テスト (state) ──────────────────────────────────────
_STATE_KB: list[Template] = [
    _t(
        title="状態遷移：未ログイン→ログイン→ログアウトの遷移が正しく動作すること",
        priority="High",
        precondition="有効なテストアカウントが登録済み",
        steps=[
            ("ログイン画面を表示する（未ログイン状態）", "ログインフォームが表示される"),
            ("正しい資格情報を入力しログインする", "ホーム画面へ遷移する（ログイン状態）"),
            ("ログアウトボタンをクリックする", "ログアウト完了画面またはログイン画面へ遷移する（未ログイン状態）"),
            ("ブラウザの戻るボタンを押す", "ログイン画面にとどまりホーム画面には戻れない"),
        ],
        test_data="テストアカウント: qa_tester@example.com / Test@2024",
        authority="ISTQB FL 4.4（状態遷移テスト）",
        domains=frozenset({"login"}),
    ),
    _t(
        title="状態遷移：下書き→審査中→承認→公開のワークフローが正しく遷移すること",
        priority="High",
        precondition="ワークフロー機能が有効、各ステータスに遷移できるロールのアカウントを用意済み",
        steps=[
            ("コンテンツを作成し「下書き保存」をクリックする", "ステータスが「下書き」になる"),
            ("「審査に提出」をクリックする", "ステータスが「審査中」になり審査者へ通知される"),
            ("審査者アカウントでログインし「承認」をクリックする", "ステータスが「承認済み」になる"),
            ("「公開」ボタンをクリックする", "ステータスが「公開」になり一般ユーザーに表示される"),
            ("「取り下げ」をクリックする（公開→非公開）", "ステータスが変わり一般ユーザーに表示されなくなる"),
        ],
        test_data="テストコンテンツ: 「テスト記事_状態遷移確認用」、審査者: reviewer@example.com",
        authority="ISTQB FL 4.4（状態遷移テスト）/ UML状態機械",
    ),
    _t(
        title="状態遷移：注文の「未払い→支払済み→発送済み→完了」の遷移確認",
        priority="High",
        precondition="EC機能が有効、テスト用商品と支払い手段を用意済み",
        steps=[
            ("商品をカートに入れ注文を確定する", "注文ステータスが「未払い」になる"),
            ("支払いを完了する", "ステータスが「支払済み」になり確認メールが届く"),
            ("管理者が発送処理を行う", "ステータスが「発送済み」に変わる"),
            ("受取確認を行う", "ステータスが「完了」になる"),
            ("完了後にキャンセルを試みる", "キャンセル不可のメッセージが表示される"),
        ],
        test_data="テスト商品: テスト商品A（¥1）、支払い: テストクレジットカード",
        authority="ISTQB FL 4.4（状態遷移テスト）",
        domains=frozenset({"payment"}),
    ),
    _t(
        title="状態遷移：アカウントのアクティブ→停止→再有効化の遷移が正しく動作すること",
        priority="High",
        precondition="管理者権限のアカウントと停止対象のテストアカウントを用意済み",
        steps=[
            ("対象アカウントが「アクティブ」状態であることを確認する", "アカウントが正常にログインできる"),
            ("管理者がアカウントを「停止」に変更する", "ステータスが「停止」になる"),
            ("停止されたアカウントでログインを試みる", "「アカウントが停止されています」等のメッセージが表示される"),
            ("管理者がアカウントを「再有効化」する", "ステータスが「アクティブ」に戻る"),
            ("再有効化後にログインする", "正常にログインできる"),
        ],
        test_data="停止対象: suspended_test@example.com、管理者: admin@example.com",
        authority="ISTQB FL 4.4（状態遷移テスト）",
        domains=frozenset({"rbac"}),
    ),
    _t(
        title="状態遷移：ファイルアップロードの「処理中→完了/エラー」の遷移確認",
        priority="Medium",
        precondition="ファイルアップロード機能にアクセス可能",
        steps=[
            ("大容量ファイルをアップロード開始する", "ステータスが「処理中」になる"),
            ("処理中にブラウザリロードする", "処理状態が維持されているか確認する"),
            ("処理が完了するまで待機する", "ステータスが「完了」になる"),
            ("意図的にエラーを発生させたファイルをアップロードする（例：壊れたCSV）", "ステータスが「エラー」になる"),
            ("エラー時にリトライ機能があるか確認する", "リトライボタンまたは案内が表示される"),
        ],
        test_data="正常ファイル: sample_large.csv（5MB）、エラーファイル: broken.csv（不正なエンコード）",
        authority="ISTQB FL 4.4（状態遷移テスト）",
        domains=frozenset({"file"}),
    ),
    _t(
        title="状態遷移：パスワードリセットフローが正しく遷移すること",
        priority="High",
        precondition="パスワードリセット機能が有効、テスト用メールアドレスにアクセス可能",
        steps=[
            ("ログイン画面の「パスワードを忘れた方」リンクをクリックする", "メールアドレス入力画面が表示される"),
            ("登録済みメールアドレスを入力し送信する", "「リセットメールを送信しました」が表示される"),
            ("受信したメールのリンクをクリックする", "新しいパスワード設定画面が表示される"),
            ("新しいパスワードを設定する", "パスワード変更完了メッセージが表示される"),
            ("新しいパスワードでログインする", "正常にログインできる"),
        ],
        test_data="テストメール: qa-reset@example.com",
        authority="ISTQB FL 4.4（状態遷移テスト）/ OWASP Password Reset Cheat Sheet",
        domains=frozenset({"login", "password", "mail"}),
    ),
]

# ── セキュリティテスト (security) ────────────────────────────────
_SECURITY_KB: list[Template] = [
    _t(
        title="セキュリティ：SQLインジェクション攻撃が阻止されること",
        priority="High",
        precondition="入力フィールドまたは検索機能にアクセス可能",
        steps=[
            ("検索フィールドに「' OR '1'='1」を入力し検索する", "通常の検索エラーまたは空結果が返る（DB全件が返らない）"),
            ("「'; DROP TABLE users; --」を入力し送信する", "エラーが表示されるがDBテーブルは存在する"),
            ("「UNION SELECT username, password FROM users --」を入力する", "機密データが返らない"),
            ("レスポンスにDB情報・スタックトレースが含まれないか確認する", "機密情報は含まれていない"),
        ],
        test_data="SQLi Payload: 「' OR '1'='1」「'; DROP TABLE users; --」「1 UNION SELECT null,null--」",
        authority="OWASP Top 10: A03 Injection / CWE-89 / ISTQB-AT セキュリティテスト",
    ),
    _t(
        title="セキュリティ：XSS（クロスサイトスクリプティング）が阻止されること",
        priority="High",
        precondition="ユーザー入力が表示される画面にアクセス可能",
        steps=[
            ("入力フィールドに「<script>alert('XSS')</script>」を入力し保存する", "入力が受け付けられる"),
            ("入力内容が表示される画面を開く", "スクリプトが実行されず、エスケープされて表示される"),
            ("「<img src=x onerror=alert(1)>」を入力し表示を確認する", "画像タグが無効化されアラートが実行されない"),
            ("「javascript:alert(1)」を含むURLリンクを入力する", "javascriptスキームが無効化されている"),
        ],
        test_data="XSS Payload: 「<script>alert('XSS')</script>」「<img src=x onerror=alert(1)>」「<svg onload=alert(1)>」",
        authority="OWASP Top 10: A03 / CWE-79 XSS / OWASP XSS Cheat Sheet",
    ),
    _t(
        title="セキュリティ：認証バイパスが不可能であること",
        priority="High",
        precondition="ログイン必須のページのURLが既知",
        steps=[
            ("ログインせずに保護されたページのURLへ直接アクセスする", "ログイン画面へリダイレクトされる"),
            ("他ユーザーのリソースURLへ直接アクセスする", "403またはリダイレクトされ他ユーザーのデータは見えない"),
            ("APIトークンなしでAPI endpointへリクエストを送る", "401 Unauthorizedが返る"),
            ("無効なトークンでAPIリクエストを送る", "401 Unauthorizedが返る"),
            ("期限切れトークンでAPIリクエストを送る", "401 Unauthorizedが返る"),
        ],
        test_data="保護URL: /admin/users/、/api/v1/private/、他ユーザーID: 9999",
        authority="OWASP Top 10: A01 Broken Access Control / CWE-285 / OWASP Auth Cheat Sheet",
        domains=frozenset({"login", "rbac"}),
    ),
    _t(
        title="セキュリティ：CSRF攻撃が阻止されること",
        priority="High",
        precondition="CSRFトークンを含むフォームにアクセス可能",
        steps=[
            ("フォーム送信時のリクエストを開発者ツールで確認する", "CSRFトークンがリクエストに含まれている"),
            ("CSRFトークンを削除したリクエストを送る（curl等）", "403 Forbiddenが返る"),
            ("別サイトから同じエンドポイントへPOSTリクエストを送る（Origin偽装）", "リクエストが拒否される"),
        ],
        test_data="curl -X POST /api/items/ -H 'Content-Type: application/json' -d '{...}' (CSRFトークンなし)",
        authority="OWASP Top 10: A01 / OWASP CSRF Cheat Sheet / CWE-352",
    ),
    _t(
        title="セキュリティ：パスワードが平文でログ・DBに記録されないこと",
        priority="High",
        precondition="ログインまたはパスワード変更機能にアクセス可能",
        steps=[
            ("ログイン操作を実行する", "ログインが成功する"),
            ("サーバーサイドのアクセスログを確認する", "パスワードが平文でログに記録されていない"),
            ("DBのユーザーテーブルを確認する（DB管理者権限が必要）", "パスワードがハッシュ化（bcrypt/Argon2等）されて保存されている"),
            ("通信をキャプチャしパスワードがHTTPSで暗号化されているか確認する", "TLS通信でパスワードは暗号化されている"),
        ],
        test_data="テストユーザー: qa_tester@example.com / Test@2024（ハッシュ化確認）",
        authority="OWASP Password Storage Cheat Sheet / CWE-256 / NIST SP 800-63B",
        domains=frozenset({"login", "password"}),
    ),
    _t(
        title="セキュリティ：セキュリティヘッダーが適切に設定されていること",
        priority="Medium",
        precondition="HTTPレスポンスヘッダーを確認できる環境（開発者ツール等）",
        steps=[
            ("ブラウザ開発者ツールのNetworkタブを開く", "ネットワークモニタが起動する"),
            ("任意のページにアクセスしレスポンスヘッダーを確認する", "ヘッダー一覧が表示される"),
            ("Content-Security-Policy（CSP）ヘッダーの存在を確認する", "CSPヘッダーが設定されている"),
            ("X-Frame-Options または CSP frame-ancestors を確認する", "クリックジャッキング対策が設定されている"),
            ("Strict-Transport-Security（HSTS）ヘッダーを確認する", "HSTSが設定されている"),
        ],
        test_data="確認ヘッダー: Content-Security-Policy、X-Frame-Options、Strict-Transport-Security、X-Content-Type-Options",
        authority="OWASP Secure Headers Project / CWE-693 / Mozilla Observatory",
    ),
    _t(
        title="セキュリティ：レート制限（ブルートフォース対策）が有効であること",
        priority="High",
        precondition="ログイン機能にアクセス可能",
        steps=[
            ("誤ったパスワードで連続5回ログインを試みる", "アカウントがロックされるか一時制限がかかる"),
            ("ロック後に正しいパスワードでログインを試みる", "ロック中は正しいパスワードでもログインできない"),
            ("一定時間後（またはアカウント解除後）に正しいパスワードでログインする", "正常にログインできる"),
            ("レート制限のメッセージを確認する", "「試行回数が多すぎます」等のメッセージが表示される"),
        ],
        test_data="連続失敗パスワード: wrong123、誤試行回数: 5回、ロック時間: 15分",
        authority="OWASP Brute Force Cheat Sheet / CWE-307 / NIST SP 800-63B",
        domains=frozenset({"login"}),
    ),
    _t(
        title="セキュリティ：不正なAPIトークンによるアクセスが拒否されること",
        priority="High",
        precondition="APIが認証トークンを必要とする環境",
        steps=[
            ("有効なAPIトークンでリクエストを送り正常に動作することを確認する", "200 OKが返る"),
            ("改ざんしたトークン（末尾1文字変更）でリクエストを送る", "401 Unauthorizedが返る"),
            ("別ユーザーのトークンで他ユーザーのリソースにアクセスする", "403 Forbiddenが返る"),
            ("トークンを含めずにリクエストを送る", "401 Unauthorizedが返る"),
        ],
        test_data="有効トークン: eyJhbGci...（テスト環境発行）、改ざんトークン: 末尾1文字変更",
        authority="OWASP API Security Top 10: API2 Broken Auth / CWE-287",
        domains=frozenset({"api"}),
    ),
]

# ── 性能テスト (perf) ──────────────────────────────────────────
_PERF_KB: list[Template] = [
    _t(
        title="性能：通常負荷時にページの応答時間が2秒以内であること",
        priority="High",
        precondition="本番同等の環境（データ件数・サーバースペック）が準備済み",
        steps=[
            ("ブラウザ開発者ツールのNetworkタブを開く", "ネットワーク監視が開始される"),
            ("メイン一覧ページを読み込む", "ページが表示される"),
            ("NetworkタブでDOMContentLoadedの時間を確認する", "2秒以内に読み込み完了している"),
            ("5回計測し平均値を算出する", "平均2秒以内である"),
            ("キャッシュクリア後に再計測する", "キャッシュなしでも2秒以内である"),
        ],
        test_data="データ件数: 本番同等（例：10万件）、ネットワーク: 有線LAN",
        authority="Google Core Web Vitals（LCP < 2.5s）/ ISO 25010 性能効率性",
    ),
    _t(
        title="性能：10並列ユーザーでの同時アクセス時にエラーが発生しないこと",
        priority="High",
        precondition="負荷テストツール（k6/JMeter/Locust等）が準備済み、テスト環境が用意済み",
        steps=[
            ("負荷テストスクリプトを作成する（10 VU、対象エンドポイントを設定）", "スクリプトが正常に準備できる"),
            ("10仮想ユーザーで1分間の負荷テストを実行する", "テストが実行される"),
            ("レスポンスコードを確認する（エラー率）", "エラー率が1%未満である"),
            ("平均・95パーセンタイル・最大レスポンスタイムを確認する", "P95が3秒以内である"),
            ("サーバーリソース（CPU・メモリ）を確認する", "CPU 80%以下・メモリ異常なし"),
        ],
        test_data="ツール: k6、VU: 10、Duration: 60s、対象: GET /api/v1/items/",
        authority="ISO 25010 性能効率性 / ISTQB 性能テスト専門家スキーム",
    ),
    _t(
        title="性能：100並列ユーザーでのピーク負荷テスト",
        priority="High",
        precondition="本番スペックのテスト環境、負荷テストツール（k6等）準備済み",
        steps=[
            ("ランプアップ設定（0→100VUを2分で増加）でテストを開始する", "VUが増加し始める"),
            ("100VUで5分間の定常負荷をかける", "100VUで継続してリクエストが送られる"),
            ("エラー率・レスポンスタイムをリアルタイム監視する", "P95が5秒以内、エラー率5%未満"),
            ("テスト終了後にサーバーログを確認する", "OOM・Exceptionがない"),
            ("負荷テストレポートを保存する", "指標が記録される"),
        ],
        test_data="ツール: k6、VU: 100、Duration: 5分、Ramp-up: 2分",
        authority="ISO 25010 性能効率性 / ISTQB PT / NFR定義書",
    ),
    _t(
        title="性能：大量データ件数（10万件超）の一覧表示が3秒以内であること",
        priority="Medium",
        precondition="データベースに10万件以上のテストデータが投入済み",
        steps=[
            ("テストデータ10万件をDBに投入する（スクリプト実行）", "データが投入される"),
            ("一覧画面を初回アクセスする（キャッシュなし）", "ページが表示される"),
            ("応答時間を計測する（NetworkタブのDOMContentLoaded）", "3秒以内である"),
            ("2ページ目・3ページ目へ遷移する", "各ページ遷移が2秒以内である"),
            ("DBのインデックスが有効か確認する（EXPLAINコマンド等）", "インデックスが使用されている"),
        ],
        test_data="投入件数: 100,001件（ページサイズ: 20件）",
        authority="ISO 25010 性能効率性 / SQL EXPLAIN分析",
    ),
    _t(
        title="性能：ファイルダウンロードが大容量データでも完了すること",
        priority="Medium",
        precondition="ダウンロード対象のCSV/Excelエクスポート機能が実装済み",
        steps=[
            ("データが1万件以上ある状態でCSVエクスポートをクリックする", "ダウンロードが開始される"),
            ("ダウンロード完了時間を計測する", "30秒以内にダウンロードが完了する"),
            ("ダウンロードされたファイルの件数を確認する", "期待した件数のデータが含まれている"),
            ("データの整合性を確認する（先頭・末尾レコードを照合）", "データが正確に出力されている"),
        ],
        test_data="エクスポート件数: 10,000件、想定ファイルサイズ: 5MB",
        authority="ISO 25010 性能効率性",
        domains=frozenset({"file"}),
    ),
]

_ALL_KB: dict[str, list[Template]] = {
    "func": _FUNC_KB,
    "boundary": _BOUNDARY_KB,
    "exception": _EXCEPTION_KB,
    "state": _STATE_KB,
    "security": _SECURITY_KB,
    "perf": _PERF_KB,
}

# ─────────────────────────────────────────────────────────────────────
#  Engine 1: spec_to_tc
# ─────────────────────────────────────────────────────────────────────

def spec_to_tc(
    spec_text: str,
    feature_name: str,
    test_types: list[str],
) -> dict[str, Any]:
    """仕様テキストからテストケースを生成する。

    Args:
        spec_text:    機能仕様・要件の説明テキスト
        feature_name: 機能名称
        test_types:   生成するテスト種別のリスト
                      ["func","boundary","exception","state","security","perf"]

    Returns:
        {
          "cases": [...],
          "total": int,
          "by_type": {"機能": N, ...},
          "feature": feature_name,
          "error": ""  # エラー時のみ
        }
    """
    # ── 入力バリデーション ──────────────────────────────────────────
    if not spec_text or not spec_text.strip():
        return {
            "cases": [], "total": 0, "by_type": {}, "feature": feature_name or "",
            "error": "仕様テキストが空です。機能の説明を入力してください。",
        }
    if not feature_name or not feature_name.strip():
        feature_name = "未名称機能"
    if not test_types:
        test_types = ["func"]

    valid_types = set(_ALL_KB.keys())
    test_types = [t for t in test_types if t in valid_types]
    if not test_types:
        return {
            "cases": [], "total": 0, "by_type": {}, "feature": feature_name,
            "error": f"有効なテスト種別が指定されていません。次の中から選んでください: {', '.join(valid_types)}",
        }

    # ── ドメイン・CRUD 検出 ──────────────────────────────────────────
    detected_domains = _detect_domains(spec_text)
    detected_crud = _detect_crud(spec_text)
    combined_text = f"{spec_text} {feature_name}"
    detected_domains |= _detect_domains(combined_text)
    detected_crud |= _detect_crud(combined_text)

    # ── テストケース選択アルゴリズム ─────────────────────────────────
    # 各テスト種別から関連性スコアを計算し上位ケースを採用する
    # ドメイン・CRUD一致でボーナスを与え、仕様関連度が高いケースを優先する

    def _relevance(tmpl: Template, dtype: str) -> int:
        score = 0
        # ドメインが仕様テキストのものと一致
        score += len(tmpl["domains"] & detected_domains) * 3
        # CRUDが一致
        score += len(tmpl["crud"] & detected_crud) * 2
        # タイトル・前提条件の語が仕様テキストに含まれる
        title_words = set(re.findall(r"[ぁ-ん一-龥ァ-ヶA-Za-z]+", tmpl["title"]))
        spec_words = set(re.findall(r"[ぁ-ん一-龥ァ-ヶA-Za-z]+", spec_text))
        score += len(title_words & spec_words)
        return score

    # 目標ケース数: 種別あたり 3〜8件（合計を種別数で分散）
    per_type_target = max(3, min(8, 24 // max(1, len(test_types))))

    cases: list[dict] = []
    counter = 1
    by_type: dict[str, int] = {}

    for dtype in test_types:
        type_label = _TYPE_LABEL.get(dtype, dtype)
        kb = _ALL_KB.get(dtype, [])
        if not kb:
            continue

        # 関連度でソートして上位を採用
        ranked = sorted(kb, key=lambda t: _relevance(t, dtype), reverse=True)
        selected = ranked[:per_type_target]

        type_count = 0
        for tmpl in selected:
            tc_id = _tc_id(counter)

            # タイトルに機能名を付与（最初の2文字のコンテキストを前置）
            title = f"{feature_name} - {tmpl['title']}"

            # ステップをフォーマット
            steps = [
                {"no": i + 1, "action": action, "expected": expected}
                for i, (action, expected) in enumerate(tmpl["steps"])
            ]

            cases.append({
                "id": tc_id,
                "title": title,
                "type": type_label,
                "priority": tmpl["priority"],
                "precondition": tmpl["precondition"],
                "steps": steps,
                "test_data": tmpl["test_data"],
                "authority": tmpl["authority"],
            })
            counter += 1
            type_count += 1

        by_type[type_label] = type_count

    return {
        "cases": cases,
        "total": len(cases),
        "by_type": by_type,
        "feature": feature_name,
        "error": "",
    }


# ─────────────────────────────────────────────────────────────────────
#  知識ベース: 探索的テスト チャーターテンプレート
# ─────────────────────────────────────────────────────────────────────

CharterTemplate = dict[str, Any]


def _ch(mission: str, area: str, priority: str,
        focus: list[str], hints: list[str], oracle: str,
        area_keys: frozenset[str] | None = None,
        risk_bias: str = "any") -> CharterTemplate:
    return {
        "mission": mission,
        "area": area,
        "priority": priority,
        "focus": focus,
        "hints": hints,
        "oracle": oracle,
        "area_keys": area_keys or frozenset(),
        "risk_bias": risk_bias,  # "high"/"medium"/"low"/"any"
    }


_CHARTER_KB: list[CharterTemplate] = [
    # ── 機能探索 ──────────────────────────────────────────────────
    _ch(
        mission="基本機能を探索して、仕様との乖離や実装漏れを発見する",
        area="機能",
        priority="必須",
        focus=[
            "ハッピーパス（正常系）の一連操作フローが仕様通り動作するか",
            "フォームのラベル・プレースホルダー・ヘルプテキストが適切か",
            "作成・更新・削除後のデータが画面に即時反映されるか",
        ],
        hints=[
            "まず最も使われる主要ユースケースを一通り操作してみる",
            "操作後にDBの値を確認し、UIと整合しているか検証する",
        ],
        oracle="仕様書の受入基準と実際の動作が一致すること。不一致や「これは正しいのか?」という疑問を書き留める",
        area_keys=frozenset({"func"}),
        risk_bias="any",
    ),
    _ch(
        mission="CRUD操作の完全性を探索して、データ整合性の問題を発見する",
        area="機能",
        priority="必須",
        focus=[
            "作成（Create）後のIDや生成日時が正しく付与されるか",
            "更新（Update）後に変更フィールドのみが変更されているか",
            "削除（Delete）後に関連レコードが適切に処理されるか（CASCADE等）",
        ],
        hints=[
            "更新時に変更しなかったフィールドの値が意図せず上書きされないか確認する",
            "削除後に孤立した外部キーや参照切れが残らないか確認する",
        ],
        oracle="DBのデータがUIの操作と完全に一致すること。孤立データ・重複・欠落がないこと",
        area_keys=frozenset({"func", "data"}),
        risk_bias="any",
    ),
    _ch(
        mission="エラーメッセージと例外処理を探索して、ユーザー体験の問題を発見する",
        area="機能",
        priority="推奨",
        focus=[
            "エラーメッセージが具体的で修正方法を示しているか",
            "複数フィールドのバリデーションエラーがまとめて表示されるか",
            "サーバーエラー時にスタックトレースが漏洩しないか",
        ],
        hints=[
            "意図的に不正な入力を組み合わせて送信し、エラーメッセージを集める",
            "エラー後にフォームの既入力値が保持されているか確認する",
        ],
        oracle="エラーメッセージが分かりやすく、ユーザーが次の行動を取れること。機密情報が露出しないこと",
        area_keys=frozenset({"func"}),
        risk_bias="any",
    ),
    # ── 境界値探索 ──────────────────────────────────────────────────
    _ch(
        mission="入力値の境界を探索して、バリデーション漏れと境界バグを発見する",
        area="境界値",
        priority="必須",
        focus=[
            "各入力フィールドの最大・最小・上限+1・下限-1の値を試す",
            "空文字列・スペースのみ・改行のみの入力を試す",
            "全角・半角混在、絵文字、特殊記号の入力を試す",
        ],
        hints=[
            "UIのバリデーションを回避するためにAPIを直接呼び出して境界値を試す",
            "長い文字列を入力してUIの表示が崩れないか確認する",
        ],
        oracle="境界値で仕様通りに受理/拒否されること。エラーメッセージが具体的であること",
        area_keys=frozenset({"boundary"}),
        risk_bias="any",
    ),
    _ch(
        mission="数値・日付フィールドの境界を探索して、計算誤りと表示崩れを発見する",
        area="境界値",
        priority="推奨",
        focus=[
            "最大値・最小値の計算結果が正しく表示されるか",
            "うるう年・月末・年末などの特殊日付での動作を確認する",
            "タイムゾーンをまたぐ日付操作で意図しない日付変更が起きないか",
        ],
        hints=[
            "2月28日・29日・30日（存在しない）、12月31日→1月1日をそれぞれ試す",
            "マイナス値・ゼロの扱いが仕様と一致しているか確認する",
        ],
        oracle="特殊日付・境界数値で正しく計算・表示されること。エラーの場合はユーザーが理解できるメッセージ",
        area_keys=frozenset({"boundary"}),
        risk_bias="medium",
    ),
    # ── UX/ユーザビリティ探索 ────────────────────────────────────
    _ch(
        mission="ユーザー体験を探索して、混乱や使いづらさの原因を発見する",
        area="UX/ユーザビリティ",
        priority="推奨",
        focus=[
            "キーボードのみで全操作が完結するか（Tab移動・Enter送信）",
            "スクリーンリーダー用のARIA属性・alt属性が適切に設定されているか",
            "モバイルサイズ（375px）でのレイアウト崩れがないか",
        ],
        hints=[
            "初めて使うユーザーを想定し、説明なしで操作できるか試す",
            "高齢者・障害者のユーザーを想定してアクセシビリティを確認する",
        ],
        oracle="キーボード・スクリーンリーダー・モバイルで操作できること。WCAG 2.1 AAを満たすこと",
        area_keys=frozenset({"ux"}),
        risk_bias="any",
    ),
    _ch(
        mission="フォームのユーザビリティを探索して、入力操作の問題を発見する",
        area="UX/ユーザビリティ",
        priority="任意",
        focus=[
            "入力補助機能（オートコンプリート・デフォルト値）が機能するか",
            "長い操作途中でのブラウザリフレッシュ時にデータが失われないか",
            "コピー&ペーストで意図しない文字が混入しないか",
        ],
        hints=[
            "パスワードフィールドへのコピー&ペーストを試す",
            "戻るボタンで前画面に戻ったときに入力内容が保持されているか確認する",
        ],
        oracle="ユーザーが入力途中のデータを失わずに操作を完了できること",
        area_keys=frozenset({"ux"}),
        risk_bias="low",
    ),
    # ── セキュリティ探索 ─────────────────────────────────────────
    _ch(
        mission="認証・認可の境界を探索して、不正アクセスの可能性を発見する",
        area="セキュリティ",
        priority="必須",
        focus=[
            "他ユーザーのリソースIDをURLで直接指定してアクセスできないか",
            "管理者専用機能に一般ユーザーがAPIから直接アクセスできないか",
            "セッション無効化後も旧セッションが使用可能でないか",
        ],
        hints=[
            "IDOR（Insecure Direct Object Reference）テスト: 自分のIDを他ユーザーのIDに書き換えてみる",
            "権限チェックがAPIレベルで行われているか確認する（UIの非表示のみでは不十分）",
        ],
        oracle="認可外のリソースへのアクセスが403/404で拒否されること。セッション無効化が正しく機能すること",
        area_keys=frozenset({"security"}),
        risk_bias="high",
    ),
    _ch(
        mission="入力値のサニタイゼーションを探索して、インジェクション脆弱性を発見する",
        area="セキュリティ",
        priority="必須",
        focus=[
            "全入力フィールドにXSSペイロードを入力し出力エスケープを確認する",
            "検索フィールドにSQLiペイロードを入力しDBエラーが返らないか確認する",
            "ファイル名・URLパラメーターにパストラバーサル（../）を試みる",
        ],
        hints=[
            "XSS: <script>alert(document.domain)</script>、イベントハンドラ属性、SVGを試す",
            "パストラバーサル: ../../../etc/passwd、..%2F..%2Fetc%2Fpasswd を試す",
        ],
        oracle="全てのペイロードが無害化されて表示されること。DBエラー・サーバーエラーの詳細が漏洩しないこと",
        area_keys=frozenset({"security"}),
        risk_bias="high",
    ),
    _ch(
        mission="認証フローのセキュリティを探索して、アカウント乗っ取りの経路を発見する",
        area="セキュリティ",
        priority="必須",
        focus=[
            "パスワードリセットリンクの有効期限・使い捨て性を確認する",
            "ログイン失敗時のアカウントロック・レート制限を確認する",
            "「パスワードを忘れた場合」でユーザー存在の有無が推測できないか確認する",
        ],
        hints=[
            "パスワードリセットリンクを2回使用できるか試す（使い捨てであること）",
            "レスポンス時間の差異でユーザー存在確認ができないか（タイミング攻撃）確認する",
        ],
        oracle="リセットリンクが1回のみ有効で期限切れになること。存在確認のサイドチャネルがないこと",
        area_keys=frozenset({"security"}),
        risk_bias="high",
    ),
    # ── 性能探索 ──────────────────────────────────────────────────
    _ch(
        mission="応答速度を探索して、ユーザー体験を損なう遅延ポイントを発見する",
        area="性能",
        priority="推奨",
        focus=[
            "最も多く使われるページの初期表示速度（2秒基準）を計測する",
            "検索・フィルタ実行時の応答時間を計測する",
            "データ件数が増加したときの速度劣化を確認する",
        ],
        hints=[
            "Chrome DevTools の Performance タブでボトルネックを特定する",
            "10件・100件・1000件のデータで応答時間の変化を比較する",
        ],
        oracle="ページ表示が2秒以内、APIレスポンスが1秒以内。データ増加でO(n)以上の劣化がないこと",
        area_keys=frozenset({"perf"}),
        risk_bias="medium",
    ),
    _ch(
        mission="同時接続時の安定性を探索して、競合状態とデータ破損を発見する",
        area="性能",
        priority="推奨",
        focus=[
            "同一レコードを2ユーザーが同時に更新したときの排他制御を確認する",
            "複数ウィンドウで同時操作したときにセッション状態が正しいか確認する",
            "在庫・残高等の数値フィールドで同時更新時の整合性を確認する",
        ],
        hints=[
            "2ブラウザ・2タブで同じレコードを同時編集し「保存」する",
            "楽観的ロック（更新競合エラー）または悲観的ロック（編集中表示）が機能するか確認する",
        ],
        oracle="同時更新時にデータが失われないこと。競合が適切に検出・通知されること",
        area_keys=frozenset({"perf"}),
        risk_bias="high",
    ),
    # ── 統合・連携探索 ───────────────────────────────────────────
    _ch(
        mission="外部連携の信頼性を探索して、障害時のシステム挙動を発見する",
        area="統合/連携",
        priority="推奨",
        focus=[
            "外部APIがタイムアウトしたときに適切なエラーが表示されるか",
            "外部サービス障害時にシステム全体が影響を受けないか（サーキットブレーカー）",
            "再送制御（リトライ）が実装されているか確認する",
        ],
        hints=[
            "外部APIをモックでエラー（500/503）に設定してシステムの反応を確認する",
            "ネットワーク遅延（5秒）をシミュレートして適切なタイムアウト処理を確認する",
        ],
        oracle="外部サービス障害時にユーザーへ分かりやすいエラーが表示され、他機能が継続動作すること",
        area_keys=frozenset({"integration"}),
        risk_bias="high",
    ),
    _ch(
        mission="データ連携・同期の整合性を探索して、不整合データの発生を発見する",
        area="統合/連携",
        priority="必須",
        focus=[
            "システム間でデータが同期されるまでの遅延時間と影響を確認する",
            "同期エラー時に手動リカバリーの手順があるか確認する",
            "データ変換・マッピングで文字化け・型変換エラーが起きないか確認する",
        ],
        hints=[
            "日本語マルチバイト文字・特殊文字を含むデータを連携して確認する",
            "NULL値・空文字・ゼロ値が連携先で正しく扱われるか確認する",
        ],
        oracle="連携データが変換・損失なく正確に伝達されること。エラー時に通知・ログが出力されること",
        area_keys=frozenset({"integration", "data"}),
        risk_bias="high",
    ),
    # ── データ整合性探索 ─────────────────────────────────────────
    _ch(
        mission="データ整合性を探索して、DB制約違反と孤立データを発見する",
        area="データ整合性",
        priority="必須",
        focus=[
            "外部キー制約が有効で参照整合性が維持されているか",
            "削除操作時の関連データの扱い（CASCADE・RESTRICT）が仕様通りか",
            "トランザクション途中で失敗したときにロールバックされているか",
        ],
        hints=[
            "関連データを持つレコードを削除して、関連側のレコードを確認する",
            "大量データのバルク操作（インポート）途中でキャンセルした後のDB状態を確認する",
        ],
        oracle="DB制約が正しく機能し、孤立データ・重複・矛盾したデータが生じないこと",
        area_keys=frozenset({"data"}),
        risk_bias="high",
    ),
    _ch(
        mission="特殊文字・多言語データの処理を探索して、文字化けと表示崩れを発見する",
        area="データ整合性",
        priority="推奨",
        focus=[
            "絵文字（4バイト文字: 😀）を含むデータが正しく保存・表示されるか",
            "英数・日本語・中国語・アラビア語の混在データが文字化けしないか",
            "改行・タブ文字を含む文字列が保存・表示・エクスポートで正しく扱われるか",
        ],
        hints=[
            "DB文字セットがUTF-8（utf8mb4等）であることを確認する",
            "CSVエクスポートのBOM有無・エンコーディングをExcelで開いて確認する",
        ],
        oracle="全文字セットでデータが損失なく保存・表示・出力されること",
        area_keys=frozenset({"data"}),
        risk_bias="medium",
    ),
]


# ─────────────────────────────────────────────────────────────────────
#  Engine 2: exploratory_charters
# ─────────────────────────────────────────────────────────────────────

_DEBRIEF_GUIDE = [
    "セッション中に見つけた問題・疑問点を列挙してください（バグ票未作成のものを含む）",
    "ミッションをどこまで達成できましたか？達成できなかった部分とその理由は？",
    "探索中に「予期しない挙動」や「気になった点」はありましたか？",
    "次のセッションで深掘りすべきエリアはどこですか？",
    "テスト環境や前提条件でブロッカーになったことはありましたか？",
    "発見した問題のうち、最も影響度が高いものはどれですか？その理由は？",
    "仕様書や設計書と実際の動作で乖離が見つかりましたか？",
]

_PRIORITY_BY_RISK = {
    "high":   {"必須": 0.5, "推奨": 0.35, "任意": 0.15},
    "medium": {"必須": 0.35, "推奨": 0.45, "任意": 0.20},
    "low":    {"必須": 0.25, "推奨": 0.40, "任意": 0.35},
}

_PRIORITY_ORDER = {"必須": 0, "推奨": 1, "任意": 2}
_AREA_KEY_DURATION = {
    "必須": 45,
    "推奨": 35,
    "任意": 25,
}


def exploratory_charters(
    feature: str,
    time_budget_min: int,
    areas: list[str],
    risk_level: str,
) -> dict[str, Any]:
    """SBTM形式の探索的テストチャーターを生成する。

    Args:
        feature:          テスト対象の機能名
        time_budget_min:  総テスト時間（分）
        areas:            探索領域リスト ["func","boundary","ux","security","perf","integration","data"]
        risk_level:       リスクレベル "high"/"medium"/"low"

    Returns:
        {
          "charters": [...],
          "session_report": {...},
          "total_charters": int,
          "error": ""
        }
    """
    # ── 入力バリデーション ──────────────────────────────────────────
    if not feature or not feature.strip():
        return {
            "charters": [], "session_report": {}, "total_charters": 0,
            "error": "機能名が空です。テスト対象の機能名を入力してください。",
        }
    if not time_budget_min or time_budget_min < 1:
        time_budget_min = 60
    if not areas:
        areas = ["func"]

    valid_areas = set(_AREA_LABEL.keys())
    areas = [a for a in areas if a in valid_areas]
    if not areas:
        areas = ["func"]

    if risk_level not in ("high", "medium", "low"):
        risk_level = "medium"

    # ── チャーター選択アルゴリズム ──────────────────────────────────
    area_set = frozenset(areas)

    # 各チャーターテンプレートのスコアを計算する
    # エリア一致 × リスクバイアス × 優先度でランク付け
    risk_weights = _PRIORITY_BY_RISK[risk_level]

    def _charter_score(tmpl: CharterTemplate) -> float:
        # エリア一致度（1〜3点）
        overlap = len(tmpl["area_keys"] & area_set)
        area_score = overlap * 3 if overlap else 0

        # テンプレートのエリアに特定のkeyがない場合でも全エリア共通テンプレートはスコア加算
        if not tmpl["area_keys"]:
            area_score = 1

        # リスクバイアス一致（high リスク優先）
        risk_match = 2 if (tmpl["risk_bias"] == risk_level or tmpl["risk_bias"] == "any") else 0
        if tmpl["risk_bias"] == "high" and risk_level == "high":
            risk_match = 3

        # 優先度による重み
        priority_w = risk_weights.get(tmpl["priority"], 0)

        return area_score + risk_match + priority_w * 5

    ranked = sorted(_CHARTER_KB, key=_charter_score, reverse=True)

    # 総時間に合わせてチャーター数を決定（1セッション 25〜45分が目安）
    avg_duration = 35  # 平均セッション分数
    target_n = max(2, round(time_budget_min / avg_duration))

    selected_templates = ranked[:target_n]

    # 時間配分: 優先度・リスクに応じて按分
    def _alloc_duration(idx: int, total: int, budget: int, priority: str) -> int:
        base = _AREA_KEY_DURATION.get(priority, 30)
        if total == 1:
            return budget
        # 高リスクは多く配分
        if risk_level == "high" and priority == "必須":
            return min(budget - (total - 1) * 20, base + 10)
        return min(budget // total + (5 if idx == 0 else 0), base)

    remaining = time_budget_min
    charters: list[dict] = []

    for i, tmpl in enumerate(selected_templates):
        is_last = (i == len(selected_templates) - 1)
        duration = remaining if is_last else _alloc_duration(
            i, len(selected_templates), remaining, tmpl["priority"]
        )
        duration = max(20, min(60, duration))
        if not is_last:
            remaining -= duration

        ch_id = _ch_id(i + 1)
        area_label = tmpl["area"]
        mission_full = f"{feature} の {tmpl['mission']}"

        charters.append({
            "id": ch_id,
            "mission": mission_full,
            "area": area_label,
            "duration_min": duration,
            "priority": tmpl["priority"],
            "focus": tmpl["focus"],
            "hints": tmpl["hints"],
            "oracle": tmpl["oracle"],
            "notes": "",
        })

    total_allocated = sum(c["duration_min"] for c in charters)

    return {
        "charters": charters,
        "session_report": {
            "feature": feature,
            "total_min": total_allocated,
            "n_sessions": len(charters),
            "debrief_guide": _DEBRIEF_GUIDE,
        },
        "total_charters": len(charters),
        "error": "",
    }
