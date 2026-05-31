const Order = require("../models/Order");
const Product = require("../models/Product");
const Review = require("../models/Review");
const { getReviewBonusAmount } = require("../services/bonusService");

const applyReaction = (target, userId, type) => {
  const existingReaction = target.reactions.find(
    (reaction) => String(reaction.userId) === String(userId),
  );

  if (existingReaction?.type === type) {
    target.reactions = target.reactions.filter(
      (reaction) => String(reaction.userId) !== String(userId),
    );
  } else if (existingReaction) {
    existingReaction.type = type;
  } else {
    target.reactions.push({ userId, type });
  }

  target.likes = target.reactions.filter((reaction) => reaction.type === "like").length;
  target.dislikes = target.reactions.filter((reaction) => reaction.type === "dislike").length;

  return target.reactions.find((reaction) => String(reaction.userId) === String(userId))?.type || null;
};

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
      photos: review.photos || [],
      likes: review.likes || 0,
      dislikes: review.dislikes || 0,
      myReaction: req.userId
        ? review.reactions?.find((reaction) => String(reaction.userId) === String(req.userId))?.type || null
        : null,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.reactToReview = async (req, res) => {
  try {
    const { type } = req.body;

    if (!["like", "dislike"].includes(type)) {
      return res.status(400).json({ message: "Неверная реакция" });
    }

    const review = await Review.findOne({ _id: req.params.id, status: "approved" });
    if (!review) {
      return res.status(404).json({ message: "Отзыв не найден" });
    }

    const myReaction = applyReaction(review, req.userId, type);
    await review.save();

    res.json({
      id: review._id,
      likes: review.likes,
      dislikes: review.dislikes,
      myReaction,
    });
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
    const normalizedIsSampler = isSampler === true || isSampler === "true";

    if (!normalizedText) {
      return res.status(400).json({ message: "Введите текст отзыва" });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.userId, status: "completed" });
    if (!order) {
      return res.status(400).json({ message: "Оставить отзыв можно только по завершённому заказу" });
    }

    const hasProduct = order.list.some(
      (item) => String(item.pid) === String(productId) && Boolean(item.isSampler) === normalizedIsSampler,
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
      isSampler: normalizedIsSampler,
      text: normalizedText,
      photos: (req.files || []).map((file) => ({ url: `/uploads/reviews/${file.filename}` })),
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
