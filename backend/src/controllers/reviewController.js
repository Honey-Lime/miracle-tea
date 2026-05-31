const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");
const { getReviewBonusAmount } = require("../services/bonusService");

const getCompletedReviewOpportunities = async (userId) => {
  const orders = await Order.find({ userId, status: "completed" }).populate("list.pid", "name");
  const opportunities = [];

  for (const order of orders) {
    for (const item of order.list || []) {
      if (!item.pid) continue;

      const existingReview = await Review.findOne({
        userId,
        orderId: order._id,
        productId: item.pid._id,
        isSampler: Boolean(item.isSampler),
      });

      if (!existingReview) {
        opportunities.push({
          orderId: order._id,
          productId: item.pid._id,
          productName: item.pid.name,
          isSampler: Boolean(item.isSampler),
          completedAt: order.updatedAt || order.date,
        });
      }
    }
  }

  return opportunities;
};

exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ productId: req.params.productId, status: "approved" })
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    res.json(reviews.map((review) => ({
      id: review._id,
      date: review.createdAt,
      name: review.userId?.name || "Покупатель",
      text: review.text,
      likes: review.likes || 0,
      dislikes: review.dislikes || 0,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyReviewOpportunities = async (req, res) => {
  try {
    const [opportunities, reviewBonusAmount] = await Promise.all([
      getCompletedReviewOpportunities(req.userId),
      getReviewBonusAmount(),
    ]);
    res.json({ opportunities, reviewBonusAmount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { orderId, productId, isSampler, text } = req.body;
    const normalizedText = String(text || "").trim();

    if (!normalizedText) {
      return res.status(400).json({ message: "Введите текст отзыва" });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.userId, status: "completed" });
    if (!order) {
      return res.status(400).json({ message: "Оставить отзыв можно только по завершённому заказу" });
    }

    const hasProduct = order.list.some(
      (item) => String(item.pid) === String(productId) && Boolean(item.isSampler) === Boolean(isSampler),
    );
    if (!hasProduct) {
      return res.status(400).json({ message: "Такой позиции нет в заказе" });
    }

    const product = await Product.findById(productId).select("_id");
    if (!product) {
      return res.status(404).json({ message: "Товар не найден" });
    }

    const review = await Review.create({
      userId: req.userId,
      orderId,
      productId,
      isSampler: Boolean(isSampler),
      text: normalizedText,
      bonusAmount: await getReviewBonusAmount(),
    });

    res.status(201).json(review);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Вы уже оставили отзыв по этой позиции заказа" });
    }
    res.status(500).json({ message: error.message });
  }
};
