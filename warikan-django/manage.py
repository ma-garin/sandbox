#!/usr/bin/env python
"""Django のコマンドラインユーティリティ。"""

import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:  # pragma: no cover - 環境不備時のみ
        raise ImportError(
            "Django をインポートできません。仮想環境を有効化し、"
            "requirements.txt の依存をインストールしてください。"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
