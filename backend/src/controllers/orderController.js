const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Counter = require("../models/Counter");
const { logError } = require("../utils/logger");
const {
  calculateBonusEarned,
  creditOrderBonuses,
  getBonusPercent,
  refundOrderSpentBonuses,
} = require("../services/bonusService");
const { notifyAdmin } = require("../services/adminNotificationService");
const { getSamplerSizeGrams } = require("../services/samplerService");

const ID_COUNTER = "orderSequence";
const LETTERS_COUNT = 26;
const NUMBERS_COUNT = 100;
const PAID_TOTAL_STATUSES = ["paid", "assembled", "shipped", "completed"];

const formatLetters = (index) => {
  let length = 2;
  let offset = index;
  let capacity = LETTERS_COUNT ** length;

  while (offset >= capacity) {
    offset -= capacity;
    length += 1;
    capacity = LETTERS_COUNT ** length;
  }

  let letters = "";
  for (let position = 0; position < length; position += 1) {
    const divisor = LETTERS_COUNT ** (length - position - 1);
    const letterIndex = Math.floor(offset / divisor) % LETTERS_COUNT;
    letters += String.fromCharCode(65 + letterIndex);
  }

  return letters;
};

const formatId = (sequence) => {
  const letterIndex = Math.floor(sequence / NUMBERS_COUNT);
  const digits = String(sequence % NUMBERS_COUNT).padStart(2, "0");

  return `${formatLetters(letterIndex)}${digits}`;
};

const generateId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { _id: ID_COUNTER },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );

  return formatId(counter.seq - 1);
};

const saveCartState = async (cart) => {
  if (cart.isNew) {
    return cart.save();
  }

  await Order.updateOne(
    { _id: cart._id, userId: cart.userId, status: "cart" },
    {
      $set: {
        list: cart.list.map((item) => ({
          pid: item.pid,
          count: item.count,
          priceAtOrder: item.priceAtOrder,
          isSampler: item.isSampler,
        })),
        totalPrice: cart.totalPrice,
      },
    },
    { runValidators: true },
  );

  return Order.findById(cart._id);
};

const recalculateUserTotal = async (userId) => {
  if (!userId) {
    return 0;
  }

  const orders = await Order.find({
    userId,
    status: { $in: PAID_TOTAL_STATUSES },
  }).select("totalPrice");
  const total = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  await User.updateOne({ _id: userId }, { $set: { total } });
  return total;
};

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

