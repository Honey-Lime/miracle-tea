import api from "./api";

export const changePassword = (data) => api.put("/auth/change-password", data);

export const forgotPassword = (phone) =>
  api.post("/auth/forgot-password", { phone });

export const resetPassword = (data) => api.post("/auth/reset-password", data);
