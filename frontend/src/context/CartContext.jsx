import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import * as cartService from "../services/cartService";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Save to localStorage whenever cartItems change
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Sync cart with server when user logs in/out
  useEffect(() => {
    if (user && token) {
      const syncCart = async () => {
        setIsSyncing(true);
        try {
          // Merge local cart with server cart
          const serverCart = await cartService.mergeCarts(token, cartItems);
          // Update local cart with merged items
          const mergedItems = serverCart.list.map((item) => ({
            pid: item.pid._id || item.pid,
            name: item.pid.name,
            price: item.priceAtOrder,
            count: item.count,
            isSampler: item.isSampler || false,
            maxRemains: item.pid.remains,
          }));
          setCartItems(mergedItems);
        } catch (error) {
          console.error("Failed to sync cart with server:", error);
        } finally {
          setIsSyncing(false);
        }
      };
      syncCart();
    } else if (!user) {
      // User logged out, keep local cart as is
      // Optionally clear server cart? Not needed.
    }
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = async (product, count, isSampler = false) => {
    const pricePerGram = product.price / 100;
    // Для пробника фиксируем количество 10 г
    const finalCount = isSampler ? 10 : count;
    const newItem = {
      pid: product._id,
      name: product.name,
      price: pricePerGram,
      count: finalCount,
      isSampler,
      maxRemains: product.remains,
    };

    // Update local state optimistically
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.pid === product._id && item.isSampler === isSampler,
      );
      if (existing) {
        // Если это пробник и уже есть в корзине, не изменяем количество
        if (isSampler) {
          addToast(`Пробник "${product.name}" уже в корзине`, "warning");
          return prev;
        }
        // Для обычного товара увеличиваем количество
        const newCount = Math.min(existing.count + finalCount, product.remains);
        return prev.map((item) =>
          item.pid === product._id && item.isSampler === isSampler
            ? { ...item, count: newCount }
            : item,
        );
      } else {
        return [...prev, newItem];
      }
    });

    // Show notification
    const message = isSampler
      ? `Пробник "${product.name}" добавлен в корзину`
      : `"${product.name}" (${finalCount} г) добавлен в корзину`;
    addToast(message, "success");

    // Sync with server if user is logged in
    if (user && token) {
      try {
        await cartService.addToCart(token, {
          pid: product._id,
          count: finalCount,
          isSampler,
        });
      } catch (error) {
        console.error("Failed to add item to server cart:", error);
        // Revert local state? For simplicity, we keep local changes.
      }
    }
  };

  const removeFromCart = async (pid, isSampler) => {
    setCartItems((prev) =>
      prev.filter(
        (item) => !(item.pid === pid && item.isSampler === isSampler),
      ),
    );

    if (user && token) {
      try {
        await cartService.removeFromCart(token, { pid, isSampler });
      } catch (error) {
        console.error("Failed to remove item from server cart:", error);
      }
    }
  };

  const updateQuantity = async (pid, isSampler, newCount) => {
    if (newCount <= 0) {
      removeFromCart(pid, isSampler);
      return;
    }
    // Для пробника фиксированное количество 10 г, запрещаем изменение
    if (isSampler) {
      // Если пытаются изменить количество пробника, игнорируем (оставляем 10)
      // Но если newCount != 10, показываем предупреждение и не изменяем
      if (newCount !== 10) {
        addToast("Количество пробника нельзя изменить", "warning");
        return;
      }
    } else {
      // Для обычного товара проверяем минимальное количество 50 г
      if (newCount < 50) {
        addToast("Минимальное количество для чая — 50 г", "warning");
        return;
      }
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.pid === pid && item.isSampler === isSampler
          ? { ...item, count: newCount }
          : item,
      ),
    );

    if (user && token) {
      try {
        await cartService.updateCartItem(token, {
          pid,
          isSampler,
          count: newCount,
        });
      } catch (error) {
        console.error("Failed to update item quantity on server:", error);
      }
    }
  };

  const clearCart = async () => {
    setCartItems([]);
    if (user && token) {
      try {
        await cartService.clearCart(token);
      } catch (error) {
        console.error("Failed to clear server cart:", error);
      }
    }
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.count, 0);
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.count,
    0,
  );
  const totalUniqueItems = cartItems.length; // количество пунктов

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems, // total grams (for backward compatibility)
    totalUniqueItems, // количество пунктов
    totalPrice,
    isSyncing,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export { CartContext };
