const delivery = require("../services/delivery");
const { logError } = require("../utils/logger");

// Справочник доступных покупателю служб доставки.
exports.getState = async (req, res) => {
  try {
    res.json(await delivery.getState());
  } catch (error) {
    logError(error, "delivery.getState", req);
    res.status(500).json({ message: "Не удалось загрузить службы доставки" });
  }
};

// Расчёт стоимости, сроков и списка ПВЗ одной службы для города или адреса.
exports.calculate = async (req, res) => {
  const { service, to, address, weight, lat, lon, recalculation } = req.body || {};

  if (!service || (!to && !address)) {
    return res.status(400).json({ message: "Не указаны служба доставки или адрес" });
  }

  try {
    if (!(await delivery.isServiceAvailable(service))) {
      return res.status(404).json({ message: "Служба доставки недоступна" });
    }

    res.json(await delivery.calculate(service, { to, address, weight, lat, lon, recalculation }));
  } catch (error) {
    logError(error, `delivery.calculate:${service} ${JSON.stringify(error.body || {})}`, req);
    res.status(502).json({ message: "Не удалось рассчитать доставку" });
  }
};

// IP покупателя для определения города: за Caddy и nginx первый адрес в
// X-Forwarded-For — клиентский (Caddy подставляет его сам). Сторонние сервисы
// вроде ipify часто режут блокировщики рекламы, поэтому IP отдаём сами.
exports.getClientIp = (req, res) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = (forwarded || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  res.json({ ip });
};
