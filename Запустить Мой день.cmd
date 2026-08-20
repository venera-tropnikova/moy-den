@echo off
chcp 65001 >nul
set "PROJECT_DIR=D:\Cursor Проект Мой день"
set "APP_URL=http://127.0.0.1:8000/index.html"

echo Проверяю локальный сервер...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"

if errorlevel 1 (
  echo Сервер не запущен. Закрываю старые локальные серверы...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'python' -and $_.CommandLine -match 'http\.server' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

  echo Запускаю проект из: %PROJECT_DIR%
  start "Мой день — локальный сервер" /D "%PROJECT_DIR%" python -m http.server 8000 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
) else (
  echo Сервер уже работает. Новый сервер не запускаю.
)

start "" "%APP_URL%"

echo.
echo Приложение открыто по адресу:
echo %APP_URL%
