#!/usr/bin/env bash
# 品質ポータル ワンコマンド起動（macOS / Linux）
# このファイルは QA-PMO 直下に置いた入口です。実体は portal/run.sh。
# 使い方:  ./run.sh         ← これだけ。初回は自動で環境構築まで行う。
#          ./run.sh 9000    ← ポートを変えたいとき
set -e
cd "$(dirname "$0")/portal"
exec ./run.sh "$@"
