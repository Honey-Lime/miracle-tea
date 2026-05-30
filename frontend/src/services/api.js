import axios from "axios";
import { reportClientError } from "./errorReporter";

const api = axios.create({
  baseURL: "/api",
});

// Добавляем токен к запросам, если он есть
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    reportClientError(error, "api.response", {
      request: {
        method: error.config?.method,
        url: error.config?.url,
      },
      response: {
        status: error.response?.status,
        data: error.response?.data,
      },
    });
    return Promise.reject(error);
  },
);

export default api;
