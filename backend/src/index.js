const https = require("https");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const { logDBOperation, logHTTPRequest } = require("./utils/logger");
const crypto = require("crypto");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;

// В продакшене SSL обычно терминируется на nginx, а Node работает по HTTP за прокси.
// Поэтому HTTPS в Node включаем только явно через ENABLE_HTTPS=true.
const ENABLE_HTTPS = ["1", "true", "yes"].includes(
  String(process.env.ENABLE_HTTPS || "").toLowerCase(),
);

// Чтение SSL-сертификатов
let sslOptions = null;
try {
  if (!ENABLE_HTTPS) {
    console.log("Node HTTPS disabled (ENABLE_HTTPS not set). Using HTTP server.");
    sslOptions = null;
  } else {
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














const TERMINAL_KEY = "1778276759438DEMO";
const TERMINAL_PASSWORD = "m#G#C$En4dhul5!!";

function generateTBankToken(params, password) {
  const tokenParams = { Password: password };

  Object.entries(params).forEach(([key, value]) => {
    if (
      key !== "Token" &&
      value !== undefined &&
      value !== null &&
      typeof value !== "object"
    ) {
      tokenParams[key] = value;
    }
  });

  const sortedKeys = Object.keys(tokenParams).sort();

  const tokenString = sortedKeys
    .map((key) => String(tokenParams[key]))
    .join("");

  return crypto
    .createHash("sha256")
    .update(tokenString)
    .digest("hex");
}

async function restoreOrderProducts(order) {
  if (!order?.list?.length) {
    return;
  }

  await Promise.all(
    order.list.map((item) =>
      Product.updateOne(
        { _id: item.pid },
        { $inc: { remains: item.count } },
      ),
    ),
  );
}

async function markOrderAsPaid(order, paymentUpdate = {}) {
  const wasAlreadyPaid = order.status === "paid";

  order.status = "paid";
  order.payment = {
    ...order.payment,
    ...paymentUpdate,
  };

  if (order.userId && !wasAlreadyPaid) {
    const user = await User.findById(order.userId);

    if (user) {
      user.total += order.totalPrice;
      user.delivery.last = order.delivery?.address || null;
      user.delivery.history.push({
        date: new Date(),
        order: order.id,
      });
      await user.save();
    }

    await Order.updateOne(
      { userId: order.userId, status: "cart" },
      { $set: { list: [], totalPrice: 0 } },
    );
  }

  await order.save();
}

function isPaidTBankStatus(status) {
  return ["CONFIRMED", "AUTHORIZED"].includes(status);
}

app.post('/api/create-payment', async(req, res) => {
  let order = null;

  try {
    const {
      amount,
      id,
      deliveryData
    } = req.body;

    if (!amount || !id || !deliveryData) {
      return res.status(400).json({
        error: "Недостаточно данных для создания платежа",
      });
    }

    order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        error: "Заказ не найден",
      });
    }

    const bankOrderId = order.id;
    const paymentData = {
      TerminalKey: TERMINAL_KEY,
      Amount: Number(amount),
      OrderId: bankOrderId,
      Description: `Оплата заказа ${bankOrderId}`,
      // SuccessURL: 'https://чудочай.рф/thank-you',
      // FailURL: 'https://чудочай.рф/checkout',
      NotificationURL: 'https://чудочай.рф/api/create-delivery-order'

      // Receipt: {
      //   Email: "a@test.ru",
      //   Phone: "+79031234567",
      //   Taxation: "usn_income_outcome",
      //   Items: [
      //     {
      //       Name: "Наименование товара 1",
      //       Price: 10000,
      //       Quantity: 1,
      //       Amount: 10000,
      //       Tax: "none",
      //       Ean13: "303130323930303030630333435",
      //     },
      //   ],
      // },
    };

    paymentData.Token = generateTBankToken(
      {
        TerminalKey: paymentData.TerminalKey,
        Amount: paymentData.Amount,
        OrderId: paymentData.OrderId,
        Description: paymentData.Description,
        SuccessURL: paymentData.SuccessURL,
        FailURL: paymentData.FailURL,
        NotificationURL: paymentData.NotificationURL
      }, 
      TERMINAL_PASSWORD
    );

    const response = await fetch("https://securepay.tinkoff.ru/v2/Init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(paymentData),
    });

    const result = await response.json();

    if (!response.ok || result.Success === false) {
      console.error("Ошибка создания платежа при ответе банка:", result);
      await restoreOrderProducts(order);
      await order.deleteOne();

      return res.status(400).json({
        error: "Ошибка создания платежа при ответе банка",
        details: result,
      });
    }

    order.payment = {
      paymentId: String(result.PaymentId || ""),
      paymentUrl: result.PaymentURL || "",
      status: "initialized",
      raw: result,
    };

    order.delivery = {
      ...order.delivery,
      address: deliveryData.address || order.delivery?.address || null,
      price: Number(deliveryData.price || order.delivery?.price || 0),
      provider: deliveryData.service || order.delivery?.provider || "eshop",
      did: deliveryData.code || order.delivery?.did || "",
      details: deliveryData,
    };
    await order.save();

    // Ответ сервера для React-приложения
    res.json({
      paymentUrl: result.PaymentURL,
      paymentId: result.PaymentId,
      raw: result,
    });
  } catch (error) {
    console.error('Ошибка создания платежа:', error.message);

    if (order?.status === "payment_pending") {
      await restoreOrderProducts(order);
      await order.deleteOne();
    }

    res.status(500).json({ error: 'Не удалось инициировать платеж' });
  }
});

