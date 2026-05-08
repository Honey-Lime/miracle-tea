const https = require("https");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const { logDBOperation, logHTTPRequest } = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 5000;

// Чтение SSL-сертификатов
let sslOptions = null;
try {
  const firstExistingPath = (candidates = []) =>
    candidates.find((p) => p && fs.existsSync(p));

  // Важно: относительные пути в Node зависят от текущей рабочей директории процесса.
  // В PM2 она может отличаться, поэтому используем пути от src/ через __dirname.
  // По умолчанию ожидаем сертификаты в backend/ssl/...
  // Но если их положили рядом с index.js (backend/src/ssl/...), тоже попробуем.
  const keyPath =
    process.env.SSL_KEY_PATH ||
    firstExistingPath([
      path.join(__dirname, "../ssl/certificate.key"),
      path.join(__dirname, "ssl/certificate.key"),
    ]);

  const certPath =
    process.env.SSL_CERT_PATH ||
    firstExistingPath([
      path.join(__dirname, "../ssl/certificate.crt"),
      path.join(__dirname, "ssl/certificate.crt"),
    ]);

  // CA bundle у провайдеров часто называется ca.crt
  const caPath =
    process.env.SSL_CA_PATH ||
    firstExistingPath([
      path.join(__dirname, "../ssl/certificate_ca.crt"),
      path.join(__dirname, "../ssl/ca.crt"),
      path.join(__dirname, "ssl/certificate_ca.crt"),
      path.join(__dirname, "ssl/ca.crt"),
    ]);

  if (keyPath && certPath) {
    sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    if (caPath) {
      sslOptions.ca = fs.readFileSync(caPath);
    }

    console.log("SSL certificates loaded successfully");
  } else {
    console.warn(
      "SSL certificates not found, falling back to HTTP. Expected files:",
      { keyPath, certPath },
    );
  }
} catch (err) {
  console.error("Failed to load SSL certificates:", err.message);
}

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
const startServer = () => {
  if (sslOptions) {
    // HTTPS сервер
    const httpsPort = process.env.HTTPS_PORT || 443;
    https.createServer(sslOptions, app).listen(httpsPort, () => {
      console.log(`HTTPS server running on port ${httpsPort}`);
    });
    // Опционально: перенаправление HTTP → HTTPS (если нужно слушать и 80 порт)
    const httpPort = process.env.HTTP_PORT || 80;
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(`https://${req.headers.host}${req.url}`);
    });
    httpApp.listen(httpPort, () => {
      console.log(`HTTP redirect server running on port ${httpPort}`);
    });
  } else {
    // HTTP сервер (fallback)
    app.listen(PORT, () => {
      console.log(`HTTP server running on port ${PORT}`);
    });
  }
};

startServer();
