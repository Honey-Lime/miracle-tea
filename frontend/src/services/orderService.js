import api from "./api";

export const createOrder = (data) => api.post("/orders", data);
export const getMyOrders = () => api.get("/orders/my-orders");
export const getAllOrders = () => api.get("/orders");
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const cancelOrder = (id) => api.put(`/orders/${id}/cancel`);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);
