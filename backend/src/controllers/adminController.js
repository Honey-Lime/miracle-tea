const Order = require("../models/Order");
const Product = require("../models/Product");
const Tag = require("../models/Tag");
const User = require("../models/User");
const Review = require("../models/Review");
const {
  creditOrderBonuses,
  getBonusPercent,
  getReviewBonusAmount,
  refundOrderSpentBonuses,
  setBonusPercent,
  setReviewBonusAmount,
} = require("../services/bonusService");
const {
  getNotificationEmail,
  notifyAdmin,
  setNotificationEmail,
} = require("../services/adminNotificationService");
const { getLogFilePath, logError } = require("../utils/logger");
const path = require("path");
const fs = require("fs");

const PAID_TOTAL_STATUSES = ["paid", "assembled", "shipped", "completed"];

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function readLogTail(filePath, maxBytes = 200000) {
  if (!fs.existsSync(filePath)) {
    return { content: "", size: 0, hasMore: false };
  }

  const stats = fs.statSync(filePath);
  const start = Math.max(0, stats.size - maxBytes);
  const buffer = Buffer.alloc(stats.size - start);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buffer, 0, buffer.length, start);
  fs.closeSync(fd);
  return {
    content: buffer.toString("utf8"),
    size: stats.size,
    hasMore: start > 0,
  };
}

const restoreOrderRemains = async (order) => {
  if (!order.stockReserved) {
    return;
  }

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

  order.stockReserved = false;
  order.stockReservedAt = null;
  await order.save();
};

const reserveOrderRemains = async (order) => {
  if (order.stockReserved) {
    return;
  }

  const requestedByProduct = new Map();
  for (const item of order.list) {
    if (!item.pid || item.count <= 0) {
      continue;
    }

    const productId = item.pid.toString();
    requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + item.count);
  }

  for (const [productId, count] of requestedByProduct.entries()) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }
    if (product.remains < count) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
  }

  const operations = Array.from(requestedByProduct.entries()).map(([productId, count]) => ({
    updateOne: {
      filter: { _id: productId },
      update: { $inc: { remains: -count } },
    },
  }));

  if (operations.length > 0) {
    await Product.bulkWrite(operations);
  }

  order.stockReserved = true;
  order.stockReservedAt = new Date();
  await order.save();
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
    const maxBytes = Math.min(Number(req.query.maxBytes) || 200000, 5000000);
    const result = readLogTail(getLogFilePath(type), maxBytes);
    res.json({ type, ...result, maxBytes });
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

    const previousStatus = order.status;
    let updatedOrder;

    if (status === "paid" && previousStatus !== "paid") {
      await reserveOrderRemains(order);
    }

    if (["cancelled", "refunded"].includes(status) && !["shipped", "completed", "cancelled", "refunded"].includes(previousStatus)) {
      await restoreOrderRemains(order);
      await refundOrderSpentBonuses(order);
      await recalculateUserTotal(order.userId);
    }

    order.status = status;
    updatedOrder = await order.save();

    if (status === "completed" && previousStatus !== "completed") {
      await creditOrderBonuses(order);
      updatedOrder = await Order.findById(order._id)
        .populate("userId", "name email")
        .populate("list.pid", "name price unit");
    }
    res.json(updatedOrder);
  } catch (error) {
    logError(error, "updateOrderStatus");
    res.status(500).json({ message: error.message });
  }
};

exports.getBonusSettings = async (_req, res) => {
  try {
    const [bonusPercent, reviewBonusAmount, notificationEmail] = await Promise.all([
      getBonusPercent(),
      getReviewBonusAmount(),
      getNotificationEmail(),
    ]);
    res.json({ bonusPercent, reviewBonusAmount, notificationEmail });
  } catch (error) {
    logError(error, "getBonusSettings");
    res.status(500).json({ message: error.message });
  }
};

