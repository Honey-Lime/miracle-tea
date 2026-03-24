const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./src/models/Product");

const products = [
  {
    name: "Черный чай",
    content: ["чайные листья", "аромат бергамота"],
    description:
      "Классический черный чай с насыщенным вкусом и ароматом. Идеально подходит для утреннего пробуждения.",
    price: 350,
    cost: 200,
    remains: 1000,
  },
  {
    name: "Зеленый чай",
    content: ["зеленые чайные листья", "антиоксиданты"],
    description:
      "Свежий зеленый чай с легкой терпкостью и полезными свойствами. Отлично утоляет жажду.",
    price: 400,
    cost: 250,
    remains: 800,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Очистка коллекции (опционально)
    await Product.deleteMany({});
    console.log("Cleared existing products");

    // Вставка новых продуктов
    await Product.insertMany(products);
    console.log("Added products:", products.map((p) => p.name).join(", "));

    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
