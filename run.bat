@echo off
chcp 65001 >nul
title Miracle Tea Launcher
echo Запуск проекта Miracle Tea...
echo.

REM Проверка наличия .env файла в backend
if not exist backend\.env (
    echo ВНИМАНИЕ: Файл backend\.env отсутствует.
    echo Создайте его с переменной MONGODB_URI.
    echo.
)

REM Проверка и запуск MongoDB
echo Проверка MongoDB...
where mongod >nul 2>&1
if %errorlevel% equ 0 (
    echo MongoDB найдена.
    tasklist | findstr /i mongod >nul 2>&1
    if %errorlevel% equ 0 (
        echo MongoDB уже запущена, пропускаем запуск.
    ) else (
        echo Запуск MongoDB...
        if not exist database mkdir database
        start "MongoDB" cmd /k "mongod --dbpath ./database"
    )
) else (
    echo MongoDB не найдена в PATH. Убедитесь, что MongoDB установлена и добавлена в PATH.
    echo.
)
REM Запуск бэкенда в отдельном окне
echo Запуск бэкенда...
cd backend
start "Backend" cmd /k "npm run dev"
cd ..

REM Запуск фронтенда в отдельном окне
echo Запуск фронтенда...
cd frontend
start "Frontend" cmd /k "npm run dev"
cd ..

echo.
echo Все компоненты запущены в отдельных окнах.
echo Окна:
echo   - Backend (бэкенд, порт 5000)
echo   - Frontend (фронтенд, порт 3000)
echo.
echo Чтобы остановить все процессы, закройте эти окна ИЛИ нажмите Enter в этом окне.
echo.
pause

REM Остановка процессов
echo Остановка процессов...
taskkill /FI "WINDOWTITLE eq MongoDB" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backend" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend" /T /F >nul 2>&1
echo Процессы остановлены.
pause