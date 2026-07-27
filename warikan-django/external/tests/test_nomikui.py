"""サービスサーバ側の責務（認証・登録上限管理）のテスト。

システムテストの対象外だが、上限管理の誤りは Warikan の履歴表示に現れるため
リグレッション防止として押さえる。
"""

import datetime

import pytest
from django.test import override_settings

from external import nomikui
from external.errors import AuthenticationFailedError, ServiceUnavailableError
from external.models import WarikanRecord

pytestmark = pytest.mark.django_db


def payload(note: str = "") -> nomikui.RecordPayload:
    return nomikui.RecordPayload(
        own_count=5,
        other_count=5,
        total_amount=50000,
        own_ratio=50,
        own_per_person=5000,
        other_per_person=5000,
        change=0,
        held_on=datetime.date(2026, 7, 27),
        held_at=datetime.time(18, 0),
        note=note,
    )


def test_正しいID_パスワードで認証できる(account):
    assert nomikui.authenticate("testuser", "passw0rd").id == account.id


@pytest.mark.parametrize(
    ("user_id", "password"),
    [("nobody", "passw0rd"), ("testuser", "wrong")],
)
def test_ID未登録またはパスワード誤りは認証に失敗する(account, user_id, password):
    with pytest.raises(AuthenticationFailedError):
        nomikui.authenticate(user_id, password)


def test_パスワードは平文で保存されない(account):
    assert account.password_hash != "passw0rd"
    assert account.verify_password("passw0rd")


def test_登録は50件まで保持される(account):
    for index in range(50):
        nomikui.save_record(account, payload(note=f"{index}"))
    assert WarikanRecord.objects.filter(account=account).count() == 50


def test_51件目の登録で最も古い登録が削除される(account):
    for index in range(51):
        nomikui.save_record(account, payload(note=f"{index}"))

    records = nomikui.list_records(account)
    assert len(records) == 50
    assert records[0].note == "1"  # 最初の登録（"0"）が消える
    assert records[-1].note == "50"


def test_上限はアカウントごとに管理される(account, db):
    from external.models import Account

    other = Account(user_id="another")
    other.set_password("passw0rd")
    other.save()

    for index in range(51):
        nomikui.save_record(account, payload(note=f"a{index}"))
    nomikui.save_record(other, payload(note="b0"))

    assert WarikanRecord.objects.filter(account=account).count() == 50
    assert WarikanRecord.objects.filter(account=other).count() == 1


def test_履歴は登録順に返る(account):
    for index in range(3):
        nomikui.save_record(account, payload(note=f"{index}"))
    assert [record.note for record in nomikui.list_records(account)] == ["0", "1", "2"]


@override_settings(EXTERNAL_SERVICE_FAILURE=True)
@pytest.mark.parametrize(
    "call",
    [
        lambda account: nomikui.authenticate("testuser", "passw0rd"),
        lambda account: nomikui.save_record(account, payload()),
        lambda account: nomikui.list_records(account),
        lambda account: nomikui.issue_payment_token(account, 5000),
    ],
)
def test_通信不能時はすべての呼び出しが失敗する(account, call):
    with pytest.raises(ServiceUnavailableError):
        call(account)


def test_QRコードのデータにアカウントと金額が含まれる(account):
    token = nomikui.issue_payment_token(account, 5000)
    assert "testuser" in token
    assert "5000" in token
