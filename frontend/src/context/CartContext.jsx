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
const CART_OWNER_KEY = "cartOwnerUserId";

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
          const userId = user.id || user._id;
          const cartOwnerUserId = localStorage.getItem(CART_OWNER_KEY);
          const shouldUploadLocalCart = !cartOwnerUserId || cartOwnerUserId === String(userId);
          const localItems = shouldUploadLocalCart ? cartItems : [];

          if (localItems.length !== cartItems.length) {
            setCartItems([]);
          }

          // Merge local cart with server cart
          const serverCart = await cartService.mergeCarts(token, localItems);
          // Update local cart with merged items
          const mergedItems = serverCart.list.map((item) => ({
            pid: item.pid._id || item.pid,
            name: item.pid.name,
            price: item.priceAtOrder,
            count: item.count,
            isSampler: item.isSampler || false,
            maxRemains: item.pid.remains,
            unit: item.pid.unit || "grams",
          }));
          setCartItems(mergedItems);
          localStorage.setItem(CART_OWNER_KEY, String(userId));
        } catch (error) {
          console.error("Failed to sync cart with server:", error);
        } finally {
          setIsSyncing(false);
        }
      };
      syncCart();
    } else if (!user && !token) {
      setCartItems([]);
      localStorage.removeItem(CART_OWNER_KEY);
    }
  }, [user, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = async (product, count, isSampler = false) => {
    const unit = product.unit || "grams";
    const pricePerUnit = unit === "grams" ? product.price / 100 : product.price;
    // Для пробника фиксируем количество 10 г
    const finalCount = isSampler ? 10 : count;
    const sameProductCount = cartItems
      .filter((item) => item.pid === product._id)
      .reduce((sum, item) => sum + item.count, 0);

    if (sameProductCount + finalCount > product.remains) {
      const unitLabel = unit === "grams" ? "г" : "шт";
      addToast(
        `На складе доступно только ${product.remains} ${unitLabel} с учетом уже добавленного в корзину`,
        "warning",
      );
      return;
    }

    const newItem = {
      pid: product._id,
      name: product.name,
      price: pricePerUnit,
      count: finalCount,
      isSampler,
      maxRemains: product.remains,
      unit,
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
        // Для обычного товара увеличиваем количество, учитывая пробник этого же чая
        const newCount = existing.count + finalCount;
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
      : `"${product.name}" (${finalCount} ${unit === "grams" ? "г" : "шт"}) добавлен в корзину`;
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
      const item = cartItems.find(
        (item) => item.pid === pid && item.isSampler === isSampler,
      );
      const unit = item?.unit || "grams";
      const minCount = unit === "grams" ? 50 : 1;
      if (newCount < minCount) {
        const unitLabel = unit === "grams" ? "г" : "шт";
        addToast(`Минимальное количество — ${minCount} ${unitLabel}`, "warning");
        return;
      }
      const sameProductOtherCount = cartItems
        .filter((cartItem) => cartItem.pid === pid && cartItem.isSampler !== isSampler)
        .reduce((sum, cartItem) => sum + cartItem.count, 0);
      const maxRemains = Number(item?.maxRemains) || 0;
      if (newCount + sameProductOtherCount > maxRemains) {
        const unitLabel = unit === "grams" ? "г" : "шт";
        addToast(
          `На складе доступно только ${maxRemains} ${unitLabel} с учетом пробника`,
          "warning",
        );
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
