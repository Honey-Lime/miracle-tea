const Setting = require("../models/Setting");
const User = require("../models/User");

const BONUS_PERCENT_SETTING = "bonusPercent";
const REVIEW_BONUS_SETTING = "reviewBonusAmount";

const normalizeBonusPercent = (value) => {
  const percent = Number(value);

  if (!Number.isFinite(percent) || percent < 0) {
    return 0;
  }

  return percent;
};

const getBonusPercent = async () => {
  const setting = await Setting.findById(BONUS_PERCENT_SETTING);
  return normalizeBonusPercent(setting?.value);
};

const setBonusPercent = async (value) => {
  const percent = normalizeBonusPercent(value);
  await Setting.findByIdAndUpdate(
    BONUS_PERCENT_SETTING,
    { value: percent },
    { upsert: true, new: true, runValidators: true },
  );
  return percent;
};

const normalizeBonusAmount = (value) => {
  const amount = Math.floor(Number(value));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const getReviewBonusAmount = async () => {
  const setting = await Setting.findById(REVIEW_BONUS_SETTING);
  return normalizeBonusAmount(setting?.value);
};

const setReviewBonusAmount = async (value) => {
  const amount = normalizeBonusAmount(value);
  await Setting.findByIdAndUpdate(
    REVIEW_BONUS_SETTING,
    { value: amount },
    { upsert: true, new: true, runValidators: true },
  );
  return amount;
};

const calculateBonusEarned = (itemsTotal, bonusPercent) => {
  const percent = normalizeBonusPercent(bonusPercent);

  if (percent <= 0) {
    return 0;
  }

  return Math.floor((Number(itemsTotal) || 0) * (percent / 100)) + 1;
};

const creditOrderBonuses = async (order) => {
  if (!order?.userId || order.bonuses?.credited) {
    return 0;
  }

  const earned = Number(order.bonuses?.earned) || 0;

  if (earned <= 0) {
    order.bonuses = {
      ...order.bonuses,
      credited: true,
      creditedAt: new Date(),
    };
    await order.save();
    return 0;
  }

  await User.updateOne({ _id: order.userId }, { $inc: { bonusBalance: earned } });
  order.bonuses = {
    ...order.bonuses,
    credited: true,
    creditedAt: new Date(),
  };
  await order.save();

  return earned;
};

const refundOrderSpentBonuses = async (order) => {
  if (!order?.userId || order.bonuses?.spentRefunded) {
    return 0;
  }

  const spent = Number(order.bonuses?.spent) || 0;

  if (spent <= 0) {
    order.bonuses = {
      ...order.bonuses,
      spentRefunded: true,
      spentRefundedAt: new Date(),
    };
    await order.save();
    return 0;
  }

  await User.updateOne({ _id: order.userId }, { $inc: { bonusBalance: spent } });
  order.bonuses = {
    ...order.bonuses,
    spentRefunded: true,
    spentRefundedAt: new Date(),
  };
  await order.save();

  return spent;
};

module.exports = {
  calculateBonusEarned,
  creditOrderBonuses,
  getBonusPercent,
  getReviewBonusAmount,
  refundOrderSpentBonuses,
  setBonusPercent,
  setReviewBonusAmount,
};
