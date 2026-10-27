const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },
    // Процент (1–100) или сумма в рублях. 0 — промокод только для реферальной привязки.
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Сколько раз один аккаунт может использовать промокод. 0 — без ограничений.
    usesPerUser: {
      type: Number,
      default: 1,
      min: 0,
    },
    // Общий лимит использований. 0 — без ограничений.
    maxUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    minOrderTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    referralSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReferralSource",
      default: null,
    },
    comment: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PromoCode", promoCodeSchema);
