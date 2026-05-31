const Setting = require("../models/Setting");
const { sendEmail } = require("./emailService");

const NOTIFICATION_EMAIL_SETTING = "notificationEmail";

const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

const getNotificationEmail = async () => {
  const setting = await Setting.findById(NOTIFICATION_EMAIL_SETTING);
  return normalizeEmail(setting?.value);
};

const setNotificationEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  await Setting.findByIdAndUpdate(
    NOTIFICATION_EMAIL_SETTING,
    { value: normalizedEmail },
    { upsert: true, new: true, runValidators: true },
  );
  return normalizedEmail;
};

const notifyAdmin = async (subject, text) => {
  const to = await getNotificationEmail();
  if (!to) return { success: false, error: "Email для уведомлений не настроен" };
  return sendEmail({ to, subject, text });
};

module.exports = {
  getNotificationEmail,
  notifyAdmin,
  setNotificationEmail,
};
