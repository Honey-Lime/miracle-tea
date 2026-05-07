import api from "./api";

export const sendEmailCode = (email) => api.post("/email/send-code", { email });

export const verifyEmailCode = (email, code) =>
  api.post("/email/verify-code", { email, code });
