@echo off
chcp 65001 >nul
title Installing multer...

echo Установка multer для backend...
echo.

cd /d "%~dp0backend"

REM Проверяем есть ли npm в PATH
where npm >nul 2>nul
if %ERRORLEVEL%==0 (
    echo Запуск npm install multer...
    call npm install multer
) else (
    echo npm не найден в PATH. Пробуем через node...
    
    REM Пытаемся найти npm-cli.js в стандартных путях
    if exist "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" (
        node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install multer
    ) else if exist "C:\Program Files (x86)\nodejs\node_modules\npm\bin\npm-cli.js" (
        node "C:\Program Files (x86)\nodejs\node_modules\npm\bin\npm-cli.js" install multer
    ) else (
        echo Не удалось найти npm. Пожалуйста, установите Node.js или добавьте его в PATH.
        pause
        exit /b 1
    )
)

echo.
echo Установка завершена!
echo.
echo Проверка установки...
if exist "node_modules\multer\package.json" (
    echo ✓ multer успешно установлен
) else (
    echo ✗ Ошибка установки multer
)

echo.
echo Теперь вы можете запустить проект через run.bat
pause
