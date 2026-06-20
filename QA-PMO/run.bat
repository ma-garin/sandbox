@echo off
REM 品質ポータル ワンコマンド起動（Windows）
REM このファイルは QA-PMO 直下に置いた入口です。実体は portal\run.bat。
REM 使い方:  run.bat をダブルクリック、または  run.bat 9000
cd /d "%~dp0portal"
call run.bat %*
