const mongoose = require("mongoose");

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    purpose: {
      type: String,
      enum: ["registration", "password_reset"],
      default: "registration",
    },
  },
  {
    timestamps: true,
    collection: "verificationcodes",
  },
);

module.exports = mongoose.model("VerificationCode", verificationCodeSchema);
