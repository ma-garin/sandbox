"""割り勘計算（仕様 1.3）。

副作用を持たない純粋関数として実装する。浮動小数点誤差が金額に影響しないよう、
すべて整数演算で行う。
"""

from dataclasses import dataclass

from . import constraints


@dataclass(frozen=True)
class WarikanInput:
    """計算画面の入力値。"""

    own_count: int
    other_count: int
    total_amount: int
    own_ratio: int

    @property
    def other_ratio(self) -> int:
        return 100 - self.own_ratio


@dataclass(frozen=True)
class WarikanResult:
    """計算結果（1人あたりの支払金額とお釣り）。"""

    own_per_person: int
    other_per_person: int
    change: int


class CalculationError(ValueError):
    """入力値が仕様の範囲外である場合に送出する。"""


def _ceil_div(numerator: int, denominator: int) -> int:
    """整数の切り上げ除算。denominator は正の整数であること。

    Python の // は床除算なので、符号を反転して切り上げを得る。
    numerator が負の場合も数学的な ceil（0 方向）になる。
    """
    if denominator <= 0:
        raise ValueError("denominator must be a positive integer")
    return -(-numerator // denominator)


def validate(params: WarikanInput) -> None:
    """仕様 1.2 の入力範囲を検証する。範囲外なら CalculationError。"""
    if not constraints.MIN_PEOPLE <= params.own_count <= constraints.MAX_PEOPLE:
        raise CalculationError("自分側の人数が範囲外です")
    if not constraints.MIN_PEOPLE <= params.other_count <= constraints.MAX_PEOPLE:
        raise CalculationError("相手側の人数が範囲外です")
    if not constraints.MIN_AMOUNT <= params.total_amount <= constraints.MAX_AMOUNT:
        raise CalculationError("金額が範囲外です")
    if not constraints.MIN_RATIO <= params.own_ratio <= constraints.MAX_RATIO:
        raise CalculationError("支払割合が範囲外です")
    if params.own_ratio % constraints.RATIO_STEP != 0:
        raise CalculationError("支払割合は10刻みで指定してください")


def calculate(params: WarikanInput) -> WarikanResult:
    """仕様 1.3 の手順どおりに割り勘を計算する。

    1. 全体金額 × 自分側の割合 ÷ 自分側の人数 を100円単位切り上げ → 自分側の支払金額
    2. (全体金額 − 自分側の支払金額 × 自分側の人数) ÷ 相手側の人数 を
       100円単位切り上げ → 相手側の支払金額
    3. 双方の支払総額 − 全体金額 → お釣り
    """
    validate(params)

    unit = constraints.ROUNDING_UNIT

    # 手順1: total * ratio / 100 / own_count を 100円単位で切り上げる。
    # 分母をまとめて 1 回の整数除算にすることで丸め誤差を排除する。
    own_per_person = (
        _ceil_div(params.total_amount * params.own_ratio, 100 * params.own_count * unit)
        * unit
    )

    # 手順2: 残額（負になりうる）を相手側の人数で割り、100円単位で切り上げる。
    remainder = params.total_amount - own_per_person * params.own_count
    other_per_person = _ceil_div(remainder, params.other_count * unit) * unit

    # 手順3: 集めた総額と全体金額の差をお釣りとする。
    collected = (
        own_per_person * params.own_count + other_per_person * params.other_count
    )
    change = collected - params.total_amount

    return WarikanResult(
        own_per_person=own_per_person,
        other_per_person=other_per_person,
        change=change,
    )


def payment_occurs(result: WarikanResult) -> bool:
    """仕様 1.4「自分側・相手側の間で支払いが発生する場合」の判定。

    仕様は条件を明示していない（docs/SPEC_ISSUES.md #3）。
    本実装は「双方に 1 円以上の支払いがある場合」と解釈する。
    """
    return result.own_per_person > 0 and result.other_per_person > 0
