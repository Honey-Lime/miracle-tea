const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./src/models/Product");

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Добавляем поле tags ко всем продуктам, если его нет
    const result = await Product.updateMany(
      { tags: { $exists: false } },
      { $set: { tags: [] } },
    );

    console.log(
      `Updated ${result.modifiedCount} products with empty tags array`,
    );

    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

migrate();
