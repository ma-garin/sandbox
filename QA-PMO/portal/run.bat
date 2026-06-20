@echo off
REM 品質ポータル ワンコマンド起動（Windows）
REM 使い方:  run.bat をダブルクリック、または  run.bat
cd /d "%~dp0"

REM 1. 仮想環境（無ければ作る）
if not exist .venv (
  echo [初回セットアップ] 仮想環境を作成します...
  python -m venv .venv
)
call .venv\Scripts\activate.bat

REM 2. 依存
echo [確認] 依存パッケージ...
pip install -q -r requirements.txt

REM 3. DB準備＋初期データ
echo [準備] データベース...
python manage.py migrate --noinput >nul
python manage.py seed_data >nul

REM 4. 起動
set PORT=%1
if "%PORT%"=="" set PORT=8000
echo.
echo ------------------------------------------------
echo   品質ポータルを起動しました
echo   ブラウザで開く -^> http://127.0.0.1:%PORT%/
echo   停止する       -^> Ctrl + C
echo ------------------------------------------------
echo.
python manage.py runserver 127.0.0.1:%PORT%