// Create a new order
exports.createOrder = async (req, res) => {
  const { list, delivery, consents, bonuses, withoutPayment, withoutDeliveryPayment } = req.body;
  const customerType = req.userId ? "user" : "guest";

  try {
    if (!consents?.personalData || !consents?.refundPolicy) {
      return res.status(400).json({
        message: "Перед оформлением заказа нужно принять политику обработки данных и политику возврата средств",
      });
    }

    const user = req.userId
      ? await User.findById(req.userId).select("bonusBalance isAdmin delivery total")
      : null;
    const isWithoutPayment = Boolean(withoutPayment && user?.isAdmin);

    if (withoutPayment && !isWithoutPayment) {
      return res.status(403).json({ message: "Тестовый заказ доступен только администратору" });
    }

    // Validate products and calculate total
    let itemsTotal = 0;
    const requestedByProduct = new Map();
    for (const item of list) {
      const product = await Product.findById(item.pid);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${item.pid} not found` });
      }
      const productId = String(item.pid);
      const requestedCount = (requestedByProduct.get(productId) || 0) + item.count;
      requestedByProduct.set(productId, requestedCount);
      if (product.remains < requestedCount) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${product.name}` });
      }
      const unit = product.unit || "grams";
      const minCount = unit === "grams" ? 50 : 1;
      if (!item.isSampler && item.count < minCount) {
        return res
          .status(400)
          .json({ message: `Минимальное количество — ${minCount} ${unit === "grams" ? "г" : "шт"}` });
      }
      const itemPrice = (unit === "grams" ? product.price / 100 : product.price) * item.count;
      itemsTotal += itemPrice;
    }

    let bonusSpent = Math.floor(Number(bonuses?.spent) || 0);
    if (bonusSpent < 0) {
      bonusSpent = 0;
    }

    if (bonusSpent > 0) {
      if (!req.userId) {
        return res.status(400).json({ message: "Списывать бонусы могут только авторизованные пользователи" });
      }

      const bonusBalance = Number(user?.bonusBalance) || 0;
      const maxBonusSpent = Math.floor(itemsTotal * 0.5);

      if (bonusSpent > bonusBalance) {
        return res.status(400).json({ message: "Недостаточно бонусов для списания" });
      }

      if (bonusSpent > maxBonusSpent) {
        return res.status(400).json({ message: "Бонусами можно оплатить не более 50% стоимости товаров" });
      }

      await User.updateOne({ _id: req.userId }, { $inc: { bonusBalance: -bonusSpent } });
    }

    const bonusPercent = await getBonusPercent();
    const bonusEarned = req.userId ? calculateBonusEarned(itemsTotal, bonusPercent) : 0;
    const iswithoutDeliveryPayment = Boolean(withoutDeliveryPayment && user?.isAdmin);
    let totalPrice;
    if(iswithoutDeliveryPayment)
    {
      totalPrice = Math.max(0, itemsTotal - bonusSpent);
    } else 
    {
      totalPrice = Math.max(0, itemsTotal - bonusSpent) + (delivery.price || 0);
    }

    // Build list with priceAtOrder (price per gram)
    const listWithPrices = await Promise.all(
      list.map(async (item) => {
        const product = await Product.findById(item.pid);
        return {
          pid: item.pid,
          count: item.count,
          priceAtOrder: (product.unit || "grams") === "grams" ? product.price / 100 : product.price,
          isSampler: item.isSampler || false,
        };
      }),
    );

    const order = new Order({
      _id: await generateId(),
      userId: req.userId || null,
      customerType,
      list: listWithPrices,
      delivery,
      itemsTotal,
      bonuses: {
        spent: bonusSpent,
        earned: bonusEarned,
        percent: bonusPercent,
        credited: false,
      },
      consents: {
        personalData: true,
        refundPolicy: true,
        acceptedAt: consents.acceptedAt || new Date(),
      },
      totalPrice,
      status: isWithoutPayment ? "paid" : "payment_pending",
      payment: isWithoutPayment
        ? {
            paymentId: `test-${Date.now()}`,
            status: "test_paid",
            raw: { withoutPayment: true },
          }
        : undefined,
    });

    const savedOrder = await order.save();

    if (isWithoutPayment) {
      await reserveOrderRemains(order);
      user.delivery.last = order.delivery?.address || null;
      user.delivery.history.push({
        date: new Date(),
        order: order.id,
      });
      const paidOrders = await Order.find({
        userId: order.userId,
        status: { $in: PAID_TOTAL_STATUSES },
      }).select("totalPrice");
      user.total = paidOrders.reduce(
        (sum, paidOrder) => sum + (paidOrder.totalPrice || 0),
        0,
      );
      await user.save();
      await Order.updateOne(
        { userId: order.userId, status: "cart" },
        { $set: { list: [], totalPrice: 0 } },
      );
    }

    notifyAdmin(
      "Новый заказ",
      `Создан заказ №${savedOrder._id} на сумму ${savedOrder.totalPrice} ₽`,
    ).catch(() => {});

    res.status(201).json(savedOrder);
  } catch (error) {
    logError(error, "clearCart");
    res.status(500).json({ message: error.message });
  }
};

// Get cart for current user
exports.getCart = async (req, res) => {
  try {
    const cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    }).populate("list.pid");
    if (!cart) {
      return res.json({ list: [] });
    }
    res.json(cart);
  } catch (error) {
    logError(error, "removeFromCart");
    res.status(500).json({ message: error.message });
  }
};

// Add item to cart
exports.addToCart = async (req, res) => {
  const { pid, count, isSampler = false } = req.body;
  try {
    const product = await Product.findById(pid);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    // Validate stock
    if (product.remains < count) {
      return res.status(400).json({ message: "Insufficient stock" });
    }
    const unit = product.unit || "grams";
    const minCount = unit === "grams" ? 50 : 1;
    const priceAtOrder = unit === "grams" ? product.price / 100 : product.price;
    if (!isSampler && count < minCount) {
      return res
        .status(400)
        .json({ message: `Минимальное количество — ${minCount} ${unit === "grams" ? "г" : "шт"}` });
    }

    let cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    });

    if (!cart) {
      // Create new cart
      cart = new Order({
        _id: `cart:${req.userId}`,
        userId: req.userId,
        status: "cart",
        list: [],
        delivery: { address: null, price: 0, did: "" },
        totalPrice: 0,
      });
    }

    // Check if item already exists in cart with same isSampler
    const existingIndex = cart.list.findIndex(
      (item) => item.pid.toString() === pid && item.isSampler === isSampler,
    );

    const sameProductCurrentCount = cart.list
      .filter((item) => item.pid.toString() === pid)
      .reduce((sum, item) => sum + item.count, 0);
    const addedCount = existingIndex >= 0 && isSampler ? 0 : count;
    const sameProductCount = sameProductCurrentCount + addedCount;

    if (sameProductCount > product.remains) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    if (existingIndex >= 0) {
      // Если это пробник, запрещаем добавление ещё одного
      if (isSampler) {
        return res
          .status(400)
          .json({ message: "Пробник уже добавлен в корзину" });
      }
      // Update quantity for non-sampler
      cart.list[existingIndex].count += count;
      // Validate minimum quantity after update
      if (cart.list[existingIndex].count < minCount) {
        return res
          .status(400)
          .json({ message: `Минимальное количество — ${minCount} ${unit === "grams" ? "г" : "шт"}` });
      }
    } else {
      const samplerSizeGrams = await getSamplerSizeGrams();
      // Для пробника проверяем, что количество равно настройке размера пробника
      if (isSampler && count !== samplerSizeGrams) {
        return res.status(400).json({ message: `Пробник должен быть ${samplerSizeGrams} г` });
      }
      // Add new item
      cart.list.push({
        pid,
        count,
        priceAtOrder,
        isSampler,
      });
    }

    // Recalculate totalPrice
    cart.totalPrice = cart.list.reduce(
      (sum, item) => sum + item.priceAtOrder * item.count,
      0,
    );

    const savedCart = await saveCartState(cart);
    res.json(savedCart);
  } catch (error) {
    logError(error, "createOrder");
    res.status(500).json({ message: error.message });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  const { pid, isSampler } = req.body;
  try {
    const cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.list = cart.list.filter(
      (item) => !(item.pid.toString() === pid && item.isSampler === isSampler),
    );

    cart.totalPrice = cart.list.reduce(
      (sum, item) => sum + item.priceAtOrder * item.count,
      0,
    );

    const savedCart = await saveCartState(cart);
    res.json(savedCart);
  } catch (error) {
    logError(error, "addToCart");
    res.status(500).json({ message: error.message });
  }
};

