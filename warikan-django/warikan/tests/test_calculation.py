"""割り勘計算（仕様 1.3）のテスト。"""

import pytest

from warikan.domain.calculation import (
    CalculationError,
    WarikanInput,
    calculate,
    payment_occurs,
)


def run(own_count, other_count, total_amount, own_ratio):
    return calculate(
        WarikanInput(
            own_count=own_count,
            other_count=other_count,
            total_amount=total_amount,
            own_ratio=own_ratio,
        )
    )


def test_仕様書の画面例と一致する():
    """仕様 1.4 の例：5人・5人・50,000円・50% → 5,000 / 5,000 / お釣り 0。"""
    result = run(5, 5, 50000, 50)
    assert (result.own_per_person, result.other_per_person, result.change) == (
        5000,
        5000,
        0,
    )


@pytest.mark.parametrize(
    ("own_count", "other_count", "total", "ratio", "expected"),
    [
        # 100円単位の切り上げが双方に効き、お釣りが発生する。
        (3, 2, 10000, 50, (1700, 2500, 100)),
        # 割合 0：自分側の負担が 0 円になり、相手側が全額を負担する。
        (2, 2, 10000, 0, (0, 5000, 0)),
        # 割合 100：自分側が全額を負担し、相手側は 0 円になる。
        (2, 2, 10000, 100, (5000, 0, 0)),
        # 人数・金額の上限（99人・99人・999,999円）。
        (99, 99, 999999, 50, (5100, 5100, 9801)),
        # 金額の下限 1 円。切り上げにより 100 円を集め、99 円がお釣りになる。
        (1, 1, 1, 50, (100, 0, 99)),
    ],
)
def test_境界値と丸めの組み合わせ(own_count, other_count, total, ratio, expected):
    result = run(own_count, other_count, total, ratio)
    assert (
        result.own_per_person,
        result.other_per_person,
        result.change,
    ) == expected


def test_自分側が過剰に負担すると相手側は0円になる():
    """手順2の残額が負になる場合、100円単位切り上げの結果は 0 円（SPEC_ISSUES #2）。"""
    result = run(1, 1, 150, 100)
    assert result.own_per_person == 200
    assert result.other_per_person == 0
    assert result.change == 50


def test_支払総額から全体金額を引いた額がお釣りになる():
    result = run(4, 7, 33333, 30)
    collected = result.own_per_person * 4 + result.other_per_person * 7
    assert result.change == collected - 33333


def test_1人あたりの金額は常に100円単位():
    result = run(7, 3, 12345, 70)
    assert result.own_per_person % 100 == 0
    assert result.other_per_person % 100 == 0


@pytest.mark.parametrize(
    ("own_count", "other_count", "total", "ratio"),
    [
        (0, 5, 10000, 50),  # 人数の下限未満
        (100, 5, 10000, 50),  # 人数の上限超過
        (5, 0, 10000, 50),
        (5, 100, 10000, 50),
        (5, 5, 0, 50),  # 金額の下限未満
        (5, 5, 1000000, 50),  # 金額の上限超過
        (5, 5, 10000, -10),  # 割合の下限未満
        (5, 5, 10000, 110),  # 割合の上限超過
        (5, 5, 10000, 55),  # 10 刻みでない
    ],
)
def test_範囲外の入力は計算エラーになる(own_count, other_count, total, ratio):
    with pytest.raises(CalculationError):
        run(own_count, other_count, total, ratio)


def test_ジャスPayボタンは双方に支払いがあるときだけ表示する():
    """仕様 1.4 の表示条件（SPEC_ISSUES #3 の解釈）。"""
    assert payment_occurs(run(5, 5, 50000, 50)) is True
    assert payment_occurs(run(2, 2, 10000, 100)) is False
    assert payment_occurs(run(2, 2, 10000, 0)) is False


def test_相手側の割合は100から自分側を引いた値():
    params = WarikanInput(own_count=1, other_count=1, total_amount=1000, own_ratio=30)
    assert params.other_ratio == 70