exports.updateBonusSettings = async (req, res) => {
  try {
    const [bonusPercent, reviewBonusAmount, notificationEmail] = await Promise.all([
      setBonusPercent(req.body.bonusPercent),
      setReviewBonusAmount(req.body.reviewBonusAmount),
      setNotificationEmail(req.body.notificationEmail),
    ]);
    res.json({ bonusPercent, reviewBonusAmount, notificationEmail });
  } catch (error) {
    logError(error, "updateBonusSettings");
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingReviews = async (_req, res) => {
  try {
    const reviews = await Review.find({ status: "pending" })
      .populate("userId", "name email")
      .populate("productId", "name")
      .sort({ createdAt: 1 });
    res.json(reviews.map((review) => ({ ...review.toObject(), type: "review" })));
  } catch (error) {
    logError(error, "getPendingReviews");
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminNotificationCounts = async (_req, res) => {
  try {
    const [pendingReviews, chats] = await Promise.all([
      Review.countDocuments({ status: "pending" }),
      require("../models/Chat").find({}).select("messages"),
    ]);
    const unreadChats = chats.reduce(
      (sum, chat) => sum + (chat.messages || []).filter((message) => message.sender === "user" && !message.readByAdmin).length,
      0,
    );
    res.json({ pendingReviews, unreadChats });
  } catch (error) {
    logError(error, "getAdminNotificationCounts");
    res.status(500).json({ message: error.message });
  }
};

exports.getApprovedReviews = async (_req, res) => {
  try {
    const reviews = await Review.find({ status: "approved" })
      .populate("userId", "name email")
      .populate("productId", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(reviews.map((review) => ({ ...review.toObject(), type: "review" })));
  } catch (error) {
    logError(error, "getApprovedReviews");
    res.status(500).json({ message: error.message });
  }
};

exports.approveReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    review.status = "approved";
    review.moderatedAt = new Date();

    if (!review.bonusCredited && review.bonusAmount > 0) {
      await User.updateOne({ _id: review.userId }, { $inc: { bonusBalance: review.bonusAmount } });
      review.bonusCredited = true;
    }

    await review.save();
    res.json(review);
  } catch (error) {
    logError(error, "approveReview");
    res.status(500).json({ message: error.message });
  }
};

exports.rejectReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    review.status = "rejected";
    review.moderatedAt = new Date();
    await review.save();

    res.json(review);
  } catch (error) {
    logError(error, "rejectReview");
    res.status(500).json({ message: error.message });
  }
};

exports.updateReviewAdminComment = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    const text = String(req.body.text || "").trim();
    const existingPhotos = Array.isArray(review.adminComment?.photos) ? review.adminComment.photos : [];
    const keptPhotoUrls = JSON.parse(req.body.keptPhotoUrls || "null");
    const keptPhotos = Array.isArray(keptPhotoUrls)
      ? existingPhotos.filter((photo) => keptPhotoUrls.includes(photo.url))
      : existingPhotos;
    const newPhotos = (req.files || []).map((file) => ({ url: `/uploads/chat/${file.filename}` }));
    const photos = req.body.clearPhotos === "true" ? newPhotos : [...keptPhotos, ...newPhotos];
    review.adminComment = {
      text,
      photos,
      updatedAt: text || photos.length > 0 ? new Date() : null,
      seenByUserAt: null,
    };

    await review.save();
    res.json(review);
  } catch (error) {
    logError(error, "updateReviewAdminComment");
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
    await refundOrderSpentBonuses(order);
    await recalculateUserTotal(order.userId);

    notifyAdmin("Отмена заказа", `Администратор отменил заказ №${order._id}`).catch(() => {});

    res.json(updatedOrder);
  } catch (error) {
    logError(error, "cancelOrder");
    res.status(500).json({ message: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const filter = query
      ? {
          $or: [
            { name: { $regex: escapeRegex(query), $options: "i" } },
            { email: { $regex: escapeRegex(query), $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(filter)
      .select("name email bonusBalance total isAdmin createdAt")
      .sort({ createdAt: -1 })
      .limit(100);
    const orderStats = await Order.aggregate([
      { $match: { userId: { $in: users.map((user) => user._id) }, status: { $nin: ["cart", "payment_pending"] } } },
      { $group: { _id: "$userId", ordersCount: { $sum: 1 }, ordersTotal: { $sum: "$totalPrice" } } },
    ]);
    const statsByUser = new Map(orderStats.map((stat) => [String(stat._id), stat]));

    res.json(
      users.map((user) => {
        const stats = statsByUser.get(String(user._id));
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          bonusBalance: user.bonusBalance || 0,
          total: user.total || 0,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          ordersCount: stats?.ordersCount || 0,
          ordersTotal: stats?.ordersTotal || 0,
        };
      }),
    );
  } catch (error) {
    logError(error, "getCustomers");
    res.status(500).json({ message: error.message });
  }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "Клиент не найден" });
    }

    const orders = await Order.find({ userId: user._id, status: { $nin: ["cart"] } })
      .populate("list.pid", "name price unit")
      .sort({ date: -1 })
      .limit(30);
    const completedOrders = await Order.find({ userId: user._id, status: { $in: PAID_TOTAL_STATUSES } })
      .populate("list.pid", "name unit")
      .lean();
    const reviews = await Review.find({ userId: user._id })
      .populate("productId", "name")
      .sort({ createdAt: -1 })
      .limit(50);

    const deliveryPhones = [];
    const deliveryPhoneSet = new Set();
    orders.forEach((order) => {
      const phone = String(order.delivery?.details?.phone || "").trim();
      if (!phone || deliveryPhoneSet.has(phone)) return;
      deliveryPhoneSet.add(phone);
      deliveryPhones.push({ phone, lastUsedAt: order.date, orderId: order._id });
    });

    const productStatsById = new Map();
    completedOrders.forEach((order) => {
      (order.list || []).forEach((item) => {
        if (!item.pid) return;
        const productId = String(item.pid._id || item.pid);
        const current = productStatsById.get(productId) || {
          productId,
          name: item.pid.name || "Товар",
          unit: item.pid.unit || "grams",
          totalCount: 0,
          orderIds: new Set(),
        };
        current.totalCount += Number(item.count) || 0;
        current.orderIds.add(String(order._id));
        productStatsById.set(productId, current);
      });
    });

    const productStats = Array.from(productStatsById.values())
      .map((stat) => ({
        productId: stat.productId,
        name: stat.name,
        unit: stat.unit,
        totalCount: stat.totalCount,
        ordersCount: stat.orderIds.size,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    res.json({
      customer: {
        id: user._id,
        name: user.name,
        email: user.email,
        bonusBalance: user.bonusBalance || 0,
        total: user.total || 0,
        isAdmin: user.isAdmin,
        delivery: user.delivery,
        consents: user.consents,
        createdAt: user.createdAt,
      },
      orders,
      reviews,
      deliveryPhones,
      productStats,
    });
  } catch (error) {
    logError(error, "getCustomerDetails");
    res.status(500).json({ message: error.message });
  }
};

exports.adjustCustomerBonuses = async (req, res) => {
  try {
    const amount = Math.floor(Number(req.body.amount));
    const operation = req.body.operation;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Укажите положительное количество бонусов" });
    }

    if (!["add", "subtract"].includes(operation)) {
      return res.status(400).json({ message: "Неверная операция с бонусами" });
    }

    const user = await User.findById(req.params.id).select("name email bonusBalance");
    if (!user) {
      return res.status(404).json({ message: "Клиент не найден" });
    }

    const currentBalance = Number(user.bonusBalance) || 0;
    if (operation === "subtract" && amount > currentBalance) {
      return res.status(400).json({ message: "На балансе клиента недостаточно бонусов" });
    }

    user.bonusBalance = operation === "add" ? currentBalance + amount : currentBalance - amount;
    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      bonusBalance: user.bonusBalance,
    });
  } catch (error) {
    logError(error, "adjustCustomerBonuses");
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
          productStats[productId].orders.add(String(order._id));
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
