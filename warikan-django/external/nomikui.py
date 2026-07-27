"""NomiKui会サービスサーバの機能（システムテスト対象外）。

Warikan アプリからはこのモジュールの関数だけを呼ぶ。実システムでは HTTP 越しの
呼び出しにあたるため、通信不能を模す EXTERNAL_SERVICE_FAILURE を全関数で検査する。
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import date, time

from django.conf import settings
from django.db import transaction

from .errors import AuthenticationFailedError, ServiceUnavailableError
from .models import Account, WarikanRecord


@dataclass(frozen=True)
class RecordPayload:
    """サービスサーバへ送信する割り勘結果（仕様 3）。"""

    own_count: int
    other_count: int
    total_amount: int
    own_ratio: int
    own_per_person: int
    other_per_person: int
    change: int
    held_on: date
    held_at: time
    note: str


def _ensure_available() -> None:
    """通信可否を検査する。不可なら ServiceUnavailableError（仕様 3.5）。"""
    if settings.EXTERNAL_SERVICE_FAILURE:
        raise ServiceUnavailableError("サービスサーバと正常に通信できません")


def authenticate(user_id: str, password: str) -> Account:
    """ID 認証を行う（仕様 1.1.2）。

    ID が未登録、またはパスワードが不正なら AuthenticationFailedError。
    """
    _ensure_available()

    account = Account.objects.filter(user_id=user_id).first()
    if account is None or not account.verify_password(password):
        raise AuthenticationFailedError(
            "IDが登録されていないか、パスワードが不正です"
        )
    return account


def save_record(account: Account, payload: RecordPayload) -> WarikanRecord:
    """割り勘結果を登録する（仕様 3）。

    1 アカウントの登録数が上限を超える場合、登録順で古いものから削除する。
    この上限管理はサービスサーバの責務である。
    """
    _ensure_available()

    with transaction.atomic():
        record = WarikanRecord.objects.create(
            account=account,
            own_count=payload.own_count,
            other_count=payload.other_count,
            total_amount=payload.total_amount,
            own_ratio=payload.own_ratio,
            own_per_person=payload.own_per_person,
            other_per_person=payload.other_per_person,
            change=payload.change,
            held_on=payload.held_on,
            held_at=payload.held_at,
            note=payload.note,
        )
        _enforce_record_limit(account)

    return record


def _enforce_record_limit(account: Account) -> None:
    """上限を超えた分を登録順（登録日時の古い順）に削除する。"""
    limit = settings.WARIKAN_RECORD_LIMIT
    stale_ids = list(
        WarikanRecord.objects.filter(account=account)
        .order_by("-created_at", "-id")
        .values_list("id", flat=True)[limit:]
    )
    if stale_ids:
        WarikanRecord.objects.filter(id__in=stale_ids).delete()


def list_records(account: Account) -> list[WarikanRecord]:
    """登録済みの割り勘結果を登録順に取得する（仕様 4）。"""
    _ensure_available()
    return list(WarikanRecord.objects.filter(account=account))


def issue_payment_token(account: Account, amount: int) -> str:
    """ジャスPay の QR コード生成に必要なデータを払い出す（仕様 2）。

    仕様では「ジャスPayボタン押下時に、Warikan がサービスサーバと通信して
    データ取得し生成する」とあり、データ形式は規定されていない。
    """
    _ensure_available()
    nonce = secrets.token_urlsafe(9)
    return f"juspay://transfer?to={account.user_id}&amount={amount}&token={nonce}"
