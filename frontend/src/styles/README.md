# Структура стилей проекта

## Обзор

Стили проекта организованы по принципу модульности и переиспользования с **чёткой системой приоритетов**. Порядок импорта в `main.jsx` определяет приоритет стилей.

## Приоритеты стилей

```
main.jsx
├── index.css (низкий приоритет)
│   └── components.css (общие переиспользуемые стили)
├── components-imports.css (средний приоритет)
│   ├── Header.css
│   ├── Footer.css
│   ├── LoginModal.css
│   └── YandexDeliveryCalculator.css
└── pages.css (высокий приоритет)
    ├── HomePage.css
    ├── CatalogPage.css
    ├── ProductPage.css
    ├── CartPage.css
    ├── CheckoutPage.css
    ├── ProfilePage.css
    ├── ThankYouPage.css
    ├── AdminPanel.css
    └── admin/*.css
```

## Файловая структура

```
src/styles/
├── index.css                 # Главный файл + базовые стили
├── components.css            # Общие переиспользуемые компоненты
├── components-imports.css    # Импорты стилей компонентов
├── pages.css                 # Импорты стилей страниц
└── README.md                 # Этот файл
```

## index.css

**Расположение:** `src/styles/index.css`

Главный файл стилей, который импортируется **первым** в `main.jsx`. Включает:

- Импорт `components.css` с общими компонентами
- Базовые сбросы и глобальные стили
- Утилитарные классы (flex, margin, padding)
- Стили для toast-уведомлений
- Стили для sticky footer

**Приоритет:** Низкий (переопределяется другими стилями)

## components.css

**Расположение:** `src/styles/components.css`

Файл содержит переиспользуемые компоненты, которые используются в нескольких местах проекта.

### Содержимое:

1. **Breadcrumbs** - навигационные цепочки
2. **Product Tags** - теги товаров
3. **Gram Controls** - элементы управления граммовкой
4. **Buttons** - кнопки (btn, btn-primary, btn-secondary, btn-outline)
5. **Modal Styles** - модальные окна
6. **Form Styles** - формы и поля ввода
7. **Search Input** - поля поиска
8. **Loading & Empty States** - состояния загрузки и пустых результатов
9. **Order Status Badges** - статусы заказов
10. **City Search Dropdown** - поиск городов с выпадающим списком
11. **Error & Success Messages** - сообщения об ошибках и успехе
12. **Tag Buttons** - кнопки тегов

**Приоритет:** Низкий (может быть переопределён)

## components-imports.css

**Расположение:** `src/styles/components-imports.css`

Импортирует стили компонентов:

- `Header.css`
- `Footer.css`
- `LoginModal.css`
- `YandexDeliveryCalculator.css`

**Приоритет:** Средний (переопределяет `components.css`, переопределяется страницами)

## pages.css

**Расположение:** `src/styles/pages.css`

Импортирует стили всех страниц в правильном порядке:

- Страницы (HomePage, CatalogPage, ProductPage, и т.д.)
- Админ-панель (AddTeaTab, SupplyTab, TagsTab, OrdersPage, EditPage)

**Приоритет:** Высокий (переопределяет все остальные стили)

## Как это работает

### Порядок импорта в `main.jsx`

```javascript
import "./styles/index.css"; // 1. Базовые стили (низкий приоритет)
import "./styles/components-imports.css"; // 2. Стили компонентов (средний)
import "./styles/pages.css"; // 3. Стили страниц (высокий)
```

### CSS-каскад

Стили, загруженные **позже**, имеют **больший приоритет** при одинаковой специфичности селекторов.

**Пример:**

```css
/* components.css (загружается первым) */
.btn-primary {
  background-color: #2e7d32; /* Будет переопределено */
}

/* CatalogPage.css (загружается последним) */
.catalog-page .btn-primary {
  background-color: #4a6fa5; /* Этот цвет применится */
}
```

## Принципы организации

### 1. DRY (Don't Repeat Yourself)

Если стиль используется в нескольких местах, он должен быть перенесён в `components.css`.

### 2. Приоритеты

- **components.css** - общие стили (низкий приоритет)
- **Компоненты** - стили компонентов (средний приоритет)
- **Страницы** - специфичные стили страниц (высокий приоритет)

### 3. Переопределение

Для переопределения стилей из `components.css`:

- Используйте более специфичные селекторы в стилях страницы
- Избегайте `!important`
- Переопределяйте только необходимые свойства

## Пример использования

### Добавление нового стиля

```css
/* ✓ Хорошо: общий стиль в components.css */
.btn-primary {
  background-color: #2e7d32;
  color: white;
}

/* ✓ Хорошо: переопределение для конкретной страницы */
.product-page .btn-primary {
  background: #4a6fa5;
}

/* ✗ Плохо: дублирование в файле страницы */
.btn-primary {
  background-color: #2e7d32;
  color: white;
}
```

### Создание нового компонента

1. Создайте CSS-файл компонента (например, `NewComponent.css`)
2. Добавьте импорт в `components-imports.css`
3. Удалите импорт CSS из JSX-файла компонента

```css
/* components-imports.css */
@import url("../components/NewComponent.css");
```

## Миграция стилей

При добавлении новых стилей:

1. Проверьте, нет ли уже такого стиля в `components.css`
2. Если стиль переиспользуемый - добавьте его в `components.css`
3. Если стиль специфичный - добавьте в файл страницы/компонента
4. Удалите дублирующиеся стили из других файлов

## Отладка

Если стили не применяются:

1. **Проверьте порядок импорта** в `main.jsx`
2. **Проверьте специфичность** селекторов в DevTools
3. **Убедитесь**, что CSS-файл импортирован в `pages.css` или `components-imports.css`
