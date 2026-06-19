#!/bin/bash
# session-summary.sh — セッション終了時の確認
# コミット忘れ・CURRENT_STATE.md更新忘れを警告

if [ -d ".git" ]; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠ 未コミットの変更があります"
  fi
fi

if [ -f "CURRENT_STATE.md" ]; then
  MODIFIED=$(find CURRENT_STATE.md -mmin -60 2>/dev/null)
  if [ -z "$MODIFIED" ]; then
    echo "ℹ CURRENT_STATE.mdが直近1時間更新されていません。状態を反映してください"
  fi
else
  echo "ℹ CURRENT_STATE.mdが存在しません。次回セッション引き継ぎ用に作成を検討してください"
fi

exit 0
