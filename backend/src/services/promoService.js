const PromoCode = require("../models/PromoCode");
const Order = require("../models/Order");

// Заказы в этих статусах не считаются использованием промокода.
const NOT_USED_STATUSES = ["cart", "cancelled", "refunded"];

const normalizePromoCode = (code = "") => String(code || "").trim().toUpperCase().replace(/\s+/g, "");

class PromoError extends Error {}

const calculatePromoDiscount = (promo, itemsTotal) => {
  const total = Math.max(0, Number(itemsTotal) || 0);
  const value = Math.max(0, Number(promo?.discountValue) || 0);

  if (!promo || value <= 0 || total <= 0) {
    return 0;
  }

  const discount = promo.discountType === "fixed"
    ? value
    : Math.floor(total * Math.min(value, 100) / 100);

  // Оплатить заказ полностью промокодом нельзя: банк не принимает платёж на 0 ₽.
  return Math.max(0, Math.min(Math.floor(discount), Math.ceil(total) - 1));
};

const countPromoUses = async (promoId, userId = null) => {
  const filter = { "promo.promoId": promoId, status: { $nin: NOT_USED_STATUSES } };
  if (userId) {
    filter.userId = userId;
  }
  return Order.countDocuments(filter);
};

// Проверяет промокод для пользователя и суммы товаров. Бросает PromoError с текстом для клиента.
const resolvePromoForOrder = async ({ code, userId, itemsTotal }) => {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    return null;
  }

  if (!userId) {
    throw new PromoError("Войдите в аккаунт, чтобы применить промокод");
  }

  const promo = await PromoCode.findOne({ code: normalizedCode });
  if (!promo || !promo.active) {
    throw new PromoError("Промокод не найден");
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new PromoError("Срок действия промокода истёк");
  }

  if (promo.minOrderTotal > 0 && Number(itemsTotal) < promo.minOrderTotal) {
    throw new PromoError(`Промокод действует для заказов от ${promo.minOrderTotal} ₽`);
  }

  if (promo.maxUses > 0 && (await countPromoUses(promo._id)) >= promo.maxUses) {
    throw new PromoError("Лимит использований промокода исчерпан");
  }

  if (promo.usesPerUser > 0 && (await countPromoUses(promo._id, userId)) >= promo.usesPerUser) {
    throw new PromoError(
      promo.usesPerUser === 1
        ? "Вы уже использовали этот промокод"
        : `Промокод можно использовать не более ${promo.usesPerUser} раз`,
    );
  }

  return {
    promo,
    discount: calculatePromoDiscount(promo, itemsTotal),
  };
};

module.exports = {
  NOT_USED_STATUSES,
  PromoError,
  calculatePromoDiscount,
  countPromoUses,
  normalizePromoCode,
  resolvePromoForOrder,
};
