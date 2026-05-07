const User = require("../models/User");
const VerificationCode = require("../models/VerificationCode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  generateCode,
  sendVerificationEmail,
} = require("../services/emailService");

const getAdminEmails = () => {
  const emailsStr = process.env.ADMIN_EMAILS || "";
  return emailsStr
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
};

const isAdminUser = (email) => {
  if (email && getAdminEmails().includes(email.toLowerCase())) {
    return true;
  }

  return false;
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeName = (name = "") => name.trim();

const getAuthErrorResponse = (error) => {
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error.keyPattern || error.keyValue || {})[0];

    if (duplicatedField === "email") {
      return {
        status: 400,
        message:
          "Пользователь с таким email уже существует. Войдите в аккаунт.",
      };
    }

    if (duplicatedField === "phone") {
      return {
        status: 400,
        message:
          "Не удалось сохранить номер телефона. Попробуйте снова или оставьте поле пустым.",
      };
    }

    return {
      status: 400,
      message: "Пользователь с такими данными уже существует.",
    };
  }

  if (error?.name === "ValidationError") {
    const firstMessage = Object.values(error.errors || {})[0]?.message;

    return {
      status: 400,
      message: firstMessage || "Проверьте корректность введённых данных.",
    };
  }

  return {
    status: 500,
    message: "Внутренняя ошибка сервера. Попробуйте ещё раз позже.",
  };
};

const buildAuthResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  total: user.total,
  isAdmin: user.isAdmin,
});

const createAuthToken = (user) =>
  jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Введите корректный email" });
  }

  if (!password) {
    return res.status(400).json({ message: "Пароль обязателен" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Пользователь не найден. Зарегистрируйтесь." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Неверный email или пароль" });
    }

    const shouldBeAdmin = isAdminUser(user.email);
    if (user.isAdmin !== shouldBeAdmin) {
      user.isAdmin = shouldBeAdmin;
      await user.save();
    }

    const token = createAuthToken(user);

    res.json({
      token,
      user: buildAuthResponse(user),
    });
  } catch (error) {
    const { status, message } = getAuthErrorResponse(error);
    res.status(status).json({ message });
  }
};

exports.register = async (req, res) => {
  const { email, password, name } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);

  if (!normalizedEmail) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Введите корректный email" });
  }

  if (!normalizedName) {
    return res.status(400).json({ message: "Имя обязательно для регистрации" });
  }

  if (!password) {
    return res.status(400).json({ message: "Пароль обязателен" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Пароль должен быть не менее 6 символов" });
  }

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        message: "Пользователь с таким email уже существует. Войдите в аккаунт.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      isAdmin: isAdminUser(normalizedEmail),
    });
    await user.save();

    const token = createAuthToken(user);

    res.json({
      token,
      user: buildAuthResponse(user),
    });
  } catch (error) {
    const { status, message } = getAuthErrorResponse(error);
    res.status(status).json({ message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Неверный текущий пароль" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Новый пароль должен быть не менее 6 символов" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body.email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await VerificationCode.create({
      email: normalizedEmail,
      code,
      expiresAt,
      purpose: "password_reset",
    });

    const emailResult = await sendVerificationEmail(
      normalizedEmail,
      code,
      "password_reset",
    );

    if (process.env.NODE_ENV === "development" && !emailResult.success) {
      console.log(`[DEV MODE] Код подтверждения для ${normalizedEmail}: ${code}`);
      return res.json({
        message: "Код подтверждения (режим разработки)",
        code,
        devMode: true,
      });
    }

    if (!emailResult.success) {
      return res
        .status(500)
        .json({ message: emailResult.error || "Ошибка отправки email" });
    }

    console.log(
      `[authController] Код восстановления пароля отправлен на ${normalizedEmail}`,
    );

    res.json({ message: "Код подтверждения отправлен на email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { code, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(req.body.email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: "Email обязателен" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const emailCode = await VerificationCode.findOne({
      email: normalizedEmail,
      code,
      purpose: "password_reset",
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!emailCode) {
      return res.status(400).json({ message: "Неверный код" });
    }

    if (emailCode.expiresAt < new Date()) {
      return res.status(400).json({ message: "Код истёк" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Пароль должен быть не менее 6 символов" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    emailCode.isUsed = true;
    await emailCode.save();

    res.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
