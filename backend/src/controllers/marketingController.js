const mongoose = require("mongoose");
const Order = require("../models/Order");
const PromoCode = require("../models/PromoCode");
const ReferralSource = require("../models/ReferralSource");
const User = require("../models/User");
const { logError } = require("../utils/logger");
const { NOT_USED_STATUSES, normalizePromoCode } = require("../services/promoService");
const { normalizeReferralCode } = require("../services/referralService");

const PAID_TOTAL_STATUSES = ["paid", "assembled", "shipped", "completed"];

const toNonNegativeInt = (value) => Math.max(0, Math.floor(Number(value) || 0));
const roundRub = (value) => Math.round((Number(value) || 0) * 100) / 100;

const buildPromoPayload = (body = {}) => {
  const discountType = body.discountType === "fixed" ? "fixed" : "percent";
  let discountValue = Math.max(0, Number(body.discountValue) || 0);
  if (discountType === "percent") {
    discountValue = Math.min(100, Math.floor(discountValue));
  }

  return {
    code: normalizePromoCode(body.code),
    discountType,
    discountValue,
    usesPerUser: toNonNegativeInt(body.usesPerUser),
    maxUses: toNonNegativeInt(body.maxUses),
    minOrderTotal: Math.max(0, Number(body.minOrderTotal) || 0),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    active: body.active !== false,
    referralSourceId: mongoose.isValidObjectId(body.referralSourceId) ? body.referralSourceId : null,
    comment: String(body.comment || "").trim(),
  };
};

const validatePromoPayload = (payload) => {
  if (!payload.code) return "Укажите промокод";
  if (!/^[A-ZА-ЯЁ0-9_-]+$/.test(payload.code)) {
    return "Промокод может содержать только буквы, цифры, «-» и «_»";
  }
  if (payload.expiresAt && Number.isNaN(payload.expiresAt.getTime())) return "Некорректная дата окончания";
  return null;
};

const handleDuplicate = (error, res, message) => {
  if (error?.code === 11000) {
    res.status(400).json({ message });
    return true;
  }
  return false;
};

// ---------- Промокоды ----------

exports.getPromoCodes = async (_req, res) => {
  try {
    const promos = await PromoCode.find()
      .populate("referralSourceId", "name")
      .sort({ createdAt: -1 })
      .lean();
    const usage = await Order.aggregate([
      { $match: { "promo.promoId": { $ne: null }, status: { $nin: NOT_USED_STATUSES } } },
      {
        $group: {
          _id: "$promo.promoId",
          uses: { $sum: 1 },
          discountTotal: { $sum: "$promo.discount" },
          users: { $addToSet: "$userId" },
        },
      },
    ]);
    const usageById = new Map(usage.map((item) => [String(item._id), item]));

    res.json(
      promos.map((promo) => {
        const stat = usageById.get(String(promo._id));
        return {
          ...promo,
          id: promo._id,
          referralSource: promo.referralSourceId
            ? { id: promo.referralSourceId._id, name: promo.referralSourceId.name }
            : null,
          referralSourceId: promo.referralSourceId?._id || null,
          uses: stat?.uses || 0,
          usersCount: stat?.users?.length || 0,
          discountTotal: stat?.discountTotal || 0,
        };
      }),
    );
  } catch (error) {
    logError(error, "getPromoCodes");
    res.status(500).json({ message: error.message });
  }
};

exports.createPromoCode = async (req, res) => {
  try {
    const payload = buildPromoPayload(req.body);
    const validationError = validatePromoPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const promo = await PromoCode.create(payload);
    res.status(201).json(promo);
  } catch (error) {
    if (handleDuplicate(error, res, "Такой промокод уже существует")) return;
    logError(error, "createPromoCode");
    res.status(500).json({ message: error.message });
  }
};

exports.updatePromoCode = async (req, res) => {
  try {
    const payload = buildPromoPayload(req.body);
    const validationError = validatePromoPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!promo) {
      return res.status(404).json({ message: "Промокод не найден" });
    }
    res.json(promo);
  } catch (error) {
    if (handleDuplicate(error, res, "Такой промокод уже существует")) return;
    logError(error, "updatePromoCode");
    res.status(500).json({ message: error.message });
  }
};

exports.deletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: "Промокод не найден" });
    }
    res.json({ message: "Промокод удалён" });
  } catch (error) {
    logError(error, "deletePromoCode");
    res.status(500).json({ message: error.message });
  }
};

// ---------- Реферальные источники ----------

