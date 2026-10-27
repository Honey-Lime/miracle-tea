# Доставка: СДЭК, Яндекс Доставка, Ozon

Расчёт стоимости, список ПВЗ и создание отправлений выполняет сервер
(`backend/src/services/delivery`). Ключи служб доставки хранятся только в `backend/.env`,
клиент обращается к ним через `/api/delivery/*`. EShopLogistic больше не используется,
переменную `ESHOPLOGISTIC_TOKEN` можно удалить.

На клиенте остаются только публичные ключи DaData (подсказки адресов) и Яндекс Карт.

## Как это работает

| Маршрут | Назначение |
| --- | --- |
| `POST /api/delivery/state` | службы, доступные покупателю (включены в админке и настроены в `.env`) |
| `POST /api/delivery/calculation` | `{ service, to (ФИАС города), address, weight (кг), lat, lon, recalculation }` → `{ data: { terminal, door, terminals } }` |
| `GET/PUT /api/admin/settings/delivery` | включение и отключение служб (админка → «Настройки» → «Службы доставки») |

После успешной оплаты заказ в службе доставки создаётся автоматически, как и раньше. Его номер
сохраняется в `order.delivery.did`.

Служба показывается покупателю, только если она включена в админке **и** для неё заданы ключи.

## Где взять ключи

Все значения записываются в `backend/.env` (шаблон — `backend/.env.example`). После изменения
перезапустите backend. Затем откройте админку → «Настройки» → «Службы доставки»: у службы
не должно быть пометки «не заданы ключи API».

Для каждой службы нужен **договор**: без него боевые ключи не выдают. У каждой службы есть и тестовый
режим (`*_TEST=true`), в котором заказы не уходят в реальную доставку.

### СДЭК

| Переменная | Где взять |
| --- | --- |
| `CDEK_CLIENT_ID` | [Личный кабинет СДЭК → Интеграция](https://lk.cdek.ru/integration), поле **Account** |
| `CDEK_CLIENT_SECRET` | Там же, поле **Secure password** |
| `CDEK_FROM_CITY_CODE` | Код города СДЭК, откуда вы отправляете посылки. Например, Москва — `44`, Санкт-Петербург — `137`. Код любого города вернёт метод `/v2/location/cities` из [документации API](https://api-docs.cdek.ru/), или его подскажет ваш менеджер СДЭК |
| `CDEK_SHIPMENT_POINT` | Код офиса СДЭК, куда вы сдаёте посылки (вида `MSK123`). Нужный офис найдите на [карте офисов](https://www.cdek.ru/ru/offices), код возьмите из его карточки или уточните у менеджера |
| `CDEK_TEST` | `true` — песочница `api.edu.cdek.ru` с публичными тестовыми ключами из [документации API](https://api-docs.cdek.ru/) |

Договор: [cdek.ru](https://www.cdek.ru/ru/) → «Бизнесу» → «Заключить договор».

### Яндекс Доставка

| Переменная | Где взять |
| --- | --- |
| `YANDEX_DELIVERY_TOKEN` | [Кабинет Яндекс Доставки](https://dostavka.yandex.ru/auth/) → вкладка **Интеграции** → «Активируйте интеграцию» → **Получить токен**. Токен бессрочный ([инструкция](https://yandex.ru/dev/logistics/api/about/access.html)) |
| `YANDEX_DELIVERY_STATION_ID` | `platform_station_id` склада или пункта, где вы сдаёте посылки. Его выдаёт по запросу коммерческий менеджер Яндекс Доставки ([документация API «в другой день»](https://yandex.ru/support/delivery-profile/ru/api/other-day/)) |
| `YANDEX_DELIVERY_TEST` | `true` — тестовый контур. Тестовые токен и `platform_station_id` приведены в [документации API](https://yandex.ru/support/delivery-profile/ru/api/other-day/) |

Регистрация и договор: [dostavka.yandex.ru](https://dostavka.yandex.ru/).

### Ozon Доставка (Ozon Delivery API)

| Переменная | Где взять |
| --- | --- |
| `OZON_DELIVERY_CLIENT_ID` | Личный кабинет Ozon Доставки → **Настройки → Управление частными приложениями** → создать приложение с уровнями доступа `delivery-api.delivery`, `delivery-api.delivery-point`, `delivery-api.order`, `delivery-api.posting` (или `delivery-api.all`) → в строке приложения скопировать `client_id` |
| `OZON_DELIVERY_CLIENT_SECRET` | Там же, `client_secret` |
| `OZON_DELIVERY_SHIPMENT_METHOD_ID` | ID метода доставки с типом «отгрузка в пункт Ozon» (dropoff): создаётся в кабинете Ozon Доставки, в нём выбираются пункт отгрузки и пункт для возвратов |
| `OZON_DELIVERY_ESTIMATE_PHONE` | Телефон магазина, зарегистрированный на Ozon. Расчёт `/v1/order/checkout` требует телефон получателя, а при выборе доставки покупатель ещё не указал свой |

Старые имена `OZON_LOGISTICS_CLIENT_ID` / `OZON_LOGISTICS_CLIENT_SECRET` тоже принимаются.
`OZON_LOGISTICS_FROM_PLACE_ID` и `OZON_LOGISTICS_TEST` больше не используются.

Особенности:
- доставка Ozon доступна только покупателям, зарегистрированным на Ozon (заказ создаётся по их телефону);
- список ПВЗ Ozon отдаёт целиком, сервер кеширует его на 12 часов, поэтому первый расчёт после запуска дольше обычного;
- после создания заказа сервер подтверждает сборку (`/v1/posting/approve`) — Ozon при этом проверяет баланс в кабинете;
- ответы Ozon с ошибками пишутся в лог бэкенда с меткой `[ozon]`.

Документация: [docs.ozon.ru/api/ozon-delivery](https://docs.ozon.ru/api/ozon-delivery/).

### Необязательные настройки
```
CDEK_TARIFF_TERMINAL=136   # тариф СДЭК до ПВЗ
CDEK_TARIFF_DOOR=137       # тариф СДЭК до двери
```

## Упаковка

Сервер считает посылку как коробку 15×10 см, высота которой растёт на 6 см на каждые 100 г
(минимальный вес 100 г). Размеры меняются константами в `backend/src/services/delivery/index.js`.
