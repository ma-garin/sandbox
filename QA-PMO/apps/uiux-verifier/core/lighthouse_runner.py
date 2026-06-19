"""Lighthouse実行ラッパー。

Google LighthouseのNode CLIをsubprocessで呼び出すのみ。性能/品質監査ロジックは
一切自作しない。CLIが無い環境ではNoneスコアで継続する（グレースフル）。
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile

from .schema import LighthouseScores


def is_available() -> bool:
    """lighthouse CLIが利用可能か判定する。"""
    return shutil.which("lighthouse") is not None


def run_lighthouse(url: str, timeout_sec: int = 90) -> LighthouseScores:
    """URLに対しLighthouseを実行し、カテゴリスコアを返す。

    CLI未導入・実行失敗時はすべてNoneのスコアを返す。
    """
    if not is_available():
        return LighthouseScores()

    with tempfile.NamedTemporaryFile(suffix=".json", delete=True) as tmp:
        cmd = [
            "lighthouse",
            url,
            "--quiet",
            "--output=json",
            f"--output-path={tmp.name}",
            '--chrome-flags=--headless --no-sandbox',
        ]
        try:
            subprocess.run(cmd, timeout=timeout_sec, check=True, capture_output=True)
            data = json.load(open(tmp.name, encoding="utf-8"))
        except (subprocess.SubprocessError, OSError, json.JSONDecodeError):
            return LighthouseScores()

    cats = data.get("categories", {})

    def score(key: str) -> float | None:
        cat = cats.get(key)
        return cat.get("score") if cat else None

    return LighthouseScores(
        performance=score("performance"),
        accessibility=score("accessibility"),
        best_practices=score("best-practices"),
        seo=score("seo"),
    )
