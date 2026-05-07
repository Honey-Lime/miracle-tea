const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Читаем .env вручную
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const adminEmailsLine = envContent
  .split("\n")
  .find((line) => line.startsWith("ADMIN_EMAILS="));
const ADMIN_EMAILS = adminEmailsLine
  ? adminEmailsLine
      .split("=")[1]
      .trim()
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
  : [];

console.log("Админские email из .env:", ADMIN_EMAILS);

const User = require("./src/models/User");

async function checkAndUpdateAdmins() {
  try {
    const mongoUri = envContent
      .split("\n")
      .find((line) => line.startsWith("MONGODB_URI="));
    const MONGODB_URI = mongoUri ? mongoUri.split("=")[1].trim() : "";

    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB подключена");

    // Находим всех пользователей с админскими email
    const users = await User.find({ email: { $in: ADMIN_EMAILS } });
    console.log("\nНайдено пользователей с админскими email:", users.length);

    users.forEach((user) => {
      console.log(`\nПользователь: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  isAdmin: ${user.isAdmin}`);
    });

    // Обновляем права для всех пользователей с админскими email
    const updateResult = await User.updateMany(
      { email: { $in: ADMIN_EMAILS }, isAdmin: false },
      { $set: { isAdmin: true } },
    );
    console.log(`\nОбновлено пользователей: ${updateResult.modifiedCount}`);

    // Показываем всех админов в базе
    const allAdmins = await User.find({ isAdmin: true });
    console.log("\nВсе админы в базе данных:");
    allAdmins.forEach((admin) => {
      console.log(`  ${admin.name} - ${admin.email}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Ошибка:", error);
    process.exit(1);
  }
}

checkAndUpdateAdmins();
