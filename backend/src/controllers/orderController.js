const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { logError } = require("../utils/logger");

// Create a new order
exports.createOrder = async (req, res) => {
  const { list, delivery } = req.body;

  try {
    // Validate products and calculate total
    let totalPrice = 0;
    for (const item of list) {
      const product = await Product.findById(item.pid);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${item.pid} not found` });
      }
      if (product.remains < item.count) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${product.name}` });
      }
      if (!item.isSampler && item.count < 50) {
        return res
          .status(400)
          .json({ message: "Минимальное количество для чая — 50 г" });
      }
      // Price per gram (price in DB is per 100g)
      const itemPrice = (product.price / 100) * item.count;
      totalPrice += itemPrice;
      // Update remains
      product.remains -= item.count;
      await product.save();
    }

    // Add delivery cost
    totalPrice += delivery.price || 0;

    // Build list with priceAtOrder (price per gram)
    const listWithPrices = await Promise.all(
      list.map(async (item) => {
        const product = await Product.findById(item.pid);
        return {
          pid: item.pid,
          count: item.count,
          priceAtOrder: product.price / 100,
          isSampler: item.isSampler || false,
        };
      }),
    );

    const order = new Order({
      userId: req.userId || null,
      list: listWithPrices,
      delivery,
      totalPrice,
      status: "ordered",
    });

    const savedOrder = await order.save();

    // Update user's total and delivery history if logged in
    if (req.userId) {
      const user = await User.findById(req.userId);
      if (user) {
        user.total += totalPrice;
        user.delivery.last = delivery.address;
        user.delivery.history.push({
          date: new Date(),
          order: savedOrder._id,
        });
        await user.save();
      }
    }

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
    // Validate minimum quantity for non-sampler (50g)
    if (!isSampler && count < 50) {
      return res
        .status(400)
        .json({ message: "Минимальное количество для чая — 50 г" });
    }

    let cart = await Order.findOne({
      userId: req.userId,
      status: "cart",
    });

    if (!cart) {
      // Create new cart
      cart = new Order({
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
      if (cart.list[existingIndex].count < 50) {
        return res
          .status(400)
          .json({ message: "Минимальное количество для чая — 50 г" });
      }
      // Ensure not exceeding stock (optional)
    } else {
      // Для пробника проверяем, что количество равно 10 г
      if (isSampler && count !== 10) {
        return res.status(400).json({ message: "Пробник должен быть 10 г" });
      }
      // Add new item
      cart.list.push({
        pid,
        count,
        priceAtOrder: product.price / 100,
        isSampler,
      });
    }

    // Recalculate totalPrice
    cart.totalPrice = cart.list.reduce(
      (sum, item) => sum + item.priceAtOrder * item.count,
      0,
    );

    await cart.save();
    res.json(cart);
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

    await cart.save();
    res.json(cart);
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

    // Для пробника запрещаем изменение количества (оно всегда должно быть 10 г)
    if (isSampler) {
      if (count !== 10) {
        return res
          .status(400)
          .json({ message: "Количество пробника нельзя изменить" });
      }
      // Если count == 10, просто оставляем как есть (можно пропустить обновление)
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
        if (product.remains < count) {
          return res.status(400).json({ message: "Insufficient stock" });
        }
        // Validate minimum quantity for non-sampler (50g)
        if (count < 50) {
          return res
            .status(400)
            .json({ message: "Минимальное количество для чая — 50 г" });
        }
        item.count = count;
      }
    }

    cart.totalPrice = cart.list.reduce(
      (sum, item) => sum + item.priceAtOrder * item.count,
      0,
    );

    await cart.save();
    res.json(cart);
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
      return res.status(404).json({ message: "Cart not found" });
    }
    cart.list = [];
    cart.totalPrice = 0;
    await cart.save();
    res.json(cart);
  } catch (error) {
    logError(error, "getCart");
    res.status(500).json({ message: error.message });
  }
};

// Get orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).populate(
      "list.pid",
    );
    res.json(orders);
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
