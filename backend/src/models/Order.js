const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["cart", "ordered", "completed", "cancelled"],
      default: "cart",
    },
    list: [
      {
        pid: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        count: {
          type: Number,
          required: true,
          min: 0,
        },
        priceAtOrder: {
          type: Number,
          required: true,
        },
        isSampler: {
          type: Boolean,
          default: false,
        },
      },
    ],
    delivery: {
      address: {
        type: Object,
        default: null,
      },
      price: {
        type: Number,
        default: 0,
      },
      did: {
        type: String,
        default: "",
      },
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Order", orderSchema);
