const {
  calculateNextDayDelivery,
  getAvailableCities,
  searchCities,
} = require("../services/yandexDeliveryService");
const { logError } = require("../utils/logger");

/**
 * Расчет стоимости доставки на следующий день
 */
exports.calculateDelivery = async (req, res) => {
  const { fromCity, toCity, weight, amount } = req.body;

  if (!toCity || !weight) {
    return res.status(400).json({
      message:
        "Необходимы параметры toCity (город получения) и weight (вес в граммах)",
    });
  }

  try {
    const result = await calculateNextDayDelivery({
      fromCity: fromCity || "Воронеж",
      toCity,
      weight: Number(weight),
      amount: amount ? Number(amount) : 0,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logError(error, "calculateDelivery");
    res.status(500).json({
      success: false,
      message: "Ошибка при расчете доставки",
      error: error.message,
    });
  }
};

/**
 * Получение списка городов, доступных для доставки на следующий день
 */
exports.getCities = async (req, res) => {
  try {
    const cities = await getAvailableCities();
    res.json(cities);
  } catch (error) {
    logError(error, "getCities");
    res.status(500).json({
      success: false,
      message: "Ошибка при получении списка городов",
    });
  }
};

/**
 * Проверка доступности доставки в указанный город
 */
exports.checkAvailability = async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({
      message: "Необходим параметр city (название города)",
    });
  }

  try {
    const cities = await getAvailableCities();
    const available = cities.some(
      (c) => c.name.toLowerCase() === city.toLowerCase(),
    );

    res.json({
      city,
      available,
      service: "Yandex Next Day Delivery",
    });
  } catch (error) {
    logError(error, "checkAvailability");
    res.status(500).json({
      success: false,
      message: "Ошибка при проверке доступности",
    });
  }
};

/**
 * Поиск городов по названию (Яндекс Карты Suggest API)
 */
exports.searchCitiesEndpoint = async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(400).json({
      message: "Параметр query должен содержать минимум 2 символа",
    });
  }

  try {
    const cities = await searchCities(query);
    res.json(cities);
  } catch (error) {
    logError(error, "searchCitiesEndpoint");
    res.status(500).json({
      success: false,
      message: "Ошибка при поиске городов",
      error: error.message,
    });
  }
};
