// Прямое взаимодействие с API Яндекс Доставки без использования npm пакета
// Пакет @yerkebulan-m/y-delivery имеет проблемы с экспортом (ES6 в commonjs)

import ky from "ky";

// API ключ Яндекс Карт для получения списка городов
const YANDEX_MAPS_API_KEY = process.env.YANDEX_MAPS_API_KEY;

// Базовый список крупных городов России для fallback
const BASE_CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Уфа",
  "Ростов-на-Дону",
  "Омск",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Краснодар",
  "Саратов",
  "Тюмень",
  "Тольятти",
  "Ижевск",
  "Барнаул",
  "Ульяновск",
  "Иркутск",
  "Хабаровск",
  "Ярославль",
  "Владивосток",
  "Махачкала",
  "Оренбург",
  "Кемерово",
  "Новокузнецк",
  "Рязань",
  "Астрахань",
  "Пенза",
  "Липецк",
  "Киров",
  "Чебоксары",
  "Тула",
  "Калининград",
  "Балашиха",
  "Курск",
  "Севастополь",
  "Улан-Удэ",
  "Ставрополь",
  "Сочи",
  "Тверь",
  "Магнитогорск",
  "Иваново",
  "Брянск",
  "Сургут",
  "Белгород",
  "Владимир",
  "Нижний Тагил",
  "Архангельск",
  "Чита",
  "Калуга",
];

// Координаты городов для API Яндекс Доставки
export const CITY_COORDINATES = {
  Воронеж: { lat: 51.6717, lon: 39.2106, address: "ул. Героев Сибиряков, 7" },
  Москва: { lat: 55.7558, lon: 37.6173 },
  "Санкт-Петербург": { lat: 59.9343, lon: 30.3351 },
  Екатеринбург: { lat: 56.8389, lon: 60.6057 },
  Новосибирск: { lat: 55.0084, lon: 82.9357 },
  Казань: { lat: 55.7961, lon: 49.1064 },
  "Нижний Новгород": { lat: 56.2965, lon: 43.9361 },
  Самара: { lat: 53.2001, lon: 50.15 },
  "Ростов-на-Дону": { lat: 47.2357, lon: 39.7015 },
  Уфа: { lat: 54.7388, lon: 55.9721 },
};

/**
 * Получить координаты города
 */
export function getCityCoordinates(cityName) {
  return CITY_COORDINATES[cityName] || null;
}

/**
 * Получить список городов через Яндекс Карты Suggest API
 * Используется для динамической загрузки доступных городов
 */
