#!/bin/bash
set -e
export PATH="/usr/bin:/bin:$PATH"

PROJECT_DIR=/var/www/miracle-tea

echo "===> Переход в проект"
cd $PROJECT_DIR

echo "===> Обновление кода"
git fetch origin main
git reset --hard origin/main

echo "===> Установка backend зависимостей"
cd $PROJECT_DIR/backend
npm install

echo "===> Установка frontend зависимостей"
cd $PROJECT_DIR/frontend
npm install

echo "===> Сборка frontend"
npm run build

echo "===> Перезапуск backend"
cd $PROJECT_DIR/backend
pm2 restart miracle-tea

echo "===> Сохранение PM2 состояния"
pm2 save

echo "===> Deploy завершён"
