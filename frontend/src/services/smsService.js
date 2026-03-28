import api from "./api";

// Отправка кода подтверждения на номер
export const sendSmsCode = (phone) => api.post("/sms/send-code", { phone });

// Проверка кода подтверждения
export const verifySmsCode = (phone, code) =>
  api.post("/sms/verify-code", { phone, code });
