const Order = require("../models/Order");
const Product = require("../models/Product");
const Tag = require("../models/Tag");
const { logError } = require("../utils/logger");
const path = require("path");
const fs = require("fs");

// Get all orders with status except "cart"
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $ne: "cart" } })
      .populate("userId", "name phone")
      .populate("list.pid", "name price")
      .sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "ordered",
      "paid",
      "shipping",
      "completed",
      "cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Неверный статус заказа" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }

    order.status = status;
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    logError(error, "updateOrderStatus");
    res.status(500).json({ message: error.message });
  }
};

// Add new product
exports.addProduct = async (req, res) => {
  try {
    const { name, content, description, price, cost, remains, tags, images } =
      req.body;

    // Преобразуем images в правильный формат если это массив строк
    let formattedImages = images || [];
    if (
      Array.isArray(images) &&
      images.length > 0 &&
      typeof images[0] === "string"
    ) {
      formattedImages = images.map((url, index) => ({
        url,
        type: "image",
        order: index,
      }));
    }

    const product = new Product({
      name,
      content,
      description,
      price,
      cost,
      remains,
      tags: tags || [],
      images: formattedImages,
    });
    await product.save();
    res.status(201).json({ message: "Product added successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all products sorted by name
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search products by name
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }
    const products = await Product.find({
      name: { $regex: query, $options: "i" },
    }).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add stock to product (поставка)
exports.addStock = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    product.remains += quantity;
    await product.save();
    res.json({ message: "Stock added successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all unique tags from Tag collection
exports.getAllTags = async (req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });
    res.json(tags.map((t) => t.name));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new tag
exports.createTag = async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Название тега обязательно" });
    }
    const existingTag = await Tag.findOne({ name: name.trim() });
    if (existingTag) {
      return res.status(400).json({ message: "Тег уже существует" });
    }
    const tag = new Tag({ name: name.trim() });
    await tag.save();
    res.status(201).json(tag);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Add a new tag to a product
exports.addTagToProduct = async (req, res) => {
  const { productId, tag } = req.body;
  try {
    const trimmedTag = tag.trim();

    // Проверяем существует ли тег, если нет - создаем
    let tagDoc = await Tag.findOne({ name: trimmedTag });
    if (!tagDoc) {
      try {
        tagDoc = new Tag({ name: trimmedTag });
        await tagDoc.save();
      } catch (createError) {
        // Если тег уже был создан другим запросом (race condition)
        if (createError.code === 11000) {
          tagDoc = await Tag.findOne({ name: trimmedTag });
        } else {
          throw createError;
        }
      }
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    if (!product.tags.includes(trimmedTag)) {
      product.tags.push(trimmedTag);
      await product.save();
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove a tag from a product
exports.removeTagFromProduct = async (req, res) => {
  const { productId, tag } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    product.tags = product.tags.filter((t) => t !== tag);
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { name, content, description, price, cost, remains, tags, images } =
      req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }

    product.name = name || product.name;
    product.content = content || product.content;
    product.description = description || product.description;
    product.price = price !== undefined ? price : product.price;
    product.cost = cost !== undefined ? cost : product.cost;
    product.remains = remains !== undefined ? remains : product.remains;
    product.tags = tags || product.tags;
    product.images = images !== undefined ? images : product.images;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    res.json({ message: "Товар удален" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload product images/videos
exports.uploadProductMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Файлы не загружены" });
    }

    const files = req.files.map((file) => ({
      url: `/uploads/products/${file.filename}`,
      type: file.mimetype.startsWith("video/") ? "video" : "image",
      order: Date.now(), // Уникальный порядок для сортировки
    }));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reorder product images
exports.reorderProductImages = async (req, res) => {
  try {
    const { images } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }

    // images - массив с новым порядком
    product.images = images.map((img, index) => ({
      ...img,
      order: index,
    }));

    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete product image
exports.deleteProductImage = async (req, res) => {
  try {
    const { imageIndex } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }

    if (!product.images[imageIndex]) {
      return res.status(404).json({ message: "Изображение не найдено" });
    }

    // Удаляем файл с диска
    const imagePath = path.join(
      __dirname,
      "../../",
      product.images[imageIndex].url,
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Удаляем из массива
    product.images.splice(imageIndex, 1);
    await product.save();

    res.json({ message: "Изображение удалено", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
