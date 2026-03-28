const User = require("../models/User");
const SmsCode = require("../models/SmsCode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendSms } = require("../services/smsService");

// Получаем список админских номеров из .env
const getAdminPhones = () => {
  const phonesStr = process.env.ADMIN_PHONES || "";
  return phonesStr
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

// Проверка, является ли номер админским
const isAdminPhone = (phone) => {
  const adminPhones = getAdminPhones();
  return adminPhones.includes(phone);
};

// Register new user or login if exists
exports.registerOrLogin = async (req, res) => {
  const { phone, password, name } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ phone });
    if (user) {
      // Login
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Обновляем права администратора, если номер добавлен в ADMIN_PHONES
      if (isAdminPhone(phone) && !user.isAdmin) {
        user.isAdmin = true;
        await user.save();
      }

      // Удаляем права администратора, если номер удалён из ADMIN_PHONES
      if (!isAdminPhone(phone) && user.isAdmin) {
        user.isAdmin = false;
        await user.save();
      }
    } else {
      // Register
      if (!name) {
        return res
          .status(400)
          .json({ message: "Name is required for registration" });
      }
      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: "Пароль должен быть не менее 6 символов" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        name,
        phone,
        password: hashedPassword,
        isAdmin: isAdminPhone(phone),
      });
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        total: user.total,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      total: user.total,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Неверный текущий пароль" });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Новый пароль должен быть не менее 6 символов" });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Forgot password - отправка кода подтверждения
exports.forgotPassword = async (req, res) => {
  const { phone } = req.body;

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Генерируем 6-значный код
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Сохраняем код в БД
    await SmsCode.create({
      phone,
      code,
      expiresAt,
      purpose: "password_reset",
    });

    // Отправляем SMS с кодом
    const smsResult = await sendSms(
      phone,
      `Код восстановления пароля: ${code}`,
    );

    // В режиме разработки возвращаем код в ответе, если SMS не отправлено
    if (process.env.NODE_ENV === "development" && !smsResult.success) {
      console.log(`[DEV MODE] Код подтверждения для ${phone}: ${code}`);
      return res.json({
        message: "Код подтверждения (режим разработки)",
        code: code,
        devMode: true,
      });
    }

    if (!smsResult.success) {
      return res
        .status(500)
        .json({ message: smsResult.error || "Ошибка отправки SMS" });
    }

    res.json({ message: "Код подтверждения отправлен в SMS" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reset password - установка нового пароля после проверки кода
exports.resetPassword = async (req, res) => {
  const { phone, code, newPassword } = req.body;

  try {
    // Проверяем пользователя
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Проверяем код
    const smsCode = await SmsCode.findOne({
      phone,
      code,
      purpose: "password_reset",
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!smsCode) {
      return res.status(400).json({ message: "Неверный код" });
    }

    if (smsCode.expiresAt < new Date()) {
      return res.status(400).json({ message: "Код истёк" });
    }

    // Валидация нового пароля
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Пароль должен быть не менее 6 символов" });
    }

    // Хэшируем и сохраняем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Помечаем код как использованный
    smsCode.isUsed = true;
    await smsCode.save();

    res.json({ message: "Пароль успешно изменён" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
