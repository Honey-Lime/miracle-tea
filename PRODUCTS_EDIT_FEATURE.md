# Функционал редактирования товаров в админке

## Обзор изменений

Добавлена новая вкладка **Товары** в панель редактирования админки, которая позволяет:

- Просматривать список всех товаров
- Искать товары по названию
- Редактировать товары в модальном окне
- Удалять товары
- **Загружать изображения и видео файлы из файловой системы**
- **Управлять порядком отображения медиафайлов через drag-and-drop**

## Новые файлы

### Backend:

- `backend/src/middleware/uploadMiddleware.js` - middleware для загрузки файлов (multer)

### Frontend компоненты:

- `frontend/src/pages/admin/ProductsTab.jsx` - вкладка со списком товаров
- `frontend/src/pages/admin/EditProductModal.jsx` - модальное окно редактирования товара
- `frontend/src/pages/admin/ProductsTab.css` - стили для вкладки товаров
- `frontend/src/pages/admin/EditProductModal.css` - стили для модального окна

### Измененные файлы:

#### Frontend:

- `frontend/src/pages/admin/EditPage.jsx` - добавлена вкладка "Товары"
- `frontend/src/pages/admin/AddTeaTab.jsx` - добавлена поддержка загрузки файлов
- `frontend/src/pages/admin/AddTeaTab.css` - стили для загрузки файлов
- `frontend/src/styles/pages.css` - импорты новых стилей

#### Backend:

- `backend/src/models/Product.js` - обновлено поле `images` (теперь массив объектов с url, type, order)
- `backend/src/controllers/adminController.js` - методы `updateProduct`, `deleteProduct`, `uploadProductMedia`, `reorderProductImages`, `deleteProductImage`
- `backend/src/controllers/productController.js` - поддержка новой структуры images
- `backend/src/routes/adminRoutes.js` - роуты для загрузки и управления медиа
- `backend/src/index.js` - статическая раздача загруженных файлов

## Установка зависимостей

Для работы загрузки файлов необходимо установить multer:

```bash
cd backend
npm install multer
```

## API Endpoints

### Загрузка медиафайлов

```
POST /api/admin/products/upload-media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form data:
- media: File[] (до 10 файлов)

Response:
{
  "files": [
    {
      "url": "/uploads/products/media-1234567890-image.jpg",
      "type": "image",
      "order": 1234567890123
    }
  ]
}
```

### Переупорядочивание медиафайлов

```
PUT /api/admin/products/:id/reorder-media
Authorization: Bearer <token>
Body: {
  images: [
    { url: string, type: 'image' | 'video', order: number },
    ...
  ]
}
```

### Удаление медиафайла

```
PUT /api/admin/products/:id/delete-media
Authorization: Bearer <token>
Body: {
  imageIndex: number
}
```

### Обновление товара

```
PUT /api/admin/products/:id
Authorization: Bearer <token>
Body: {
  name: string,
  content: string[],
  description: string,
  price: number,
  cost: number,
  remains: number,
  tags: string[],
  images: [
    { url: string, type: 'image' | 'video', order: number },
    ...
  ]
}
```

### Удаление товара

```
DELETE /api/admin/products/:id
Authorization: Bearer <token>
```

## Структура вкладки Товары

### Список товаров

Таблица с колонками:

- **Название** - имя товара
- **Цена** - цена в рублях
- **Остаток** - количество на складе в граммах
- **Теги** - список тегов (показываются первые 3, остальные через "+N")
- **Действия** - кнопки редактирования (✏️) и удаления (🗑️)

### Модальное окно редактирования

Поля для редактирования:

1. **Название** - текстовое поле
2. **Содержимое** - текстовое поле (через запятую)
3. **Теги** - кнопки для выбора из существующих тегов
4. **Описание** - текстовая область
5. **Цена** - числовое поле
6. **Себестоимость** - числовое поле (опционально)
7. **Остаток** - числовое поле
8. **Медиафайлы**:
   - Загрузка файлов через кнопку выбора файлов
   - Drag-and-drop для изменения порядка
   - Поддержка изображений: JPEG, PNG, WebP, GIF
   - Поддержка видео: MP4, WebM, MOV
   - Отображение миниатюр с типом файла и порядком
   - Удаление файлов (кнопка ×)
   - Лимит: до 10 файлов за раз, макс. 50MB каждый

## Модель данных Product

```javascript
{
  name: String (required),
  content: [String],
  description: String (required),
  price: Number (required, min: 0),
  cost: Number (min: 0),
  remains: Number (required, min: 0),
  tags: [String],
  images: [
    {
      url: String (required),      // URL файла
      type: String (enum: ['image', 'video']),
      order: Number                // Порядок отображения
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## Загрузка файлов

### Настройка

Файлы сохраняются в директорию `backend/uploads/products/` и доступны по URL `/uploads/products/<filename>`

### Поддерживаемые форматы

- **Изображения**: JPEG, PNG, WebP, GIF
- **Видео**: MP4, WebM, MOV

### Лимиты

- Максимум 10 файлов за одну загрузку
- Максимальный размер файла: 50MB

## Управление порядком изображений

1. В модальном окне редактирования зажмите файл мышкой
2. Перетащите на нужное место
3. Порядок сохранится автоматически после перетаскивания

Визуальные индикаторы:

- ⋮⋮ - иконка drag-handle в правом нижнем углу
- Цифра в левом верхнем углу показывает текущий порядок
- При перетаскивании элемент становится полупрозрачным

## Видео в товарах

Видеофайлы отображаются в модальном окне с:

- Иконкой 🎬 в левом верхнем углу
- Элементом `<video>` с controls для предпросмотра
- На странице товара видео будет отображаться вместо изображения

## Запуск приложения

Используйте `run.bat` для запуска проекта:

```bash
./run.bat
```

После запуска:

1. Откройте браузер на `http://localhost:5173` (или другой порт, указанный в консоли)
2. Войдите как администратор
3. Перейдите в Админка → Редактирование → Товары

## Тестирование

### Проверка функционала:

1. ✅ Отображение списка всех товаров
2. ✅ Поиск товаров по названию
3. ✅ Открытие модального окна редактирования
4. ✅ Редактирование всех полей товара
5. ✅ Загрузка изображений из файловой системы
6. ✅ Загрузка видео из файловой системы
7. ✅ Drag-and-drop сортировка медиафайлов
8. ✅ Удаление медиафайлов
9. ✅ Сохранение изменений
10. ✅ Удаление товара с подтверждением
11. ✅ Обновление списка после изменений

## Примечания

- Все изменения применяются немедленно без перезагрузки страницы
- При удалении товара требуется подтверждение
- При удалении медиафайла он удаляется и с диска
- Модальное окно закрывается по клику на фон или кнопку "Отмена"
- Теги можно выбирать из существующих или создавать новые во вкладке "Теги"
- Для добавления товара также доступна вкладка "Добавить чай" с аналогичным функционалом загрузки медиа
