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
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
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
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
          },
        },
      ],
    },
    total: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
