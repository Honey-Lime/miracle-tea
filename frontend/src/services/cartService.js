import axios from "axios";

const API_URL = "/api/orders";

const DEFAULT_SAMPLER_SIZE_GRAMS = 20;

const getStoredSamplerSizeGrams = () => {
  const size = Math.floor(Number(localStorage.getItem("samplerSizeGrams")));
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_SAMPLER_SIZE_GRAMS;
};

const normalizeLocalCartItems = (items = []) => {
  const samplerSizeGrams = getStoredSamplerSizeGrams();
  const itemsByKey = new Map();

  items.forEach((item) => {
    const pid = item?.pid?._id || item?.pid;
    const isSampler = Boolean(item?.isSampler);
    const unit = item?.unit || "grams";
    const count = Number(item?.count) || 0;
    const minCount = unit === "grams" ? 50 : 1;

    if (!pid) return;
    if (isSampler && count !== samplerSizeGrams) return;
    if (!isSampler && count < minCount) return;

    const key = `${pid}:${isSampler ? "sampler" : "regular"}`;
    const existing = itemsByKey.get(key);
    itemsByKey.set(key, {
      pid,
      isSampler,
      count: isSampler ? samplerSizeGrams : (existing?.count || 0) + count,
    });
  });

  return Array.from(itemsByKey.values());
};

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
  try {
    const response = await axios.delete(`${API_URL}/cart/clear`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { list: [], totalPrice: 0 };
    }

    throw error;
  }
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
  const normalizedLocalItems = normalizeLocalCartItems(localItems);

  if (normalizedLocalItems.length === 0) {
    return serverCart; // both empty
  }

  // Clear server cart (should already be empty) and add local items
  await clearCart(token);
  for (const item of normalizedLocalItems) {
    try {
      await addToCart(token, {
        pid: item.pid,
        count: item.count,
        isSampler: item.isSampler,
      });
    } catch (error) {
      if (![400, 404].includes(error.response?.status)) {
        throw error;
      }
    }
  }

  // Return updated cart
  return await getCart(token);
};
