#!/usr/bin/env bash
# 品質ポータル ワンコマンド起動（macOS / Linux）
# 使い方:  ./run.sh        ← これだけ。初回は自動で環境構築まで行う。
set -e
cd "$(dirname "$0")"

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

# 1. 仮想環境（無ければ作る）
if [ ! -d .venv ]; then
  echo "▶ 初回セットアップ: 仮想環境を作成します..."
  $PY -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# 2. 依存（毎回チェック・既に入っていれば一瞬）
echo "▶ 依存パッケージを確認..."
pip install -q -r requirements.txt

# 3. DB準備＋初期データ投入
echo "▶ データベースを準備..."
python manage.py migrate --noinput >/dev/null
python manage.py seed_data >/dev/null

# 4. （任意）textlint が入っていれば日本語校正が有効になる旨を案内
if [ ! -d textlint/node_modules ] && command -v npm >/dev/null 2>&1; then
  echo "  ※ 文章校正を textlint で強化するには:  (cd textlint && npm install)"
fi

# 5. 起動
PORT="${1:-8000}"
echo ""
echo "────────────────────────────────────────────"
echo "  品質ポータルを起動しました"
echo "  ブラウザで開く →  http://127.0.0.1:${PORT}/"
echo "  停止する      →  Ctrl + C"
echo "────────────────────────────────────────────"
echo ""
python manage.py runserver "127.0.0.1:${PORT}"
