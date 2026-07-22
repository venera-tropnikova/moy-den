@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Developer Toolkit — Завершение модуля

rem Работаем из папки, где лежит этот файл (корень проекта)
cd /d "%~dp0"
if errorlevel 1 (
  echo Ошибка: не удалось перейти в папку скрипта.
  goto :end_fail
)

echo ========================================
echo Developer Toolkit
echo Завершение модуля
echo ========================================
echo.
echo Текущая папка:
echo %CD%
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo Ошибка: Git не найден. Установите Git и убедитесь, что команда git доступна в PATH.
  goto :end_fail
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Ошибка: текущая папка не является Git-репозиторием.
  echo Поместите finish-module.bat в корень проекта с папкой .git и запустите снова.
  goto :end_fail
)

set "MODULE_NAME="
set /p "MODULE_NAME=Какой модуль завершён? "
if not defined MODULE_NAME (
  echo.
  echo Название модуля пустое. Операция отменена.
  goto :end_fail
)
if "%MODULE_NAME%"=="" (
  echo.
  echo Название модуля пустое. Операция отменена.
  goto :end_fail
)

set "COMMIT_MSG=Завершен %MODULE_NAME%"

echo.
echo Изменённые файлы:
echo ----------------------------------------
git status --short
echo ----------------------------------------
echo.
echo Текст коммита:
echo %COMMIT_MSG%
echo.

set "CONFIRM="
set /p "CONFIRM=Продолжить завершение модуля? Y/N: "
if /I not "%CONFIRM%"=="Y" (
  echo.
  echo Операция отменена пользователем.
  goto :end_fail
)

echo.
echo [1/3] git add .
git add .
if errorlevel 1 (
  echo.
  echo Ошибка на этапе: git add
  echo Модуль НЕ завершён.
  goto :end_fail
)

echo.
echo [2/3] git commit
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%COMMIT_MSG%"
  if errorlevel 1 (
    echo.
    echo Ошибка на этапе: git commit
    echo Модуль НЕ завершён.
    goto :end_fail
  )
) else (
  echo Новых изменений для коммита нет.
  echo Если есть неотправленный локальный коммит, будет выполнен git push.
)

echo.
echo [3/3] git push
git push
if errorlevel 1 (
  echo.
  echo Ошибка на этапе: git push
  echo Модуль НЕ завершён.
  goto :end_fail
)

for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "BRANCH_NAME=%%B"
if not defined BRANCH_NAME set "BRANCH_NAME=(не определена)"

echo.
echo ========================================
echo.
echo 🎉 МОДУЛЬ ОФИЦИАЛЬНО ЗАВЕРШЁН
echo.
echo Модуль:
echo %MODULE_NAME%
echo.
echo Дата:
echo %DATE%
echo.
echo Ветка:
echo %BRANCH_NAME%
echo.
echo ✅ Коммит создан или уже существовал.
echo ✅ Модуль перемещён в GitHub.
echo ✅ Локальная и удалённая версии синхронизированы.
echo.
echo Статус:
echo 🟢 Репозиторий синхронизирован.
echo.
echo Следующий модуль можно начинать.
echo.
echo Хорошей работы!
echo.
echo ========================================
echo.
pause
cls
endlocal
exit /b 0

:end_fail
echo.
pause
cls
endlocal
exit /b 1