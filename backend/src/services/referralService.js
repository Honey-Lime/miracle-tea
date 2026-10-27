const ReferralSource = require("../models/ReferralSource");
const User = require("../models/User");

const normalizeReferralCode = (code = "") =>
  String(code || "").trim().toUpperCase().replace(/[^A-ZА-ЯЁ0-9_-]/g, "");

const findSourceByLink = async (code) => {
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) {
    return null;
  }
  return ReferralSource.findOne({ links: normalizedCode, active: true });
};

// Привязывает пользователя к источнику, только если привязки ещё нет (первое касание).
const bindUserReferral = async (userId, { sourceId, via, code }) => {
  if (!userId || !sourceId) {
    return false;
  }

  const result = await User.updateOne(
    { _id: userId, $or: [{ "referral.sourceId": null }, { "referral.sourceId": { $exists: false } }] },
    {
      $set: {
        "referral.sourceId": sourceId,
        "referral.via": via,
        "referral.code": code || "",
        "referral.at": new Date(),
      },
    },
  );
  return result.modifiedCount > 0;
};

const bindUserReferralByLink = async (userId, code) => {
  const source = await findSourceByLink(code);
  if (!source) {
    return false;
  }
  return bindUserReferral(userId, { sourceId: source._id, via: "link", code: normalizeReferralCode(code) });
};

module.exports = {
  bindUserReferral,
  bindUserReferralByLink,
  findSourceByLink,
  normalizeReferralCode,
};
