# Интеграция Яндекс Доставки

## Обзор

Калькулятор Яндекс Доставки интегрирован на главную страницу сайта для расчета стоимости доставки заказов.

## Архитектура

### Backend

**Пакет:** `@yerkebulan-m/y-delivery` (npm)

**Файлы:**

- `backend/src/services/yandexDeliveryService.js` - основной сервис доставки
- `backend/src/services/yandexDeliveryApiWrapper.mjs` - ES6 обертка для работы с API
- `backend/src/controllers/yandexDeliveryController.js` - контроллер для обработки запросов
- `backend/src/routes/yandexDeliveryRoutes.js` - маршруты API

**API Endpoints:**

- `GET /api/yandex-delivery/cities` - получение списка доступных городов (загружается из Яндекс Карт)
- `POST /api/yandex-delivery/calculate` - расчет стоимости доставки
- `GET /api/yandex-delivery/check?city=Москва` - проверка доступности доставки в город
- `GET /api/yandex-delivery/search-cities?query=Мос` - поиск городов по названию (Яндекс Карты Suggest API)

### Frontend

**Компоненты:**

- `frontend/src/components/YandexDeliveryCalculator.jsx` - компонент калькулятора
- `frontend/src/components/YandexDeliveryCalculator.css` - стили калькулятора
- `frontend/src/services/yandexDeliveryService.js` - сервис для взаимодействия с API

**Использование на странице:**

```jsx
import YandexDeliveryCalculator from "../components/YandexDeliveryCalculator";

<YandexDeliveryCalculator />;
```

## Настройка API ключей

### Яндекс Доставка

Для работы с реальным API Яндекс Доставки необходимо настроить API ключ:

1. Получите API ключ в Яндекс Доставке
2. Добавьте в файл `.env` (backend):

```env
YANDEX_DELIVERY_API_KEY=ваш_api_ключ
```

### Яндекс Карты (для загрузки списка городов)

Для динамической загрузки списка городов из Яндекс Карт:

1. Получите API ключ в [Кабинете разработчика Яндекс Карт](https://developer.tech.yandex.ru/)
2. Добавьте в файл `.env` (backend):

```env
YANDEX_MAPS_API_KEY=ваш_api_ключ_карт
```

Если ключ не настроен, используется базовый список из 50 крупных городов России.

3. Перезапустите backend сервер

## Режимы работы

### Демонстрационный режим (по умолчанию)

Если API ключ не настроен, используется заглушка для расчета стоимости:

- Базовая цена: 200 руб
- Надбавка за расстояние: 30-80 руб (в зависимости от города)
- Надбавка за вес: 0.5 руб за 10г

### Режим реального API

При настроенном API ключе происходит запрос к реальному API Яндекс Доставки:

- Используется метод `check-price` для расчета стоимости
- Требуется токен авторизации
- Возвращает точную стоимость доставки

## Доступные города

- Воронеж (отправка)
- Москва
- Санкт-Петербург
- Екатеринбург
- Новосибирск
- Казань
- Нижний Новгород
- Самара
- Ростов-на-Дону
- Уфа

## Технические детали

### Проблемы с пакетом @yerkebulan-m/y-delivery

Пакет имеет проблему с экспортом модулей (ES6 код в commonjs окружении). Для обхода используется:

- ES6 обертка (`yandexDeliveryApiWrapper.mjs`)
- Прямое взаимодействие с API через `ky`
- Fallback на заглушку при ошибках

### Координаты городов

Для работы API используются координаты городов, определенные в `CITY_COORDINATES`:

```javascript
{
  Воронеж: { lat: 51.6717, lon: 39.2106 },
  Москва: { lat: 55.7558, lon: 37.6173 },
  // ...
}
```

## Тестирование

### Проверка API

```bash
# Получить список городов
curl http://localhost:5000/api/yandex-delivery/cities

# Рассчитать доставку
curl -X POST http://localhost:5000/api/yandex-delivery/calculate \
  -H "Content-Type: application/json" \
  -d '{"fromCity":"Воронеж","toCity":"Москва","weight":500,"amount":1000}'
```

## Примечания

- Расчет является предварительным
- Точная стоимость определяется при оформлении заказа
- API Яндекс Доставки может быть недоступно в некоторых регионах
- Метод `check-price` не поддерживается в России согласно документации пакета
