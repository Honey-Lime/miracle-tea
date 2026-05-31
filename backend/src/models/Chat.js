const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    photos: [
      {
        url: {
          type: String,
          required: true,
        },
      },
    ],
    readByUser: {
      type: Boolean,
      default: false,
    },
    readByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    messages: [messageSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Chat", chatSchema);