export async function getCitiesFromYandex() {
  try {
    // Если нет API ключа Яндекс Карт, возвращаем базовый список
    if (!YANDEX_MAPS_API_KEY) {
      console.log("YANDEX_MAPS_API_KEY not configured, using base cities list");
      return BASE_CITIES.map((name, index) => ({
        code: name.substring(0, 3).toUpperCase(),
        name,
      }));
    }

    // Используем Яндекс Карты Suggest API для получения городов
    // Запрашиваем города-миллионники и крупные региональные центры
    const client = ky.extend({
      prefixUrl: "https://suggest-maps.yandex.ru/v1",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Поиск городов по запросу (пустой запрос вернет популярные)
    const response = await client
      .get("suggest", {
        searchParams: {
          apikey: YANDEX_MAPS_API_KEY,
          text: "город",
          types: "locality",
          results: 100,
          lang: "ru_RU",
        },
      })
      .json();

    if (response && response.results) {
      // Извлекаем уникальные названия городов
      const cities = response.results
        .filter((item) => item.types && item.types.includes("locality"))
        .map((item) => ({
          code: item.title.substring(0, 3).toUpperCase(),
          name: item.title,
          coordinates: item.point
            ? {
                lat: parseFloat(item.point.split(",")[1]),
                lon: parseFloat(item.point.split(",")[0]),
              }
            : null,
        }))
        .filter(
          (city, index, self) =>
            index === self.findIndex((c) => c.name === city.name),
        )
        .slice(0, 50); // Ограничиваем количество

      // Добавляем координаты для известных городов
      cities.forEach((city) => {
        if (CITY_COORDINATES[city.name]) {
          city.coordinates = {
            lat: CITY_COORDINATES[city.name].lat,
            lon: CITY_COORDINATES[city.name].lon,
          };
        }
      });

      return cities;
    }

    // Fallback на базовый список
    return BASE_CITIES.map((name, index) => ({
      code: name.substring(0, 3).toUpperCase(),
      name,
    }));
  } catch (error) {
    console.error("Error fetching cities from Yandex Maps:", error.message);
    // Возвращаем базовый список при ошибке
    return BASE_CITIES.map((name, index) => ({
      code: name.substring(0, 3).toUpperCase(),
      name,
    }));
  }
}

/**
 * Поиск города по названию с использованием Яндекс Карт
 * @param {string} query - поисковый запрос
 * @returns {Promise<Array>} список найденных городов
 */
export async function searchCities(query) {
  try {
    if (!YANDEX_MAPS_API_KEY || !query || query.length < 2) {
      // Локальный поиск по базовому списку
      return BASE_CITIES.filter((name) =>
        name.toLowerCase().includes(query.toLowerCase()),
      ).map((name) => ({
        code: name.substring(0, 3).toUpperCase(),
        name,
        coordinates: CITY_COORDINATES[name]
          ? {
              lat: CITY_COORDINATES[name].lat,
              lon: CITY_COORDINATES[name].lon,
            }
          : null,
      }));
    }

    const client = ky.extend({
      prefixUrl: "https://suggest-maps.yandex.ru/v1",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const response = await client
      .get("suggest", {
        searchParams: {
          apikey: YANDEX_MAPS_API_KEY,
          text: query,
          types: "locality",
          results: 20,
          lang: "ru_RU",
        },
      })
      .json();

    if (response && response.results) {
      return response.results
        .filter((item) => item.types && item.types.includes("locality"))
        .map((item) => ({
          code: item.title.substring(0, 3).toUpperCase(),
          name: item.title,
          coordinates: item.point
            ? {
                lat: parseFloat(item.point.split(",")[1]),
                lon: parseFloat(item.point.split(",")[0]),
              }
            : null,
        }));
    }

    return [];
  } catch (error) {
    console.error("Error searching cities:", error.message);
    return [];
  }
}

/**
 * Расчет стоимости доставки через Яндекс Доставку API
 * @param {Object} params
 * @param {string} params.fromCity - город отправления (название)
 * @param {string} params.toCity - город получения (название)
 * @param {number} params.weight - вес в граммах
 * @param {number} params.amount - стоимость заказа в рублях (для страховки)
 * @returns {Promise<Object>} объект с ценой, сроком и деталями
 */
export async function calculateWithSDK(params) {
  const { fromCity = "Воронеж", toCity, weight, amount = 0 } = params;

  const YANDEX_DELIVERY_API_KEY = process.env.YANDEX_DELIVERY_API_KEY;

  if (!YANDEX_DELIVERY_API_KEY) {
    throw new Error("YANDEX_DELIVERY_API_KEY not configured");
  }

  // Получаем координаты городов
  const fromCoords = getCityCoordinates(fromCity);
  const toCoords = getCityCoordinates(toCity);

  if (!fromCoords || !toCoords) {
    throw new Error(`Coordinates not found for ${fromCity} or ${toCity}`);
  }

  // Создаем HTTP клиент
  const client = ky.extend({
    prefixUrl: "https://b2b.taxi.yandex.net",
    headers: {
      Authorization: `Bearer ${YANDEX_DELIVERY_API_KEY}`,
      "Accept-Language": "ru",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  // Формируем запрос для check-price
  const checkPriceRequest = {
    items: [
      {
        size: {
          length: 0.1,
          width: 0.1,
          height: 0.1,
        },
        weight: weight / 1000, // вес в кг
        quantity: 1,
        pickup_point: 0,
        dropoff_point: 1,
      },
    ],
    route_points: [
      {
        id: 0,
        coordinates: [fromCoords.lon, fromCoords.lat],
        fullname: fromCoords.address || fromCity,
      },
      {
        id: 1,
        coordinates: [toCoords.lon, toCoords.lat],
        fullname: toCity,
      },
    ],
    requirements: {
      taxi_class: "cargo",
      cargo_type: "van",
    },
    skip_door_to_door: false,
  };

  // Вызываем API
  const response = await client
    .post("b2b/cargo/integration/v2/check-price", {
      json: checkPriceRequest,
    })
    .json();

  if (!response || !response.price) {
    throw new Error("Empty or invalid response from Yandex Delivery API");
  }

  return {
    success: true,
    price: parseFloat(response.price),
    currency: response.currency || "RUB",
    minDays: response.delivery_time?.min || 1,
    maxDays: response.delivery_time?.max || 2,
    service: "Yandex Next Day Delivery",
    details: response,
  };
}

/**
 * Получение списка городов на основе доступных координат
 */
export function getAvailableCitiesESM() {
  return Object.entries(CITY_COORDINATES).map(([name, coords], index) => ({
    code: name.substring(0, 3).toUpperCase(),
    name,
  }));
}
