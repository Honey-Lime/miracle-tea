const Chat = require("../models/Chat");
const { notifyAdmin } = require("../services/adminNotificationService");

const formatMessage = (message) => ({
  id: message._id,
  sender: message.sender,
  text: message.text,
  photos: message.photos || [],
  createdAt: message.createdAt,
});

const formatChat = (chat) => ({
  id: chat._id,
  user: chat.userId
    ? { id: chat.userId._id, name: chat.userId.name, email: chat.userId.email }
    : null,
  messages: (chat.messages || []).map(formatMessage),
  unreadForUser: (chat.messages || []).filter((message) => message.sender === "admin" && !message.readByUser).length,
  unreadForAdmin: (chat.messages || []).filter((message) => message.sender === "user" && !message.readByAdmin).length,
  updatedAt: chat.updatedAt,
});

const getOrCreateChat = async (userId) => {
  let chat = await Chat.findOne({ userId });
  if (!chat) chat = await Chat.create({ userId, messages: [] });
  return chat;
};

const addMessage = async ({ chat, sender, text, files }) => {
  const normalizedText = String(text || "").trim();
  const photos = (files || []).map((file) => ({ url: `/uploads/chat/${file.filename}` }));

  if (!normalizedText && photos.length === 0) {
    const error = new Error("Введите сообщение или прикрепите фото");
    error.statusCode = 400;
    throw error;
  }

  chat.messages.push({
    sender,
    text: normalizedText,
    photos,
    readByUser: sender === "user",
    readByAdmin: sender === "admin",
  });
  await chat.save();
  return chat;
};

exports.getMyChat = async (req, res) => {
  try {
    const chat = await getOrCreateChat(req.userId);
    chat.messages.forEach((message) => {
      if (message.sender === "admin") message.readByUser = true;
    });
    await chat.save();
    await chat.populate("userId", "name email");
    res.json(formatChat(chat));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMyMessage = async (req, res) => {
  try {
    let chat = await getOrCreateChat(req.userId);
    chat = await addMessage({ chat, sender: "user", text: req.body.text, files: req.files });
    await chat.populate("userId", "name email");
    notifyAdmin(
      "Новое сообщение в чате",
      `Пользователь ${chat.userId?.name || "Клиент"} (${chat.userId?.email || "без email"}) написал сообщение:\n\n${req.body.text || "[фото]"}`,
    ).catch(() => {});
    res.status(201).json(formatChat(chat));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.getAdminChats = async (_req, res) => {
  try {
    const chats = await Chat.find({})
      .populate("userId", "name email")
      .sort({ updatedAt: -1 });
    res.json(chats.map(formatChat));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id).populate("userId", "name email");
    if (!chat) return res.status(404).json({ message: "Чат не найден" });
    chat.messages.forEach((message) => {
      if (message.sender === "user") message.readByAdmin = true;
    });
    await chat.save();
    res.json(formatChat(chat));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendAdminMessage = async (req, res) => {
  try {
    let chat = await Chat.findById(req.params.id).populate("userId", "name email");
    if (!chat) return res.status(404).json({ message: "Чат не найден" });
    chat = await addMessage({ chat, sender: "admin", text: req.body.text, files: req.files });
    await chat.populate("userId", "name email");
    res.status(201).json(formatChat(chat));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
