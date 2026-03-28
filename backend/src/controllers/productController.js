const Product = require("../models/Product");

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new product (admin only)
exports.createProduct = async (req, res) => {
  const { name, content, description, price, cost, remains, tags, images } =
    req.body;
  try {
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
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update product (admin only)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Преобразуем images в правильный формат если это массив строк
    if (req.body.images && Array.isArray(req.body.images)) {
      req.body.images = req.body.images.map((img, index) => {
        if (typeof img === "string") {
          return { url: img, type: "image", order: index };
        }
        return { ...img, order: index };
      });
    }

    Object.assign(product, req.body);
    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete product (admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all unique tags
exports.getAllTags = async (req, res) => {
  try {
    const tags = await Product.distinct("tags");
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a new tag to a product
exports.addTagToProduct = async (req, res) => {
  const { productId, tag } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (!product.tags.includes(tag)) {
      product.tags.push(tag);
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