app.post('/api/create-delivery-order', async(req, res) => {
  try {
    const notification = req.body || {};
    const expectedToken = generateTBankToken(notification, TERMINAL_PASSWORD);

    if (notification.Token !== expectedToken) {
      console.error("Некорректный токен уведомления Т-Банка:", notification);
      return res.status(200).send('OK');
    }

    const order = await Order.findById(notification.OrderId);

    if (!order) {
      console.error("Заказ из уведомления Т-Банка не найден:", notification.OrderId);
      return res.status(200).send('OK');
    }

    const paymentUpdate = {
      paymentId: String(notification.PaymentId || order.payment?.paymentId || ""),
      status: notification.Status || order.payment?.status || "",
      raw: notification,
    };

    if (notification.Success === true && isPaidTBankStatus(notification.Status)) {
      await markOrderAsPaid(order, paymentUpdate);
      return res.status(200).send('OK');
    } else if (["REJECTED", "DEADLINE_EXPIRED", "CANCELED"].includes(notification.Status)) {
      if (order.status === "payment_pending") {
        await restoreOrderProducts(order);
        await order.deleteOne();
        return res.status(200).send('OK');
      }
    }

    order.payment = {
      ...order.payment,
      ...paymentUpdate,
    };

    await order.save();

    // Ответ сервера для банка
    res.status(200).send('OK');

  } catch (error) {
    console.error('Ошибка создания заказа доставки:', error.message);
    res.status(200).send('OK');
  }
});

app.post('/api/check-payment', async(req, res) => {
  try {
    const { id, paymentId } = req.body;

    if (!id || !paymentId) {
      return res.status(400).json({ error: "id и paymentId обязательны" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    const stateRequest = {
      TerminalKey: TERMINAL_KEY,
      PaymentId: String(paymentId),
    };

    stateRequest.Token = generateTBankToken(stateRequest, TERMINAL_PASSWORD);

    const response = await fetch("https://securepay.tinkoff.ru/v2/GetState", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(stateRequest),
    });

    const result = await response.json();

    if (!response.ok || result.Success === false) {
      return res.status(400).json({
        error: "Не удалось проверить статус оплаты",
        details: result,
      });
    }

    if (isPaidTBankStatus(result.Status)) {
      await markOrderAsPaid(order, {
        paymentId: String(result.PaymentId || paymentId),
        status: result.Status,
        raw: result,
      });
    }

    res.json({
      paid: isPaidTBankStatus(result.Status),
      status: result.Status,
      orderStatus: order.status,
      raw: result,
    });
  } catch (error) {
    console.error('Ошибка проверки платежа:', error.message);
    res.status(500).json({ error: 'Не удалось проверить платеж' });
  }
});

// Import routes
// const paymentRoutes = require("./routes/paymentRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const emailRoutes = require("./routes/emailRoutes");

console.log("Routes imported");

// Use routes
// app.use("/api/payment", paymentRoutes);
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
    // Если включен SSL, но HTTPS_PORT не задан, логичнее уважать общий PORT,
    // чтобы не пытаться занять 443 (который часто уже занят nginx/apache).
    const httpsPort = process.env.HTTPS_PORT || PORT || 443;
    https.createServer(sslOptions, app).listen(httpsPort, () => {
      console.log(`HTTPS server running on port ${httpsPort}`);
    });
    // Опционально: перенаправление HTTP → HTTPS (если нужно слушать и 80 порт)
    // В проде обычно 80/443 слушает nginx, поэтому включаем редирект-сервер
    // только если явно задан HTTP_PORT.
    const httpPort = process.env.HTTP_PORT;
    if (httpPort) {
      const httpApp = express();
      httpApp.use((req, res) => {
        res.redirect(`https://${req.headers.host}${req.url}`);
      });
      httpApp.listen(httpPort, () => {
        console.log(`HTTP redirect server running on port ${httpPort}`);
      });
    }
  } else {
    // HTTP сервер (fallback)
    app.listen(PORT, () => {
      console.log(`HTTP server running on port ${PORT}`);
    });
  }
};

startServer();
