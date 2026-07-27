"""画面間の状態保持。

仕様 2 / 3 / 4 に共通する「戻るボタンで遷移前の状態に復帰する」を満たすため、
計算画面の入力値と計算結果をセッションに保持する。

保存する値は常に新しい dict として作り直す（既存の dict を書き換えない）。
"""

from __future__ import annotations

from typing import Any

from .domain.calculation import WarikanInput, WarikanResult

ACCOUNT_KEY = "account_id"
CALC_KEY = "calc_state"

# 「アカウント情報を記録する」の保存先（仕様 1.1.2 の代替実装）。
REMEMBER_ID_COOKIE = "warikan_remembered_user_id"
REMEMBER_FLAG_COOKIE = "warikan_remember_account"
REMEMBER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365


def login(request, account_id: int) -> None:
    request.session.cycle_key()
    request.session[ACCOUNT_KEY] = account_id


def logged_in_account_id(request) -> int | None:
    return request.session.get(ACCOUNT_KEY)


def save_calculation(
    request, params: WarikanInput, result: WarikanResult | None
) -> None:
    """計算画面の入力値と結果を保存する。"""
    request.session[CALC_KEY] = {
        "own_count": params.own_count,
        "other_count": params.other_count,
        "total_amount": params.total_amount,
        "own_ratio": params.own_ratio,
        "result": (
            None
            if result is None
            else {
                "own_per_person": result.own_per_person,
                "other_per_person": result.other_per_person,
                "change": result.change,
            }
        ),
    }


def load_calculation(request) -> dict[str, Any] | None:
    return request.session.get(CALC_KEY)


def load_result(request) -> WarikanResult | None:
    """保存済みの計算結果を復元する。無ければ None。"""
    state = load_calculation(request)
    if not state or not state.get("result"):
        return None
    return WarikanResult(**state["result"])


def load_input(request) -> WarikanInput | None:
    state = load_calculation(request)
    if not state:
        return None
    return WarikanInput(
        own_count=state["own_count"],
        other_count=state["other_count"],
        total_amount=state["total_amount"],
        own_ratio=state["own_ratio"],
    )


def clear_calculation(request) -> None:
    request.session.pop(CALC_KEY, None)
