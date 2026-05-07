const crypto = require("crypto");

const createTransporter = async () => {
  let nodemailer;

  try {
    nodemailer = require("nodemailer");
  } catch (error) {
    console.error("[emailService] Пакет nodemailer не установлен");
    return null;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.error("[emailService] SMTP_HOST / SMTP_USER / SMTP_PASS не настроены");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

exports.generateCode = () => crypto.randomInt(100000, 999999).toString();

exports.sendVerificationEmail = async (email, code, purpose = "registration") => {
  const transporter = await createTransporter();
  const appName = process.env.EMAIL_FROM_NAME || "Miracle Tea";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;

  const subjects = {
    registration: "Подтверждение регистрации",
    password_reset: "Восстановление пароля",
  };

  const texts = {
    registration: `Ваш код подтверждения регистрации: ${code}`,
    password_reset: `Ваш код восстановления пароля: ${code}`,
  };

  if (!transporter || !fromAddress) {
    if (process.env.NODE_ENV === "development") {
      console.log(`\n[emailService] DEV MODE: Код для ${email}: ${code}\n`);
    }

    return {
      success: false,
      error: "Email-сервис не настроен",
    };
  }

  try {
    console.log(
      `[emailService] Отправка письма на ${email}, purpose=${purpose}, from=${fromAddress}`,
    );

    await transporter.sendMail({
      from: `${appName} <${fromAddress}>`,
      to: email,
      subject: subjects[purpose] || subjects.registration,
      text: texts[purpose] || texts.registration,
    });

    console.log(`[emailService] Письмо успешно отправлено на ${email}`);

    return { success: true };
  } catch (error) {
    console.error(
      `[emailService] Ошибка отправки письма на ${email}: ${error.message}`,
    );

    if (process.env.NODE_ENV === "development") {
      console.log(`\n[emailService] DEV MODE: Код для ${email}: ${code}\n`);
    }

    return {
      success: false,
      error: error.message || "Ошибка отправки email",
    };
  }
};
