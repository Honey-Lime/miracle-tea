import api from "./api";

export const getProfile = () => api.get("/auth/profile");

export const changePassword = (data) => api.put("/auth/change-password", data);

export const updateName = (name) => api.put("/auth/name", { name });

export const forgotPassword = (email) =>
  api.post("/auth/forgot-password", { email });

export const resetPassword = (data) => api.post("/auth/reset-password", data);