const buildSourcePayload = (body = {}) => {
  const rawLinks = Array.isArray(body.links) ? body.links : String(body.links || "").split(/[\s,;]+/);
  return {
    name: String(body.name || "").trim(),
    comment: String(body.comment || "").trim(),
    links: Array.from(new Set(rawLinks.map(normalizeReferralCode).filter(Boolean))),
    active: body.active !== false,
  };
};

const validateSourcePayload = async (payload, currentId = null) => {
  if (!payload.name) return "Укажите название источника";
  if (payload.links.length > 0) {
    const conflict = await ReferralSource.findOne({
      links: { $in: payload.links },
      ...(currentId ? { _id: { $ne: currentId } } : {}),
    }).select("name links");
    if (conflict) {
      const duplicated = payload.links.filter((link) => conflict.links.includes(link));
      return `Ссылка ${duplicated.join(", ")} уже используется в источнике «${conflict.name}»`;
    }
  }
  return null;
};

// Выручка с чая (после промокода и бонусов, без доставки) и себестоимость заказа.
const getOrderMoney = (order) => {
  let itemsSum = 0;
  let cost = 0;
  (order.list || []).forEach((item) => {
    const count = Number(item.count) || 0;
    itemsSum += (Number(item.priceAtOrder) || 0) * count;
    let unitCost = item.costAtOrder;
    if (unitCost === null || unitCost === undefined) {
      const productCost = Number(item.pid?.cost) || 0;
      unitCost = (item.pid?.unit || "grams") === "grams" ? productCost / 100 : productCost;
    }
    cost += (Number(unitCost) || 0) * count;
  });
  const discount = (Number(order.promo?.discount) || 0) + (Number(order.bonuses?.spent) || 0);
  const revenue = Math.max(0, itemsSum - discount);
  return { revenue, cost, profit: revenue - cost };
};

const getGuestKey = (order) => {
  const phone = String(order.delivery?.details?.phone || "").replace(/\D/g, "");
  const email = String(order.delivery?.details?.email || "").trim().toLowerCase();
  return phone || email || String(order._id);
};

const emptyStats = () => ({
  clientsCount: 0,
  usersCount: 0,
  guestClientsCount: 0,
  ordersCount: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
});

const loadReferralData = async (sourceFilter = { $ne: null }) => {
  const [users, orders] = await Promise.all([
    User.find({ "referral.sourceId": sourceFilter })
      .select("name email referral createdAt")
      .lean(),
    Order.find({ "referral.sourceId": sourceFilter, status: { $in: PAID_TOTAL_STATUSES } })
      .populate("list.pid", "cost unit")
      .select("list promo bonuses referral userId customerType delivery.details totalPrice date status")
      .lean(),
  ]);
  return { users, orders };
};

const aggregateStats = ({ users, orders }) => {
  const bySource = new Map();
  const getSource = (sourceId) => {
    const key = String(sourceId);
    if (!bySource.has(key)) {
      bySource.set(key, { ...emptyStats(), guestKeys: new Set(), byCode: new Map() });
    }
    return bySource.get(key);
  };
  const getCode = (stats, code) => {
    const key = code || "—";
    if (!stats.byCode.has(key)) {
      stats.byCode.set(key, { code: key, clientsCount: 0, ordersCount: 0, revenue: 0, profit: 0 });
    }
    return stats.byCode.get(key);
  };

  users.forEach((user) => {
    const stats = getSource(user.referral.sourceId);
    stats.usersCount += 1;
    getCode(stats, user.referral.code).clientsCount += 1;
  });

  orders.forEach((order) => {
    const stats = getSource(order.referral.sourceId);
    const money = getOrderMoney(order);
    stats.ordersCount += 1;
    stats.revenue += money.revenue;
    stats.cost += money.cost;
    stats.profit += money.profit;
    const codeStats = getCode(stats, order.referral.code);
    codeStats.ordersCount += 1;
    codeStats.revenue += money.revenue;
    codeStats.profit += money.profit;

    if (!order.userId) {
      const guestKey = getGuestKey(order);
      if (!stats.guestKeys.has(guestKey)) {
        stats.guestKeys.add(guestKey);
        codeStats.clientsCount += 1;
      }
    }
  });

  const result = new Map();
  bySource.forEach((stats, key) => {
    result.set(key, {
      clientsCount: stats.usersCount + stats.guestKeys.size,
      usersCount: stats.usersCount,
      guestClientsCount: stats.guestKeys.size,
      ordersCount: stats.ordersCount,
      revenue: roundRub(stats.revenue),
      cost: roundRub(stats.cost),
      profit: roundRub(stats.profit),
      byCode: Array.from(stats.byCode.values()).map((item) => ({
        ...item,
        revenue: roundRub(item.revenue),
        profit: roundRub(item.profit),
      })),
    });
  });
  return result;
};

