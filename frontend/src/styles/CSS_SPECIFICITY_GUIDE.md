# CSS Specificity Guide

## Префиксы компонентов

Для избежания конфликтов стилей каждый компонент и страница использует уникальный префикс:

### Компоненты (components/)

| Компонент                | Префикс | Пример класса                                           |
| ------------------------ | ------- | ------------------------------------------------------- |
| Header                   | `.hdr-` | `.hdr-header`, `.hdr-logo`, `.hdr-nav`                  |
| Footer                   | `.ftr-` | `.ftr-footer`, `.ftr-content`, `.ftr-section`           |
| LoginModal               | `.lgn-` | `.lgn-modal-content`, `.lgn-error`, `.lgn-form-actions` |

### Страницы (pages/)

| Страница     | Префикс  | Пример класса                                                      |
| ------------ | -------- | ------------------------------------------------------------------ |
| HomePage     | `.hp-`   | `.hp-home-page`, `.hp-hero`, `.hp-benefits`                        |
| CatalogPage  | `.cp-`   | `.cp-catalog-page`, `.cp-products-grid`, `.cp-product-card`        |
| ProductPage  | `.pp-`   | `.pp-product-page`, `.pp-product-info`, `.pp-gram-controls`        |
| CartPage     | `.crt-`  | `.crt-cart-page`, `.crt-items`, `.crt-item`                        |
| CheckoutPage | `.chp-`  | `.chp-checkout-page`, `.chp-order-summary`, `.chp-final-total`     |
| ProfilePage  | `.prfp-` | `.prfp-profile-page`, `.prfp-profile-info`, `.prfp-orders-table`   |
| AdminPanel   | `.ap-`   | `.ap-admin-panel`, `.ap-admin-sidebar`, `.ap-sidebar-link`         |
| ThankYouPage | `.typ-`  | `.typ-thank-you-page`, `.typ-thank-you-content`                    |

### Admin страницы (pages/admin/)

| Страница   | Префикс | Пример класса                                               |
| ---------- | ------- | ----------------------------------------------------------- |
| AddTeaTab  | `.att-` | `.att-add-tea-form`, `.att-form-group`, `.att-btn-submit`   |
| EditPage   | `.ep-`  | `.ep-edit-page`, `.ep-tabs`, `.ep-tab`                      |
| OrdersPage | `.op-`  | `.op-orders-page`, `.op-orders-list`, `.op-order-row`       |
| SupplyTab  | `.st-`  | `.st-supply-tab`, `.st-search-group`, `.st-result-item`     |
| TagsTab    | `.tt-`  | `.tt-tags-tab`, `.tt-tags-overview`, `.tt-product-tag-item` |

## Глобальные классы (components.css)

Следующие классы являются **общими** и используются без префиксов:

- **Breadcrumbs**: `.breadcrumbs`
- **Product Tags**: `.product-tags`, `.tag`
- **Gram Controls**: `.gram-controls`, `.gram-btn`, `.gram-count`
- **Remains**: `.remains`
- **Buttons**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`
- **Modal**: `.modal-overlay`, `.modal-content`, `.modal-close`, `.modal-actions`
- **Forms**: `.form-group`, `.form-actions`
- **Inputs**: `.search-input`, `.city-input`
- **Loading/Empty States**: `.loading`, `.no-results`, `.no-products`
- **Order Status**: `.order-status`, `.status-ordered`, `.status-paid`, и т.д.
- **Product Info**: `.product-info`, `.product-name`
- **Messages**: `.error-message`, `.success-message`
- **Tag Buttons**: `.tag-btn`, `.tag-filter-btn`

## Правила использования

1. **Вложенность**: Стили компонента должны быть вложены под главный класс с префиксом

   ```css
   .hdr-header {
     /* стили */
   }

   .hdr-header .hdr-content {
     /* стили */
   }
   ```

2. **Именование**: Все классы внутри компонента должны использовать префикс компонента

   ```jsx
   <header className="hdr-header">
     <div className="hdr-content">
       <div className="hdr-logo">...</div>
     </div>
   </header>
   ```

3. **Глобальные классы**: Общие классы из `components.css` можно использовать без префиксов

   ```jsx
   <button className="btn btn-primary">Отправить</button>
   ```

4. **Модальные окна**: Используют общие классы `.modal-overlay`, `.modal-content` из `components.css`

## Пример структуры CSS файла компонента

```css
/* ===================================
   HEADER COMPONENT
   =================================== */
.hdr-header {
  background-color: #2e7d32;
  color: white;
  padding: 1rem 0;
}

.hdr-header .hdr-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hdr-header .hdr-logo h1 {
  font-size: 2rem;
}
```

## Миграция

При добавлении нового компонента:

1. Выберите уникальный префикс (2-4 буквы)
2. Добавьте все классы с этим префиксом
3. Сгруппируйте стили под главным классом компонента
4. Обновите JSX файл с новыми классами
