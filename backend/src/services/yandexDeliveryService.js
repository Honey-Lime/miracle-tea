require("dotenv").config();
const path = require("path");
const { pathToFileURL } = require("url");

const YANDEX_DELIVERY_API_KEY = process.env.YANDEX_DELIVERY_API_KEY;

// Координаты городов для API Яндекс Доставки
const CITY_COORDINATES = {
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
function getCityCoordinates(cityName) {
  return CITY_COORDINATES[cityName] || null;
}

/**
 * Расчет стоимости доставки через Яндекс Доставку с использованием официального SDK
 * @param {Object} params
 * @param {string} params.fromCity - город отправления (название)
 * @param {string} params.toCity - город получения (название)
 * @param {number} params.weight - вес в граммах
 * @param {number} params.amount - стоимость заказа в рублях (для страховки)
 * @returns {Promise<Object>} объект с ценой, сроком и деталями
 */
async function calculateNextDayDelivery(params) {
  const { fromCity = "Воронеж", toCity, weight, amount = 0 } = params;

  // Если нет конфигурации, используем заглушку
  if (!YANDEX_DELIVERY_API_KEY) {
    console.warn(
      "Yandex Delivery API key missing, using stub data for Next Day Delivery",
    );
    return calculateStub(fromCity, toCity, weight);
  }

  try {
    // Динамический импорт ES6 модуля
    const wrapperPath = pathToFileURL(
      path.join(__dirname, "yandexDeliveryApiWrapper.mjs"),
    ).href;
    const wrapper = await import(wrapperPath);

    // Вызываем функцию расчета из ES6 обертки
    const result = await wrapper.calculateWithSDK({
      fromCity,
      toCity,
      weight,
      amount,
    });

    return result;
  } catch (error) {
    console.error("Yandex Delivery SDK error:", error.message);
    // В случае ошибки используем заглушку
    return calculateStub(fromCity, toCity, weight);
  }
}

/**
 * Заглушка для расчета (используется при отсутствии конфигурации или ошибке API)
 */
function calculateStub(fromCity, toCity, weight) {
  // Базовая цена 200 руб + 0.5 руб за 10г + надбавка за расстояние
  const basePrice = 200;
  const distancePrice =
    toCity === "Москва" ? 50 : toCity === "Санкт-Петербург" ? 80 : 30;
  const weightPrice = (weight / 10) * 0.5;
  const price = basePrice + distancePrice + weightPrice;
  const randomVariation = (Math.random() - 0.5) * 40;
  const finalPrice = Math.max(150, Math.round(price + randomVariation));

  return {
    success: true,
    price: finalPrice,
    currency: "RUB",
    minDays: 1,
    maxDays: 2,
    service: "Yandex Next Day Delivery (stub)",
    details: {
      note: "Расчет выполнен на основе заглушки. Для реального расчета настройте API ключи.",
      fromCity,
      toCity,
      weight,
    },
  };
}

/**
 * Получение списка городов, куда возможна доставка на следующий день
 * Загружает города из Яндекс Карт Suggest API
 */
async function getAvailableCities() {
  try {
    // Динамический импорт ES6 модуля
    const wrapperPath = pathToFileURL(
      path.join(__dirname, "yandexDeliveryApiWrapper.mjs"),
    ).href;
    const wrapper = await import(wrapperPath);

    // Получаем города из Яндекс Карт
    const cities = await wrapper.getCitiesFromYandex();
    return cities;
  } catch (error) {
    console.error("Error loading cities from Yandex:", error.message);
    // Fallback на локальный список
    return Object.entries(CITY_COORDINATES).map(([name, coords], index) => ({
      code: name.substring(0, 3).toUpperCase(),
      name,
    }));
  }
}

/**
 * Поиск городов по названию
 * @param {string} query - поисковый запрос
 */
async function searchCities(query) {
  try {
    const wrapperPath = pathToFileURL(
      path.join(__dirname, "yandexDeliveryApiWrapper.mjs"),
    ).href;
    const wrapper = await import(wrapperPath);

    return await wrapper.searchCities(query);
  } catch (error) {
    console.error("Error searching cities:", error.message);
    return [];
  }
}

module.exports = {
  calculateNextDayDelivery,
  getAvailableCities,
  searchCities,
};
