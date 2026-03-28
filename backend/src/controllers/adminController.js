const Order = require("../models/Order");
const Product = require("../models/Product");
const Tag = require("../models/Tag");
const { logError } = require("../utils/logger");

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
    const { name, content, description, price, cost, remains, tags } = req.body;
    const product = new Product({
      name,
      content,
      description,
      price,
      cost,
      remains,
      tags: tags || [],
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
    // Сначала создаем тег если его нет
    let tagDoc = await Tag.findOne({ name: tag.trim() });
    if (!tagDoc) {
      tagDoc = new Tag({ name: tag.trim() });
      await tagDoc.save();
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!product.tags.includes(tag.trim())) {
      product.tags.push(tag.trim());
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