exports.getReferralSources = async (_req, res) => {
  try {
    const [sources, promos, data] = await Promise.all([
      ReferralSource.find().sort({ createdAt: -1 }).lean(),
      PromoCode.find({ referralSourceId: { $ne: null } }).select("code referralSourceId active").lean(),
      loadReferralData(),
    ]);
    const statsBySource = aggregateStats(data);

    res.json(
      sources.map((source) => ({
        ...source,
        id: source._id,
        promoCodes: promos
          .filter((promo) => String(promo.referralSourceId) === String(source._id))
          .map((promo) => ({ id: promo._id, code: promo.code, active: promo.active })),
        stats: statsBySource.get(String(source._id)) || { ...emptyStats(), byCode: [] },
      })),
    );
  } catch (error) {
    logError(error, "getReferralSources");
    res.status(500).json({ message: error.message });
  }
};

exports.getReferralSourceDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Источник не найден" });
    }
    const source = await ReferralSource.findById(req.params.id).lean();
    if (!source) {
      return res.status(404).json({ message: "Источник не найден" });
    }

    const data = await loadReferralData(source._id);
    const stats = aggregateStats(data).get(String(source._id)) || { ...emptyStats(), byCode: [] };

    const moneyByUser = new Map();
    const guests = new Map();
    data.orders.forEach((order) => {
      const money = getOrderMoney(order);
      if (order.userId) {
        const key = String(order.userId);
        const current = moneyByUser.get(key) || { ordersCount: 0, revenue: 0, profit: 0 };
        current.ordersCount += 1;
        current.revenue += money.revenue;
        current.profit += money.profit;
        moneyByUser.set(key, current);
        return;
      }
      const guestKey = getGuestKey(order);
      const current = guests.get(guestKey) || {
        name: order.delivery?.details?.name || "Гость",
        phone: order.delivery?.details?.phone || "",
        code: order.referral.code,
        ordersCount: 0,
        revenue: 0,
        profit: 0,
        firstOrderAt: order.date,
      };
      current.ordersCount += 1;
      current.revenue += money.revenue;
      current.profit += money.profit;
      guests.set(guestKey, current);
    });

    const clients = data.users
      .map((user) => {
        const money = moneyByUser.get(String(user._id)) || { ordersCount: 0, revenue: 0, profit: 0 };
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          via: user.referral.via,
          code: user.referral.code,
          boundAt: user.referral.at || user.createdAt,
          ordersCount: money.ordersCount,
          revenue: roundRub(money.revenue),
          profit: roundRub(money.profit),
        };
      })
      .sort((a, b) => new Date(b.boundAt) - new Date(a.boundAt));

    res.json({
      source: { ...source, id: source._id },
      stats,
      clients,
      guests: Array.from(guests.values()).map((guest) => ({
        ...guest,
        revenue: roundRub(guest.revenue),
        profit: roundRub(guest.profit),
      })),
    });
  } catch (error) {
    logError(error, "getReferralSourceDetails");
    res.status(500).json({ message: error.message });
  }
};

exports.createReferralSource = async (req, res) => {
  try {
    const payload = buildSourcePayload(req.body);
    const validationError = await validateSourcePayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const source = await ReferralSource.create(payload);
    res.status(201).json(source);
  } catch (error) {
    logError(error, "createReferralSource");
    res.status(500).json({ message: error.message });
  }
};

exports.updateReferralSource = async (req, res) => {
  try {
    const payload = buildSourcePayload(req.body);
    const validationError = await validateSourcePayload(payload, req.params.id);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const source = await ReferralSource.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!source) {
      return res.status(404).json({ message: "Источник не найден" });
    }
    res.json(source);
  } catch (error) {
    logError(error, "updateReferralSource");
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReferralSource = async (req, res) => {
  try {
    const source = await ReferralSource.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ message: "Источник не найден" });
    }
    const usersCount = await User.countDocuments({ "referral.sourceId": source._id });
    if (usersCount > 0) {
      return res.status(400).json({
        message: `К источнику привязано клиентов: ${usersCount}. Выключите его вместо удаления, чтобы сохранить статистику.`,
      });
    }
    await PromoCode.updateMany({ referralSourceId: source._id }, { $set: { referralSourceId: null } });
    await source.deleteOne();
    res.json({ message: "Источник удалён" });
  } catch (error) {
    logError(error, "deleteReferralSource");
    res.status(500).json({ message: error.message });
  }
};
