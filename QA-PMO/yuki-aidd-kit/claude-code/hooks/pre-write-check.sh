#!/bin/bash
# pre-write-check.sh — 書き込み前チェック
# 秘密情報の直書き、外部分割漏れを警告する

FILE="$1"

if echo "$FILE" | grep -qE '\.(html|js|py|json)$'; then
  if grep -qE '(api[_-]?key|secret|password)\s*[:=]\s*["\047][A-Za-z0-9_\-]{16,}' "$FILE" 2>/dev/null; then
    echo "⚠ 警告: APIキー/シークレットらしき直書きを検出。.envまたは環境変数に分離してください: $FILE"
  fi
fi

exit 0
