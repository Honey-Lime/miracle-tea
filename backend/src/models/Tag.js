const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#2e7d32",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Tag", tagSchema);
