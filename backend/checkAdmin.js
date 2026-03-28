const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Читаем .env вручную
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const adminPhonesLine = envContent
  .split("\n")
  .find((line) => line.startsWith("ADMIN_PHONES="));
const ADMIN_PHONES = adminPhonesLine
  ? adminPhonesLine
      .split("=")[1]
      .trim()
      .split(",")
      .filter((p) => p.length > 0)
  : [];

console.log("Админские номера из .env:", ADMIN_PHONES);

const User = require("./src/models/User");

async function checkAndUpdateAdmins() {
  try {
    const mongoUri = envContent
      .split("\n")
      .find((line) => line.startsWith("MONGODB_URI="));
    const MONGODB_URI = mongoUri ? mongoUri.split("=")[1].trim() : "";

    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB подключена");

    // Находим всех пользователей с админскими номерами
    const users = await User.find({ phone: { $in: ADMIN_PHONES } });
    console.log("\nНайдено пользователей с админскими номерами:", users.length);

    users.forEach((user) => {
      console.log(`\nПользователь: ${user.name}`);
      console.log(`  Телефон: ${user.phone}`);
      console.log(`  isAdmin: ${user.isAdmin}`);
    });

    // Обновляем права для всех пользователей с админскими номерами
    const updateResult = await User.updateMany(
      { phone: { $in: ADMIN_PHONES }, isAdmin: false },
      { $set: { isAdmin: true } },
    );
    console.log(`\nОбновлено пользователей: ${updateResult.modifiedCount}`);

    // Показываем всех админов в базе
    const allAdmins = await User.find({ isAdmin: true });
    console.log("\nВсе админы в базе данных:");
    allAdmins.forEach((admin) => {
      console.log(`  ${admin.name} - ${admin.phone}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Ошибка:", error);
    process.exit(1);
  }
}

checkAndUpdateAdmins();
