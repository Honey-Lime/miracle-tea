const mongoose = require("mongoose");

const referralSourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    comment: {
      type: String,
      default: "",
    },
    // Коды реферальных ссылок вида /?ref=CODE (хранятся капсом).
    links: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

referralSourceSchema.index({ links: 1 });

module.exports = mongoose.model("ReferralSource", referralSourceSchema);
