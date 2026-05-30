const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    customerType: {
      type: String,
      enum: ["user", "guest"],
      default: "user",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["cart", "payment_pending", "created", "paid", "assembled", "shipped", "completed", "cancelled", "refunded"],
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
      provider: {
        type: String,
        default: "eshop",
      },
      price: {
        type: Number,
        default: 0,
      },
      did: {
        type: String,
        default: "",
      },
      cdek: {
        type: Object,
        default: null,
      },
      cdekOrder: {
        type: Object,
        default: null,
      },
      details: {
        type: Object,
        default: null,
      },
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    payment: {
      paymentId: {
        type: String,
        default: "",
      },
      paymentUrl: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        default: "created",
      },
      raw: {
        type: Object,
        default: null,
      },
    },
    consents: {
      personalData: {
        type: Boolean,
        default: false,
      },
      refundPolicy: {
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
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("Order", orderSchema);
