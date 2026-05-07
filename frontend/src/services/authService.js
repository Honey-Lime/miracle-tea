import api from "./api";

export const changePassword = (data) => api.put("/auth/change-password", data);

export const forgotPassword = (email) =>
  api.post("/auth/forgot-password", { email });

export const resetPassword = (data) => api.post("/auth/reset-password", data);
