const axios = require("axios");
require("dotenv").config();

const YANDEX_DELIVERY_API_KEY = process.env.YANDEX_DELIVERY_API_KEY;
const YANDEX_DELIVERY_BASE_URL =
  process.env.YANDEX_DELIVERY_BASE_URL || "https://api.dostavka.yandex.ru";
const YANDEX_DELIVERY_PARTNER_ID = process.env.YANDEX_DELIVERY_PARTNER_ID;

/**
 * Получение токена авторизации (если требуется)
 */
async function getAuthToken() {
  // В зависимости от API может потребоваться OAuth2
  // Возвращаем API ключ как Bearer токен
  return YANDEX_DELIVERY_API_KEY;
}

/**
 * Расчет стоимости доставки через Яндекс Доставку Next Day Delivery
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
  if (!YANDEX_DELIVERY_API_KEY || !YANDEX_DELIVERY_PARTNER_ID) {
    console.warn(
      "Yandex Delivery API credentials missing, using stub data for Next Day Delivery",
    );
    return calculateStub(fromCity, toCity, weight);
  }

  const token = await getAuthToken();
  const url = `${YANDEX_DELIVERY_BASE_URL}/v2/calculator/next-day`;

  const requestBody = {
    partner_id: YANDEX_DELIVERY_PARTNER_ID,
    sender_point: {
      location: {
        city: fromCity,
        address: "ул. Героев Сибиряков, 7",
      },
    },
    receiver_point: {
      location: {
        city: toCity,
      },
    },
    items: [
      {
        weight: weight / 1000, // кг
        dimensions: {
          length: 0.1,
          width: 0.1,
          height: 0.1,
        },
      },
    ],
    delivery_type: "NEXT_DAY",
    declared_value: amount,
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    // Предполагаем структуру ответа
    const data = response.data;
    return {
      success: true,
      price: data.delivery_cost / 100, // переводим из копеек в рубли
      currency: "RUB",
      minDays: data.delivery_min_days || 1,
      maxDays: data.delivery_max_days || 2,
      service: "Yandex Next Day Delivery",
      details: data,
    };
  } catch (error) {
    console.error(
      "Yandex Delivery API error:",
      error.response?.data || error.message,
    );
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
 */
async function getAvailableCities() {
  // Заглушка: возвращаем популярные города
  return [
    { code: "MOS", name: "Москва" },
    { code: "SPB", name: "Санкт-Петербург" },
    { code: "VOR", name: "Воронеж" },
    { code: "EKB", name: "Екатеринбург" },
    { code: "NSK", name: "Новосибирск" },
    { code: "KZN", name: "Казань" },
    { code: "NNG", name: "Нижний Новгород" },
    { code: "SMR", name: "Самара" },
  ];
}

module.exports = {
  calculateNextDayDelivery,
  getAvailableCities,
};
