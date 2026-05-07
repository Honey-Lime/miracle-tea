const VerificationCode = require("../models/VerificationCode");
const {
  generateCode,
  sendVerificationEmail,
} = require("../services/emailService");
const { logError } = require("../utils/logger");

const normalizeEmail = (email = "") => email.trim().toLowerCase();

exports.sendCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  try {
    const existingCode = await VerificationCode.findOne({
      email,
      purpose: "registration",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingCode) {
      return res.json({
        message: "Код уже отправлен",
        canResendAt: new Date(
          existingCode.createdAt.getTime() + 60000,
        ).toISOString(),
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await VerificationCode.create({
      email,
      code,
      expiresAt,
      purpose: "registration",
    });

    const emailResult = await sendVerificationEmail(email, code, "registration");

    if (!emailResult.success) {
      console.error(`[emailController] Email не отправлен на ${email}: ${emailResult.error}`);
      return res
        .status(500)
        .json({ message: emailResult.error || "Ошибка отправки письма" });
    }

    console.log(`[emailController] Код регистрации отправлен на ${email}`);

    res.json({
      message: "Код отправлен",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (error) {
    logError(error, "sendCode");
    res.status(500).json({ message: "Ошибка при отправке кода" });
  }
};

exports.verifyCode = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "Email и код обязательны" });
  }

  try {
    const emailCode = await VerificationCode.findOne({
      email,
      code,
      purpose: "registration",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!emailCode) {
      return res.status(400).json({ message: "Неверный или истёкший код" });
    }

    emailCode.isUsed = true;
    await emailCode.save();

    res.json({ message: "Код подтверждён", email });
  } catch (error) {
    logError(error, "verifyCode");
    res.status(500).json({ message: "Ошибка при проверке кода" });
  }
};
