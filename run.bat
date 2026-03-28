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
echo Запуск MongoDB...
if not exist database mkdir database
REM Проверка наличия mongod.exe в стандартных путях
set MONGOD_PATH=
if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" set MONGOD_PATH=C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe
if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" set MONGOD_PATH=C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe
if exist "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" set MONGOD_PATH=C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe
if "%MONGOD_PATH%"=="" set MONGOD_PATH=mongod

REM Проверка на уже запущенный MongoDB
tasklist /FI "IMAGENAME eq mongod.exe" 2>nul | find "mongod.exe" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo MongoDB уже запущен. Пропускаем запуск.
) else (
    REM Останавливаем предыдущий процесс MongoDB если есть
    taskkill /FI "WINDOWTITLE eq MongoDB" /T /F >nul 2>&1
    timeout /t 1 /nobreak >nul

    start "MongoDB" cmd /k "echo Запуск MongoDB... && echo Путь: %MONGOD_PATH% && echo. && %MONGOD_PATH% --dbpath ./database"
    timeout /t 3 /nobreak >nul
    echo MongoDB запущена в отдельном окне.
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
echo   - MongoDB (база данных)
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
taskkill /IM mongod.exe /F >nul 2>&1
echo Процессы остановлены.
pause