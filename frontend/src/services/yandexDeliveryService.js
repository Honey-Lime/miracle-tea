import api from "./api";

/**
 * Получить список городов для доставки на следующий день
 */
export const getYandexCities = async () => {
  try {
    const response = await api.get("/yandex-delivery/cities");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch Yandex cities:", error);
    // Fallback cities
    return [
      { code: "MOS", name: "Москва" },
      { code: "SPB", name: "Санкт-Петербург" },
      { code: "VOR", name: "Воронеж" },
      { code: "EKB", name: "Екатеринбург" },
      { code: "NSK", name: "Новосибирск" },
      { code: "KZN", name: "Казань" },
    ];
  }
};

/**
 * Рассчитать стоимость доставки на следующий день
 * @param {string} toCity - город получения (название)
 * @param {number} weight - вес в граммах
 * @param {string} fromCity - город отправления (по умолчанию Воронеж)
 * @param {number} amount - стоимость заказа (для страховки)
 */
export const calculateYandexDelivery = async (
  toCity,
  weight,
  fromCity = "Воронеж",
  amount = 0,
) => {
  try {
    const response = await api.post("/yandex-delivery/calculate", {
      fromCity,
      toCity,
      weight,
      amount,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to calculate Yandex delivery:", error);
    throw error;
  }
};

/**
 * Проверить доступность доставки в город
 */
export const checkAvailability = async (city) => {
  try {
    const response = await api.get("/yandex-delivery/check", {
      params: { city },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to check availability:", error);
    return { available: false };
  }
};
