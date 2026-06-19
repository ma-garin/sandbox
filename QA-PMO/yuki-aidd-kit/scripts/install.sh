#!/bin/bash
# install.sh — Yuki AIDD Kit インストーラ
set -e
KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_DIR="$HOME/.claude"

mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/commands" "$CLAUDE_DIR/hooks"

# CLAUDE.md
if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  echo "⚠ CLAUDE.md が既存。バックアップ後に確認してください: $CLAUDE_DIR/CLAUDE.md.bak"
  cp "$CLAUDE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md.bak"
fi
cp "$KIT_DIR/CLAUDE.md.template" "$CLAUDE_DIR/CLAUDE.md"
echo "✅ CLAUDE.md"

# スキル
cp -r "$KIT_DIR/skills/"* "$CLAUDE_DIR/skills/"
echo "✅ スキル: $(ls "$KIT_DIR/skills" | wc -l)個"

# コマンド
cp "$KIT_DIR/claude-code/commands/"*.md "$CLAUDE_DIR/commands/"
echo "✅ コマンド: $(ls "$KIT_DIR/claude-code/commands" | wc -l)個"

# Hooks
cp "$KIT_DIR/claude-code/hooks/"*.sh "$CLAUDE_DIR/hooks/"
chmod +x "$CLAUDE_DIR/hooks/"*.sh
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  echo "⚠ settings.json が既存。hooks設定を手動でマージしてください（参照: claude-code/hooks/settings.json）"
else
  cp "$KIT_DIR/claude-code/hooks/settings.json" "$CLAUDE_DIR/settings.json"
fi
echo "✅ Hooks: 3個"

echo ""
echo "Codexを使う場合: AGENTS.md.template を ~/.codex/AGENTS.md にコピーしてください"
echo ""
echo "=== 完了 ==="
echo "確認: ./scripts/verify.sh"
