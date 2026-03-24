import axios from "axios";

const API_URL = "/api/orders";

// Get cart from server
export const getCart = async (token) => {
  const response = await axios.get(`${API_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Add item to cart on server
export const addToCart = async (token, { pid, count, isSampler }) => {
  const response = await axios.post(
    `${API_URL}/cart/add`,
    { pid, count, isSampler },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Remove item from cart on server
export const removeFromCart = async (token, { pid, isSampler }) => {
  const response = await axios.post(
    `${API_URL}/cart/remove`,
    { pid, isSampler },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Update item quantity on server
export const updateCartItem = async (token, { pid, isSampler, count }) => {
  const response = await axios.put(
    `${API_URL}/cart/update`,
    { pid, isSampler, count },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Clear cart on server
export const clearCart = async (token) => {
  const response = await axios.delete(`${API_URL}/cart/clear`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Merge local cart with server cart
export const mergeCarts = async (token, localItems) => {
  // First, get server cart
  const serverCart = await getCart(token);
  const serverItems = serverCart.list || [];

  // If server cart already has items, ignore local items and return server cart
  if (serverItems.length > 0) {
    return serverCart;
  }

  // Server cart is empty, upload local items (if any)
  if (localItems.length === 0) {
    return serverCart; // both empty
  }

  // Clear server cart (should already be empty) and add local items
  await clearCart(token);
  for (const item of localItems) {
    await addToCart(token, {
      pid: item.pid,
      count: item.count,
      isSampler: item.isSampler,
    });
  }

  // Return updated cart
  return await getCart(token);
};
