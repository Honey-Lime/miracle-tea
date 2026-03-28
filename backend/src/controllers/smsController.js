const SmsCode = require("../models/SmsCode");
const { sendSms, generateCode } = require("../services/smsService");
const { logError } = require("../utils/logger");

// Отправка кода подтверждения
exports.sendCode = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Номер телефона обязателен" });
  }

  try {
    // Проверяем, есть ли активный код для этого номера
    const existingCode = await SmsCode.findOne({
      phone,
      purpose: "registration",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingCode) {
      // Если код есть, не отправляем новый сразу
      return res.json({
        message: "Код уже отправлен",
        canResendAt: new Date(
          existingCode.createdAt.getTime() + 60000,
        ).toISOString(), // Через 1 минуту
      });
    }

    // Генерируем новый код
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Сохраняем код
    await SmsCode.create({
      phone,
      code,
      expiresAt,
      purpose: "registration",
    });

    // Отправляем SMS
    const message = `Ваш код подтверждения: ${code}`;
    const smsResult = await sendSms(phone, message);

    if (!smsResult.success) {
      // В продакшене можно логировать, но пользователю не показываем
      console.error("SMS не отправлено:", smsResult.error);
    }

    // Для тестирования возвращаем код в ответе (удалить в продакшене!)
    res.json({
      message: "Код отправлен",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (error) {
    logError(error, "sendCode");
    res.status(500).json({ message: "Ошибка при отправке кода" });
  }
};

// Проверка кода подтверждения
exports.verifyCode = async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res
      .status(400)
      .json({ message: "Номер телефона и код обязательны" });
  }

  try {
    const smsCode = await SmsCode.findOne({
      phone,
      code,
      purpose: "registration",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!smsCode) {
      return res.status(400).json({ message: "Неверный или истёкший код" });
    }

    // Помечаем код как использованный
    smsCode.isUsed = true;
    await smsCode.save();

    res.json({ message: "Код подтверждён", phone });
  } catch (error) {
    logError(error, "verifyCode");
    res.status(500).json({ message: "Ошибка при проверке кода" });
  }
};
