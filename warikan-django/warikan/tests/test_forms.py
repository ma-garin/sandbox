"""入力検証（仕様 1.1.2 / 1.2 / 3）のテスト。"""

import datetime

import pytest

from warikan.forms import (
    CalculationForm,
    LoginForm,
    RegisterForm,
    earliest_selectable_date,
    time_choices,
)


def calc_data(**overrides) -> dict:
    data = {"own_count": 5, "other_count": 5, "total_amount": 50000, "own_ratio": 50}
    return {**data, **overrides}


@pytest.mark.parametrize(
    ("field", "value", "valid"),
    [
        ("own_count", 1, True),
        ("own_count", 0, False),
        ("own_count", 99, True),
        ("own_count", 100, False),
        ("other_count", 1, True),
        ("other_count", 0, False),
        ("other_count", 99, True),
        ("other_count", 100, False),
        ("total_amount", 1, True),
        ("total_amount", 0, False),
        ("total_amount", 999999, True),
        ("total_amount", 1000000, False),
        ("own_ratio", 0, True),
        ("own_ratio", 100, True),
        ("own_ratio", 55, False),
        ("own_ratio", 110, False),
    ],
)
def test_計算画面の入力範囲(field, value, valid):
    form = CalculationForm(calc_data(**{field: value}))
    assert form.is_valid() is valid


def test_未入力はエラーになる():
    form = CalculationForm({})
    assert not form.is_valid()


def test_エラー通知の文言は項目によらず共通():
    """仕様 1.2.4：範囲外が一つ以上あれば「入力された数字が不正です」。"""
    form = CalculationForm(calc_data(own_count=0, total_amount=0))
    assert not form.is_valid()
    assert form.popup_error == "入力された数字が不正です"


def test_正常時はポップアップを出さない():
    form = CalculationForm(calc_data())
    assert form.is_valid()
    assert form.popup_error is None


@pytest.mark.parametrize(
    ("user_id", "password", "valid"),
    [
        ("a" * 15, "b" * 20, True),
        ("a" * 16, "b" * 20, False),
        ("a" * 15, "b" * 21, False),
        ("user_1", "pass", False),  # 記号は半角英数ではない
        ("ユーザ", "pass", False),  # 全角は不可
        ("", "pass", False),
    ],
)
def test_ログイン入力の文字数と文字種(user_id, password, valid):
    form = LoginForm({"user_id": user_id, "password": password})
    assert form.is_valid() is valid


def test_開催時刻は30分刻みで48件():
    choices = time_choices()
    assert len(choices) == 48
    assert choices[0][0] == "00:00"
    assert choices[-1][0] == "23:30"


def test_選択できる最も古い日付は3年前():
    assert earliest_selectable_date(datetime.date(2026, 7, 27)) == datetime.date(
        2023, 7, 27
    )


def test_閏日は3年前の同月末日に丸める():
    """2024-02-29 の 3 年前（2021-02-29）は存在しない。"""
    assert earliest_selectable_date(datetime.date(2024, 2, 29)) == datetime.date(
        2021, 2, 28
    )


def register_data(**overrides) -> dict:
    data = {"held_on": "2026-07-27", "held_at": "18:00", "note": ""}
    return {**data, **overrides}


TODAY = datetime.date(2026, 7, 27)


@pytest.mark.parametrize(
    ("held_on", "valid"),
    [
        ("2026-07-27", True),  # 今日
        ("2026-07-28", False),  # 未来
        ("2023-07-27", True),  # 3年前の同日（境界を含む）
        ("2023-07-26", False),  # 3年前より古い
    ],
)
def test_開催日の選択範囲(held_on, valid):
    form = RegisterForm(register_data(held_on=held_on), today=TODAY)
    assert form.is_valid() is valid


def test_備考は400文字まで():
    assert RegisterForm(register_data(note="あ" * 400), today=TODAY).is_valid()
    assert not RegisterForm(register_data(note="あ" * 401), today=TODAY).is_valid()


def test_開催時刻は選択肢以外を受け付けない():
    assert not RegisterForm(register_data(held_at="18:15"), today=TODAY).is_valid()


def test_開催時刻はtimeに変換される():
    form = RegisterForm(register_data(held_at="23:30"), today=TODAY)
    assert form.is_valid()
    assert form.cleaned_data["held_at"] == datetime.time(23, 30)
