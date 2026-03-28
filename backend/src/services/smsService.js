const https = require("https");

// API ключ SMS.ru (добавьте SMS_API_KEY в .env)
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_NAME = process.env.SMS_SENDER_NAME || "MiracleTea";

/**
 * Отправляет SMS через SMS.ru
 * @param {string} phone - Номер телефона (например, 79991234567)
 * @param {string} message - Текст сообщения
 * @returns {Promise<{success: boolean, error?: string}>}
 */
exports.sendSms = async (phone, message) => {
  if (!SMS_API_KEY) {
    const errorMsg = "SMS_API_KEY не настроен";
    console.error(`[smsService] ${errorMsg}`);
    return {
      success: false,
      error: "SMS-сервис не настроен. Обратитесь к администратору.",
    };
  }

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      api_key: SMS_API_KEY,
      to: phone,
      msg: message,
      from: SMS_SENDER_NAME,
      json: 1,
    });

    const options = {
      hostname: "sms.ru",
      path: `/sms/send?${params.toString()}`,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          console.log(`[smsService] Сырой ответ от sms.ru:`, data);
          const response = JSON.parse(data);
          console.log(`[smsService] Распарсенный ответ:`, response);
          if (response.status === "OK") {
            resolve({ success: true });
          } else {
            const errorMsg =
              response.status_description ||
              response.status ||
              "Ошибка отправки SMS";
            console.error(`[smsService] ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
          }
        } catch (parseError) {
          console.error(`[smsService] Ошибка парсинга ответа:`, parseError);
          console.error(`[smsService] Сырые данные:`, data);
          resolve({
            success: false,
            error: "Ошибка обработки ответа SMS-сервиса",
          });
        }
      });
    });

    req.on("error", (error) => {
      console.error(`[smsService] Ошибка соединения:`, error.message);
      // В режиме разработки выводим код в консоль
      if (process.env.NODE_ENV === "development") {
        console.log(`\n[smsService] DEV MODE: Код для ${phone}: ${message}\n`);
      }
      resolve({ success: false, error: "Ошибка соединения с SMS-сервисом" });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        success: false,
        error: "Превышено время ожидания SMS-сервиса",
      });
    });

    req.end();
  });
};

/**
 * Генерирует случайный код подтверждения
 * @param {number} length - Длина кода (по умолчанию 6)
 * @returns {string}
 */
exports.generateCode = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
