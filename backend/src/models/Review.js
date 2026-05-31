const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    orderId: {
      type: String,
      ref: "Order",
      required: true,
    },
    isSampler: {
      type: Boolean,
      default: false,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    adminComment: {
      text: {
        type: String,
        default: "",
        trim: true,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    photos: [
      {
        url: {
          type: String,
          required: true,
        },
      },
    ],
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
      min: 0,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          enum: ["like", "dislike"],
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    bonusAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusCredited: {
      type: Boolean,
      default: false,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ userId: 1, productId: 1, orderId: 1, isSampler: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
