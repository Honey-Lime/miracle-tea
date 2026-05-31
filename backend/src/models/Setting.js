const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Setting", settingSchema);