// Update item quantity in cart
exports.updateCartItem = async (req, res) => {
  const { pid, isSampler, count } = req.body;
  try {
    const cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.list.find(
      (item) => item.pid.toString() === pid && item.isSampler === isSampler,
    );
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Для пробника запрещаем изменение количества (оно всегда должно соответствовать настройке)
    if (isSampler) {
      const samplerSizeGrams = await getSamplerSizeGrams();
      if (count !== samplerSizeGrams) {
        return res
          .status(400)
          .json({ message: "Количество пробника нельзя изменить" });
      }
      // Если count соответствует настройке, просто оставляем как есть (можно пропустить обновление)
      // Но если count <= 0, удаляем (пользователь может удалить пробник)
      if (count <= 0) {
        cart.list = cart.list.filter(
          (item) =>
            !(item.pid.toString() === pid && item.isSampler === isSampler),
        );
      }
      // В противном случае не меняем count
    } else {
      if (count <= 0) {
        // Remove item
        cart.list = cart.list.filter(
          (item) =>
            !(item.pid.toString() === pid && item.isSampler === isSampler),
        );
      } else {
        // Validate stock
        const product = await Product.findById(pid);
        const sameProductOtherCount = cart.list
          .filter((cartItem) => cartItem.pid.toString() === pid && cartItem.isSampler !== isSampler)
          .reduce((sum, cartItem) => sum + cartItem.count, 0);
        if (product.remains < count + sameProductOtherCount) {
          return res.status(400).json({ message: "Insufficient stock" });
        }
        const unit = product.unit || "grams";
        const minCount = unit === "grams" ? 50 : 1;
        if (count < minCount) {
          return res
            .status(400)
            .json({ message: `Минимальное количество — ${minCount} ${unit === "grams" ? "г" : "шт"}` });
        }
        item.count = count;
      }
    }

    cart.totalPrice = cart.list.reduce(
      (sum, item) => sum + item.priceAtOrder * item.count,
      0,
    );

    const savedCart = await saveCartState(cart);
    res.json(savedCart);
  } catch (error) {
    logError(error, "updateCartItem");
    res.status(500).json({ message: error.message });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    });
    if (!cart) {
      return res.json({ list: [], totalPrice: 0 });
    }
    cart.list = [];
    cart.totalPrice = 0;
    const savedCart = await saveCartState(cart);
    res.json(savedCart);
  } catch (error) {
    logError(error, "getCart");
    res.status(500).json({ message: error.message });
  }
};

// Get orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
      .populate("list.pid")
      .sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel user's order only after payment and before assembly.
exports.cancelUserOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!order) {
      return res.status(404).json({ message: "Заказ не найден" });
    }

    if (!["payment_pending", "created", "paid", "assembled"].includes(order.status)) {
      return res.status(400).json({ message: "Отменить можно только до отправки заказа" });
    }

    order.status = "cancelled";
    const updatedOrder = await order.save();
    await restoreOrderRemains(order);
    await refundOrderSpentBonuses(order);
    await recalculateUserTotal(req.userId);

    notifyAdmin("Отмена заказа", `Клиент отменил заказ №${order._id}`).catch(() => {});

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all orders (admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("list.pid")
      .populate("userId", "name email phone");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status (admin)
exports.updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    Object.assign(order, req.body);
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update order status specifically
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
      updatedOrder = await Order.findById(order._id);
    }
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete order (admin)
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // Restore product remains? (optional)
    await order.deleteOne();
    res.json({ message: "Order deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
