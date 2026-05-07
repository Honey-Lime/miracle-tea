const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const { logDBOperation, logHTTPRequest } = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// HTTP request logging with morgan
app.use(morgan("dev"));

// Custom HTTP logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logHTTPRequest(req.method, req.originalUrl, res.statusCode, duration);
  });
  next();
});

// MongoDB connection
const mongoURI = process.env.MONGODB_URI;
console.log(
  `Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`,
);
mongoose
  .connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    autoIndex: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected, attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// MongoDB operation logging
mongoose.set("debug", (collectionName, method, query, doc) => {
  logDBOperation(method, collectionName, query, doc);
});

// Basic route
app.get("/", (req, res) => {
  res.send("Miracle Tea API is running");
});

// Logs route (for debugging)
const fs = require("fs");
app.get("/api/logs", (req, res) => {
  const logFile = path.join(__dirname, "../logs/app.log");
  if (!fs.existsSync(logFile)) {
    return res.status(404).json({ error: "Log file not found" });
  }
  const logs = fs.readFileSync(logFile, "utf8");
  res.type("text/plain").send(logs);
});

// Import routes
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const emailRoutes = require("./routes/emailRoutes");

console.log("Routes imported");

// Use routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);

console.log("Routes registered");

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
