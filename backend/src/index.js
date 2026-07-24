const https = require("https");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const {
  installConsoleCapture,
  logDBOperation,
  logHTTPRequest,
  logError,
  logClientError,
} = require("./utils/logger");
installConsoleCapture();
const crypto = require("crypto");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const { getBonusPercent } = require("./services/bonusService");
const { sendEmail } = require('./services/emailService');

const { createEShopDeliveryOrder } = require("./utils/createEShopDeliveryOrder");

const TERMINAL_KEY = process.env.TERMINAL_KEY;
const TERMINAL_PASSWORD = process.env.TERMINAL_PASSWORD;
const ESHOPLOGISTIC_TOKEN = process.env.ESHOPLOGISTIC_TOKEN;

const app = express();
const PORT = process.env.PORT || 5000;
const PAID_TOTAL_STATUSES = ["paid", "assembled", "shipped", "completed"];

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

// // Custom HTTP logging middleware
// app.use((req, res, next) => {
//   const start = Date.now();
//   res.on("finish", () => {
//     const duration = Date.now() - start;
//     logHTTPRequest(req.method, req.originalUrl, res.statusCode, duration, {
//       user: req.userId || "guest",
//       ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
//     });
//   });
//   next();
// });

// MongoDB connection
const mongoURI = process.env.MONGODB_URI;
console.log(
  `Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`,
);

const removeUserPhoneIndex = async () => {
  const indexes = await User.collection.indexes();
  const phoneIndex = indexes.find((index) => index.name === "phone_1");

  if (phoneIndex) {
    console.warn("Found obsolete users.phone index. Dropping it.");
    await User.collection.dropIndex("phone_1");
  }
};

mongoose
  .connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    autoIndex: true,
  })
  .then(async () => {
    console.log("MongoDB connected successfully");
    await removeUserPhoneIndex();
  })
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
// mongoose.set("debug", (collectionName, method, query, doc) => {
//   logDBOperation(method, collectionName, query, doc);
// });

// Basic route
app.get("/", (req, res) => {
  res.send("Miracle Tea API is running");
});

app.post("/api/client-errors", (req, res) => {
  logClientError(req.body, req);
  res.status(204).send();
});
















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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatRub(value) {
  return `${Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`;
}

