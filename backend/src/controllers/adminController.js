const Order = require("../models/Order");
const Product = require("../models/Product");
const Tag = require("../models/Tag");
const User = require("../models/User");
const { getLogFilePath, logError } = require("../utils/logger");
const path = require("path");
const fs = require("fs");

const PAID_TOTAL_STATUSES = ["paid", "assembled", "shipped", "completed"];

function readLogTail(filePath, maxBytes = 200000) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const stats = fs.statSync(filePath);
  const start = Math.max(0, stats.size - maxBytes);
  const buffer = Buffer.alloc(stats.size - start);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buffer, 0, buffer.length, start);
  fs.closeSync(fd);
  return buffer.toString("utf8");
}

const restoreOrderRemains = async (order) => {
  const operations = order.list
    .filter((item) => item.pid && item.count > 0)
    .map((item) => ({
      updateOne: {
        filter: { _id: item.pid },
        update: { $inc: { remains: item.count } },
      },
    }));

  if (operations.length > 0) {
    await Product.bulkWrite(operations);
  }
};

const recalculateUserTotal = async (userId) => {
  if (!userId) {
    return;
  }

  const orders = await Order.find({
    userId,
    status: { $in: PAID_TOTAL_STATUSES },
  }).select("totalPrice");
  const total = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  await User.updateOne({ _id: userId }, { $set: { total } });
};

exports.getLogs = async (req, res) => {
  try {
    const type = req.query.type === "errors" ? "errors" : "app";
    const content = readLogTail(getLogFilePath(type));
    res.json({ type, content });
  } catch (error) {
    logError(error, "getLogs", req);
    res.status(500).json({ message: error.message });
  }
};

// Get all orders with status except "cart"
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({ status: { $nin: ["cart", "payment_pending"] } })
      .populate("userId", "name email phone")
      .populate("list.pid", "name price unit")
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
      "created",
      "paid",
      "assembled",
      "shipped",
      "completed",
      "cancelled",
      "refunded",
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

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }

    if (["cancelled", "refunded"].includes(order.status)) {
      return res.status(400).json({ message: "Заказ уже отменен" });
    }

    order.status = "cancelled";
    const updatedOrder = await order.save();
    await restoreOrderRemains(order);
    await recalculateUserTotal(order.userId);

    res.json(updatedOrder);
  } catch (error) {
    logError(error, "cancelOrder");
    res.status(500).json({ message: error.message });
  }
};

// Add new product
exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, unit, cost, remains, tags, images } =
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
      description,
      price,
      unit: unit || "grams",
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

// Delete a tag globally (from Tag collection and all products)
exports.deleteTag = async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Название тега обязательно" });
    }
    const trimmedName = name.trim();
    // Удаляем из коллекции Tag
    await Tag.deleteOne({ name: trimmedName });
    // Удаляем из всех продуктов
    await Product.updateMany(
      { tags: trimmedName },
      { $pull: { tags: trimmedName } },
    );
    res.json({ message: "Тег удален" });
  } catch (error) {
    logError(error, "deleteTag");
    res.status(500).json({ message: error.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, unit, cost, remains, tags, images } =
      req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price !== undefined ? price : product.price;
    product.unit = unit || product.unit;
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

// Get statistics: average order value and per-product stats
exports.getStatistics = async (req, res) => {
  try {
    // Only paid orders that were not cancelled/refunded should affect statistics.
    const orders = await Order.find({ status: { $in: PAID_TOTAL_STATUSES } })
      .populate("list.pid", "name price")
      .lean();

    // Average order value
    const totalOrders = orders.length;
    const totalSum = orders.reduce(
      (sum, order) => sum + (order.totalPrice || 0),
      0,
    );
    const averageOrderValue = totalOrders > 0 ? totalSum / totalOrders : 0;

    // Per-product statistics
    const productStats = {};

    for (const order of orders) {
      for (const item of order.list) {
        if (!item.pid) continue;

        const productId = item.pid._id.toString();
        const productName = item.pid.name;

        if (!productStats[productId]) {
          productStats[productId] = {
            _id: productId,
            name: productName,
            totalGrams: 0,
            orders: new Set(),
            totalGramsExclSamplers: 0,
            samplerGrams: 0,
          };
        }

        const count = item.count || 0;
        productStats[productId].totalGrams += count;

        if (item.isSampler) {
          productStats[productId].samplerGrams += count;
        } else {
          productStats[productId].orders.add(order.id);
          productStats[productId].totalGramsExclSamplers += count;
        }
      }
    }

    // Calculate average order size (excluding samplers)
    const productStatsArray = Object.values(productStats).map((stat) => ({
      _id: stat._id,
      name: stat.name,
      totalGrams: stat.totalGrams,
      orderCount: stat.orders.size,
      totalGramsExclSamplers: stat.totalGramsExclSamplers,
      samplerCount: stat.samplerGrams,
      avgOrderSize:
        stat.orders.size > 0
          ? stat.totalGramsExclSamplers / stat.orders.size
          : 0,
    }));

    // Sort by total grams (descending)
    productStatsArray.sort((a, b) => b.totalGrams - a.totalGrams);

    res.json({
      averageOrderValue,
      totalOrders,
      totalSum,
      productStats: productStatsArray,
    });
  } catch (error) {
    logError(error, "getStatistics");
    res.status(500).json({ message: error.message });
  }
};
