@echo off
chcp 65001 >nul
setlocal
title 黑马商城 - 停止服务
cd /d "%~dp0"

echo 正在停止 8081~8085 与前端 8090 ...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop-detached.ps1"
echo.
echo 完成。
pause
