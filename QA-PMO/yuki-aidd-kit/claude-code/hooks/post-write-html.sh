#!/bin/bash
# post-write-html.sh — HTML保存後の確認
# 行数・localStorage使用有無をチェック

FILE="$1"

if echo "$FILE" | grep -qE '\.html$'; then
  LINES=$(wc -l < "$FILE" 2>/dev/null)
  echo "📄 $FILE — ${LINES}行"
  if [ "$LINES" -gt 2000 ]; then
    echo "⚠ 2000行超。分割またはStreamlit移行を検討してください"
  fi
  if ! grep -q "localStorage" "$FILE" 2>/dev/null; then
    echo "ℹ localStorage未使用。個人PWA用途ならデータ永続化を確認してください"
  fi
fi

exit 0
