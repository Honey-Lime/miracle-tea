const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    delivery: {
      last: {
        type: Object,
        default: null,
      },
      history: [
        {
          date: {
            type: Date,
            default: Date.now,
          },
          order: {
            type: String,
          },
        },
      ],
    },
    total: {
      type: Number,
      default: 0,
    },
    bonusBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    // Реферальная привязка: кто привёл клиента (первое касание).
    referral: {
      sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReferralSource",
        default: null,
      },
      via: {
        type: String,
        enum: ["link", "promo", "admin", null],
        default: null,
      },
      code: {
        type: String,
        default: "",
      },
      at: {
        type: Date,
        default: null,
      },
    },
    consents: {
      personalData: {
        type: Boolean,
        default: false,
      },
      acceptedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
