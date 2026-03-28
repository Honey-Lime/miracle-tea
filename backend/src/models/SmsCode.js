const mongoose = require("mongoose");

const smsCodeSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Автоматическое удаление после истечения
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
  },
);

module.exports = mongoose.model("SmsCode", smsCodeSchema);