function buildPaidOrderEmail({ user, order, deliveryId, orderItems }) {
  const customerName = user?.name || "покупатель";
  const deliveryProvider = order.delivery?.provider || "служба доставки";
  const deliveryAddress = order.delivery?.address?.value || "адрес доставки не указан";
  const itemsTotal = Number(order.itemsTotal) || orderItems.reduce((sum, item) => sum + item.total, 0);
  const bonusSpent = Number(order.bonuses?.spent) || 0;
  const deliveryPrice = Number(order.delivery?.price) || 0;
  const totalPrice = Number(order.totalPrice) || Math.max(0, itemsTotal - bonusSpent) + deliveryPrice;

  const rowsHtml = orderItems.map((item) => `
    <tr>
      <td style="padding:14px 12px;border-bottom:1px solid #edf1e8;color:#24301f;">
        <div style="font-weight:600;">${escapeHtml(item.name)}</div>
        ${item.isSampler ? '<div style="margin-top:4px;color:#6f7b68;font-size:13px;">Пробник</div>' : ""}
      </td>
      <td style="padding:14px 12px;border-bottom:1px solid #edf1e8;color:#53604c;text-align:center;white-space:nowrap;">${escapeHtml(item.quantityLabel)}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #edf1e8;color:#53604c;text-align:right;white-space:nowrap;">${formatRub(item.price)}</td>
      <td style="padding:14px 12px;border-bottom:1px solid #edf1e8;color:#24301f;text-align:right;font-weight:600;white-space:nowrap;">${formatRub(item.total)}</td>
    </tr>`).join("");

  const text = [
    `Здравствуйте, ${customerName}.`,
    `Ваш заказ ${order.id} оформлен и оплачен.`,
    `ID заказа в кабинете доставки (${deliveryProvider}): ${deliveryId}.`,
    `Адрес доставки: ${deliveryAddress}.`,
    "",
    "Состав заказа:",
    ...orderItems.map((item) => `- ${item.name}${item.isSampler ? " (Пробник)" : ""}: ${item.quantityLabel} × ${formatRub(item.price)} = ${formatRub(item.total)}`),
    "",
    `Товары: ${formatRub(itemsTotal)}`,
    bonusSpent > 0 ? `Списано бонусов: −${formatRub(bonusSpent)}` : null,
    `Доставка: ${formatRub(deliveryPrice)}`,
    `Итого оплачено: ${formatRub(totalPrice)}`,
  ].filter(Boolean).join("\n");

  const html = `
    <div style="margin:0;padding:0;background:#f6f7f2;font-family:Arial,Helvetica,sans-serif;color:#24301f;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px rgba(35,48,31,0.08);">
          <div style="padding:30px 28px;background:#24301f;color:#ffffff;">
            <div style="font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#cdddc3;">Чудо Чай</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;font-weight:700;">Заказ оплачен</h1>
            <p style="margin:12px 0 0;color:#e6f0df;font-size:16px;line-height:1.5;">Здравствуйте, ${escapeHtml(customerName)}! Мы получили оплату и уже готовим ваш заказ.</p>
          </div>

          <div style="padding:28px;">
            <div style="padding:18px 20px;background:#f4f8ef;border-radius:16px;margin-bottom:24px;">
              <div style="margin-bottom:8px;"><strong>Заказ:</strong> №${escapeHtml(order.id)}</div>
              <div style="margin-bottom:8px;"><strong>Доставка:</strong> ${escapeHtml(deliveryProvider)}</div>
              <div style="margin-bottom:8px;"><strong>ID в кабинете доставки:</strong> ${escapeHtml(deliveryId)}</div>
              <div><strong>Адрес:</strong> ${escapeHtml(deliveryAddress)}</div>
            </div>

            <h2 style="margin:0 0 14px;font-size:20px;color:#24301f;">Состав заказа</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #edf1e8;border-radius:14px;overflow:hidden;">
              <thead>
                <tr style="background:#f8faf5;">
                  <th align="left" style="padding:12px;color:#6f7b68;font-size:13px;font-weight:600;">Товар</th>
                  <th align="center" style="padding:12px;color:#6f7b68;font-size:13px;font-weight:600;">Кол-во</th>
                  <th align="right" style="padding:12px;color:#6f7b68;font-size:13px;font-weight:600;">Цена</th>
                  <th align="right" style="padding:12px;color:#6f7b68;font-size:13px;font-weight:600;">Сумма</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>

            <div style="margin-top:24px;padding:20px;background:#fbfcf8;border-radius:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span>Товары</span><strong>${formatRub(itemsTotal)}</strong></div>
              ${bonusSpent > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#5d7f36;"><span>Списано бонусов</span><strong>−${formatRub(bonusSpent)}</strong></div>` : ""}
              <div style="display:flex;justify-content:space-between;margin-bottom:14px;"><span>Доставка</span><strong>${formatRub(deliveryPrice)}</strong></div>
              <div style="height:1px;background:#e6ebdf;margin:14px 0;"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:20px;"><span>Итого оплачено</span><strong>${formatRub(totalPrice)}</strong></div>
            </div>

            <p style="margin:24px 0 0;color:#6f7b68;line-height:1.5;">Спасибо, что выбрали Чудо Чай. Если появятся вопросы по заказу, просто ответьте на это письмо.</p>
          </div>
        </div>
      </div>
    </div>`;

  return { text, html };
}

async function restoreOrderProducts(order) {
  if (!order?.stockReserved || !order?.list?.length) {
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

  order.stockReserved = false;
  order.stockReservedAt = null;
  await order.save();
}

async function reserveOrderProducts(order) {
  if (order.stockReserved) {
    return;
  }

  const requestedByProduct = new Map();
  for (const item of order.list || []) {
    if (!item.pid || item.count <= 0) {
      continue;
    }

    const productId = item.pid.toString();
    requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + item.count);
  }

  for (const [productId, count] of requestedByProduct.entries()) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }
    if (product.remains < count) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
  }

  await Promise.all(
    Array.from(requestedByProduct.entries()).map(([productId, count]) =>
      Product.updateOne(
        { _id: productId },
        { $inc: { remains: -count } },
      ),
    ),
  );

  order.stockReserved = true;
  order.stockReservedAt = new Date();
  await order.save();
}

async function restoreOrderBonuses(order) {
  const spent = Number(order?.bonuses?.spent) || 0;

  if (order?.userId && spent > 0) {
    await User.updateOne({ _id: order.userId }, { $inc: { bonusBalance: spent } });
  }
}

async function markOrderAsPaid(order, paymentUpdate = {}) {
  const wasAlreadyPaid = order.status === "paid";

  if (!wasAlreadyPaid) {
    await reserveOrderProducts(order);
  }

  order.status = "paid";
  order.payment = {
    ...order.payment,
    ...paymentUpdate,
  };

  if (order.userId && !wasAlreadyPaid) {
    const user = await User.findById(order.userId);

    if (user) {
      user.delivery.last = order.delivery?.address || null;
      user.delivery.history.push({
        date: new Date(),
        order: order.id,
      });
      const paidOrders = await Order.find({
        userId: order.userId,
        status: { $in: PAID_TOTAL_STATUSES },
      }).select("totalPrice");
      user.total = paidOrders.reduce(
        (sum, paidOrder) => sum + (paidOrder.totalPrice || 0),
        order.totalPrice,
      );
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
  return ["CONFIRMED"].includes(status);
}

function isCancelTBankStatus(status) {
  return ["REVERSED", "REFUNDED", "REJECTED", "DEADLINE_EXPIRED", "PARTIAL_REFUNDED"].includes(status);
}

// Функция, которая возвращает Promise, разрешающийся при успешном/отменённом статусе
function waitForPaymentStatus(PaymentId, interval = 20000, maxAttempts = 90) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = async () => {
      attempts++;
      try {
        const checkPaymentData = {
          TerminalKey: TERMINAL_KEY,
          PaymentId: PaymentId,
        };

        checkPaymentData.Token = generateTBankToken(
          {
            TerminalKey: TERMINAL_KEY,
            PaymentId: PaymentId,
          },
          TERMINAL_PASSWORD
        );

        const response = await fetch("https://securepay.tinkoff.ru/v2/GetState", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(checkPaymentData),
        });

        const result = await response.json();

        if (isPaidTBankStatus(result.Status)) {
          resolve({ success: true, data: result });
          return;
        }

        if (isCancelTBankStatus(result.Status)) {
          resolve({ success: false, data: result, error: 'Payment cancelled' });
          return;
        }

        if (attempts >= maxAttempts) {
          resolve({ success: null, data: result, error: 'Max attempts exceeded' });
          return;
        }

        // Иначе повторяем через interval
        setTimeout(check, interval);
      } catch (error) {
        reject(error);
      }
    };

    check(); // запускаем первую проверку
  });
}

async function arrangeDeliveryOrder(orderId, deliveryData)
{
  // const { id, deliveryData } = req.body;

  let companyData = {
    senderName: "Александр",                       // string 	Имя
    senderPhone: "79202115108",                   // string 	Телефон
    senderCompany: "Чудочай",      // string 	Название компании
    
    pick_up: false,                               // boolean 	Забор груза от отправителя
    address: {      // заполняем если pick_up = true
      region: "",   // string 	Регион. Например: Московская область
      city: "",     // string 	Населённый пункт
      street: "",   // string 	Улица
      house: "",    // string 	Номер строения
      room: ""      // string 	Квартира / офис / помещение
    }
  };

  let order = await Order.findById(orderId).populate("list.pid", "sku name");

  const orderList = order.list.map((item) => ({
    ...item.toObject(),
    article: item.pid?.sku || "",
    name: item.pid?.name || "",
  }));
  // console.log(orderList);

  let orderData = {
    id: orderId,       // string 	Идентификатор заказа на сайте.
    places: [],   // array Нужно заполнить информацией о заказах 
    type: 1,      // integer 	Тип заказа. Доступно 2 варианта: «1» - Интернет-магазин, «2» - Доставка.
    combine_places_apply: true, // boolean 	
                                // Объединить все грузовые места в одно.
                                // При этом внутри грузового места формируется список позиций для страховки.
                                // По умолчанию = false.
    total_weight: 0,
    dimensions: "10*15*",
    payment: "already_paid",  // string 	Способ оплаты
                                // Возможные варианты:
                                // already_paid - заказ уже оплачен,
                                // cash_on_receipt - наличными при получении,
                                // card_on_receipt - картой при получении,
                                // cashless - безналичный расчет
  };

  let real_orders = 0;
  for (let i = 0; i < orderList.length; i++) {
    orderData.places.push(
      {
        article: orderList[i].article,          // string 	Идентификатор товара / груза.
        name: orderList[i].name,                // string 	Название
        count: 1,                               // integer 	Количество
        price: orderList[i].priceAtOrder,       // double 	Цена, включая НДС
        weight: orderList[i].count / 1000,      // double 	Вес, в кг.
        dimensions: "10*15*6",                  // string 	Габариты. Формат: строка вида «Д*Ш*В», в сантиметрах. Например: 15*25*10 .
        vat_rate: -1,                           // integer 	Значение ставки НДС 
                                                // Возможные варианты: 0, 5, 7, 10, 20, -1 (без НДС)
      }
    );
    if (orderList[i].isSampler == false)
    {
      real_orders++;
    }
    orderData.total_weight += orderList[i].count / 1000;
  }

  orderData.dimensions = `${orderData.dimensions}${real_orders * 6}`;

  const deliveryId = await createEShopDeliveryOrder(ESHOPLOGISTIC_TOKEN, deliveryData, orderData, companyData);
  return deliveryId;
}

async function saveDeliveryIdToOrder(orderId, deliveryId) {
  await Order.findByIdAndUpdate(
    orderId,
    { 
      $set: { 
        'delivery.did': deliveryId 
      } 
    }
  );
}


















app.post('/api/create-payment', async(req, res) => {
  let order = null;

  try {
    const {
      id,
      deliveryData
    } = req.body;

    if (!id || !deliveryData) {
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

    const user = order.userId ? await User.findById(order.userId) : null;


    const TAXATION = "usn_income_outcome";
    const TAX = "none";
    const receiptItems = [];
    const orderEmailItems = [];

    for (const item of order.list || []) {
      const product = await Product.findById(item.pid);

      if (!product) {
        return res.status(400).json({
          error: `Товар ${item.pid} не найден для формирования чека`,
        });
      }

      const quantity = Number(item.count);
      const priceRub = Number(item.priceAtOrder) || 0;
      const priceKopecks = Math.round(priceRub * 100);
      const amountKopecks = Math.round(priceKopecks * quantity);

      if (!quantity || quantity <= 0 || !priceKopecks || priceKopecks <= 0) {
        return res.status(400).json({
          error: `Некорректная позиция чека: ${product.name}`,
        });
      }

      receiptItems.push({
        Name: String(product.name || "Товар").slice(0, 128),
        Price: priceKopecks,
        Quantity: quantity,
        Amount: amountKopecks,
        Tax: TAX,
      });

      const unit = product.unit || "grams";
      orderEmailItems.push({
        name: product.name || "Товар",
        quantity,
        quantityLabel: `${quantity} ${unit === "grams" ? "г" : "шт"}`,
        price: priceRub,
        total: amountKopecks / 100,
        isSampler: Boolean(item.isSampler),
      });
    }

    const deliveryPriceRub = Number(order.delivery?.price) || 0;

    if (deliveryPriceRub > 0) {
      const deliveryAmountKopecks = Math.round(deliveryPriceRub * 100);

      receiptItems.push({
        Name: "Доставка",
        Price: deliveryAmountKopecks,
        Quantity: 1,
        Amount: deliveryAmountKopecks,
        Tax: TAX,
      });
    }

    if (receiptItems.length === 0) {
      return res.status(400).json({
        error: "Нет позиций для формирования чека",
      });
    }

    if (receiptItems.length > 100) {
      return res.status(400).json({
        error: "В чеке не может быть больше 100 позиций",
      });
    }

    const receiptAmount = receiptItems.reduce((sum, item) => sum + item.Amount, 0);

    // console.log("TERMINAL_KEY", TERMINAL_KEY);
    // console.log("TERMINAL_PASSWORD", TERMINAL_PASSWORD);
    
    // const amount = Math.round((Number(order.totalPrice) || 0) * 100);
    const paymentData = {
      TerminalKey: TERMINAL_KEY,
      Amount: Number(receiptAmount),
      OrderId: order.id,
      Description: `Оплата заказа ${order.id}`,
      Receipt: {
        Taxation: TAXATION,
        Items: receiptItems,
        Email: user.email
      },

      // SuccessURL: 'https://чудочай.рф/thank-you',
      // FailURL: 'https://чудочай.рф/checkout',
      // NotificationURL: 'https://чудочай.рф/api/set-order-isPayment'
      // NotificationURL: 'https://xn--80ahqsxxd.xn--p1ai/api/set-order-isPayment'

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
        // SuccessURL: paymentData.SuccessURL,
        // FailURL: paymentData.FailURL,
        // NotificationURL: paymentData.NotificationURL
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
    let PaymentId = result.PaymentId;

    if (!response.ok || result.Success === false) {
      console.error("Ошибка создания платежа при ответе банка:", result);
      await restoreOrderProducts(order);
      await restoreOrderBonuses(order);
      await order.deleteOne();

      return res.status(400).json({
        error: "Ошибка создания платежа при ответе банка",
        details: result,
      });
    }

    order.payment = {
      PaymentId: String(PaymentId || ""),
      paymentUrl: result.PaymentURL || "",
      status: "initialized",
      raw: result,
    };

    order.delivery = {
      ...order.delivery,
      address: deliveryData.address || order.delivery?.address || null,
      price: Number(deliveryData.price || order.delivery?.price || 0),
      provider: deliveryData.service || order.delivery?.provider || "eshop",
      terminalCode: deliveryData.code || order.delivery?.terminalCode || "",
      details: deliveryData,
    };
    
    await order.save();

    // Ответ сервера для React-приложения
    res.json({
      paymentUrl: result.PaymentURL,
      PaymentId: PaymentId,
      // raw: result,
    });

    var paymentStatus = await waitForPaymentStatus(PaymentId);

    if(paymentStatus.success === true)
    {
      // console.log("Пришел ответ статуса оплаты: ", paymentStatus.data);
      await markOrderAsPaid(order, {
        PaymentId: String(paymentStatus.data.PaymentId || PaymentId),
        status: paymentStatus.data.Status,
        raw: paymentStatus.data,
      });

      let deliveryId = await arrangeDeliveryOrder(order.id, deliveryData);
      await saveDeliveryIdToOrder(order.id, deliveryId);
      const orderEmail = buildPaidOrderEmail({
        user,
        order,
        deliveryId,
        orderItems: orderEmailItems,
      });

      if (user?.email) {
        const emailResult = await sendEmail({
          to: user.email,
          subject: `Заказ ${order.id} оформлен и оплачен`,
          text: orderEmail.text,
          html: orderEmail.html,
        });

        // if (emailResult.success) {
        //   console.log('Письмо отправлено');
        // } else {
        //   console.error('Ошибка:', emailResult.error);
        }
      } else {
        console.warn(`Email для заказа ${order.id} не отправлен: у пользователя не указан email`);
      }
      // console.log("ID заказа в ЛК перевозчика: ", deliveryId);}


    if(paymentStatus.success === false)
    {
      console.log("Сбой оплаты, ответ банка: ", paymentStatus.data);
      await restoreOrderProducts(order);
      await restoreOrderBonuses(order);
      await order.deleteOne();
    }

  } catch (error) {
    console.error('Ошибка создания платежа:', error.message);

    if (order?.status === "payment_pending") {
      await restoreOrderProducts(order);
      await restoreOrderBonuses(order);
      await order.deleteOne();
    }

    res.status(500).json({ error: 'Не удалось инициировать платеж' });
  }
});

// app.post('/api/test', async(req, res) => {
//   try {
//     const {id, deliveryData} = req.body;
//     let deliveryId = await arrangeDeliveryOrder(id, deliveryData);
//     await saveDeliveryIdToOrder(order.id, deliveryId);
//     console.log("ID заказа в ЛК перевозчика: ", deliveryId);
//     res.status(200).send('OK');
//   } catch (error) {
//     console.error('Ошибка проверки платежа:', error.message);
//     res.status(500).json({ error: 'Не удалось проверить платеж' });
//   }
// });

app.post('/api/set-order-isPayment', async(req, res) => {
  try {
    console.log("Ответ банка об оплате", req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка проверки платежа:', error.message);
    res.status(500).json({ error: 'Не удалось проверить платеж' });
  }
});

app.get("/api/bonus-settings", async (_req, res) => {
  try {
    res.json({ bonusPercent: await getBonusPercent() });
  } catch (error) {
    res.status(500).json({ message: "Не удалось загрузить настройки бонусов" });
  }
});

// async function createDeliveryOrder(deliveryData, orderData, otherData)
// {
//   const ESHOPLOGISTIC_TOKEN = "df616893f983b20fed6ac71e5f6cb9f2";

//   let location_from = 
//   otherData.delivery.location_from.pick_up == true 
//   ? { 
//     pick_up: otherData.delivery.location_from.pick_up,
//     address: otherData.delivery.location_from.address
//   }
//   : {
//     pick_up: otherData.delivery.location_from.pick_up
//   };

//   let location_to = 
//   deliveryData.type == "terminal" 
//   ? {
//     terminal: deliveryData.code
//   }
//   : {
//     address: {
//       country: deliveryData.address.country,    // string 	Код страны.
//                                                 // Варианты: RU, UZ, AZ, KZ, AB, TM, BY, UA, TJ, KG, AM, MD 
//       region: deliveryData.address.region,      // string 	Регион. Например: Московская область
//       city: deliveryData.address.city,          // string 	Населённый пункт
//       district: deliveryData.address.district,  // string 	Район
//       street: deliveryData.address.street,      // string 	Улица
//       house: deliveryData.address.house,        // string 	Номер строения
//       room: deliveryData.room,                  // string 	Квартира / офис / помещение
//     }
//   };

//   let order = {
//     id: orderData.id,
//     comment: deliveryData.comment // string 	Комментарий
//   }
//   let tariff;
//   switch (deliveryData.service) {
//     case "sdek":
//       order.type = orderData.type;
//       if (orderData.combine_places_apply == true)
//       {
//         order.combine_places = {};
//         order.combine_places.apply = true;
//         order.combine_places.weight = orderData.total_weight;
//         order.combine_places.dimensions = orderData.dimensions;
//       }

//       if(deliveryData.type == "terminal")
//       {
//         tariff = 136;
//       } else if(deliveryData.type == "door")
//       {
//         tariff = 137;
//       }
//       break;
  
//     default:
//       break;
//   }

//   let data = { 
//     key: ESHOPLOGISTIC_TOKEN, 
//     action: "create",
//     cms: "custom",
//     service: deliveryData.service,
//     order: order,
//     sender: otherData.sender,
//     receiver: {
//       name: deliveryData.name,
//       phone: deliveryData.phone
//     },
//     places: orderData.places,
//     delivery: {
//       type: deliveryData.type,
//       tariff: tariff,
//       location_from: {
//         pick_up: otherData.delivery.location_from.pick_up
//       },
//       location_to: location_to,
//       payment: orderData.payment,
//       cost: deliveryData.price
//     }
//   };
  
//   console.log(data);
//   let response = await fetch("https://api.esplc.ru/delivery/order", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(data),
//   });
//   let result = await response.json();
//   console.log("eshopResult", result);
// }

// Import routes
// const paymentRoutes = require("./routes/paymentRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const emailRoutes = require("./routes/emailRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { log } = require("console");

console.log("Routes imported");

// Use routes
// app.use("/api/payment", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chats", chatRoutes);

console.log("Routes registered");

app.use((err, req, res, next) => {
  logError(err, "Unhandled request error", req);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
});

process.on("unhandledRejection", (reason) => {
  logError(reason instanceof Error ? reason : new Error(String(reason)), "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logError(error, "Uncaught exception");
});

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
