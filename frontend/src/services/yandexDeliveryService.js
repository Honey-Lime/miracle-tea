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
    // Fallback cities - расширенный список
    return [
      { code: "VOR", name: "Воронеж" },
      { code: "MOS", name: "Москва" },
      { code: "SPB", name: "Санкт-Петербург" },
      { code: "EKB", name: "Екатеринбург" },
      { code: "NSK", name: "Новосибирск" },
      { code: "KZN", name: "Казань" },
      { code: "NNG", name: "Нижний Новгород" },
      { code: "SMR", name: "Самара" },
      { code: "ROV", name: "Ростов-на-Дону" },
      { code: "UFA", name: "Уфа" },
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

/**
 * Поиск городов по названию (Яндекс Карты Suggest API)
 * @param {string} query - поисковый запрос
 */
export const searchYandexCities = async (query) => {
  try {
    const response = await api.get("/yandex-delivery/search-cities", {
      params: { query },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to search cities:", error);
    // Fallback - локальный поиск
    if (query && query.length >= 2) {
      const fallbackCities = [
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
        "Воронеж",
        "Пермь",
        "Волгоград",
        "Краснодар",
        "Саратов",
      ];
      return fallbackCities
        .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
        .map((name) => ({ code: name.substring(0, 3).toUpperCase(), name }));
    }
    return [];
  }
};
