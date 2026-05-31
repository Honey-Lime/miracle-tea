import { useContext, useEffect, useMemo, useState } from "react";
import { CartContext } from "../context/CartContext";
import { Link } from "react-router-dom";
import { getProducts } from "../services/productService";

const CartPage = () => {
  const { cartItems, totalPrice, updateQuantity, removeFromCart } =
    useContext(CartContext);
  const [currentRemains, setCurrentRemains] = useState({});
  const [removedOutOfStockNotice, setRemovedOutOfStockNotice] = useState(false);

  useEffect(() => {
    const checkStock = async () => {
      try {
        const response = await getProducts();
        const remainsById = {};
        response.data.forEach((product) => {
          remainsById[product._id] = product.remains;
        });
        setCurrentRemains(remainsById);
      } catch (error) {
        console.error("Ошибка проверки остатков:", error);
      }
    };

    checkStock();
  }, []);

  const stockWarnings = useMemo(() => {
    const warnings = {};

    cartItems.forEach((item) => {
      const hasRegularItem = cartItems.some(
        (cartItem) => cartItem.pid === item.pid && !cartItem.isSampler,
      );
      if (item.isSampler && hasRegularItem) return;

      const maxRemains = currentRemains[item.pid] ?? item.maxRemains;
      const sameProductOtherCount = cartItems
        .filter(
          (cartItem) =>
            cartItem.pid === item.pid && cartItem.isSampler !== item.isSampler,
        )
        .reduce((sum, cartItem) => sum + cartItem.count, 0);
      const availableForItem = Math.max(maxRemains - sameProductOtherCount, 0);

      if (item.count <= availableForItem) return;

      const unit = item.unit || "grams";
      const step = unit === "grams" ? 50 : 1;
      const minCount = unit === "grams" ? 50 : 1;
      let allowedCount = item.isSampler
        ? availableForItem >= 10 ? 10 : 0
        : Math.floor(availableForItem / step) * step;

      if (!item.isSampler && allowedCount < minCount) {
        allowedCount = 0;
      }

      warnings[`${item.pid}-${item.isSampler}`] = {
        allowedCount,
        maxRemains,
      };
    });

    return warnings;
  }, [cartItems, currentRemains]);

  const hasStockWarnings = Object.keys(stockWarnings).length > 0;
  const totalGrams = cartItems
    .filter((item) => (item.unit || "grams") === "grams")
    .reduce((sum, item) => sum + item.count, 0);
  const canCheckout = cartItems.length > 0 && !hasStockWarnings;

  useEffect(() => {
    Object.entries(stockWarnings).forEach(([key, warning]) => {
      if (warning.allowedCount > 0) return;

      const item = cartItems.find(
        (cartItem) => `${cartItem.pid}-${cartItem.isSampler}` === key,
      );
      if (!item) return;

      removeFromCart(item.pid, item.isSampler);
      setRemovedOutOfStockNotice(true);
    });
  }, [cartItems, removeFromCart, stockWarnings]);

  const handleKeepAvailable = (item, allowedCount) => {
    if (allowedCount > 0) {
      updateQuantity(item.pid, item.isSampler, allowedCount);
      return;
    }

    removeFromCart(item.pid, item.isSampler);
  };

  if (cartItems.length === 0) {
    return (
      <div className="crt-cart-page crt-empty">
        <h1>Корзина пуста</h1>
        {removedOutOfStockNotice && (
          <div className="crt-removed-notice">
            Некоторые позиции закончились и были удалены из заказа
          </div>
        )}
        <p>Добавьте товары из каталога.</p>
        <Link to="/catalog" className="btn btn-primary">
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="crt-cart-page">
      <h1>Корзина</h1>
      <div className="crt-items">
        {cartItems.map((item) => {
          const isGrams = (item.unit || "grams") === "grams";
          const step = isGrams ? 50 : 1;
          const minCount = isGrams ? 50 : 1;
          const unitLabel = isGrams ? "г" : "шт";
          const itemWarning = stockWarnings[`${item.pid}-${item.isSampler}`];
          const maxRemains = currentRemains[item.pid] ?? item.maxRemains;
          const sameProductOtherCount = cartItems
            .filter(
              (cartItem) =>
                cartItem.pid === item.pid && cartItem.isSampler !== item.isSampler,
            )
            .reduce((sum, cartItem) => sum + cartItem.count, 0);
          const canIncrease = item.count + sameProductOtherCount + step <= maxRemains;
          return (
          <div
            key={`${item.pid}-${item.isSampler}`}
            className={`crt-item ${itemWarning ? "crt-item-stock-warning" : ""}`}
          >
            <div className="crt-item-info">
              <h3>
                {item.name} {item.isSampler && "(Пробник 10г)"}
              </h3>
              <p>
                Цена: {isGrams ? `${(item.price * 10).toFixed(2)} ₽/10г` : `${item.price.toFixed(2)} ₽/шт`}
              </p>
              {itemWarning && (
                <div className="crt-stock-warning-message">
                  <p>Товар заканчивается, обьем вашего заказа изменен.</p>
                  <div className="crt-stock-warning-actions">
                    {itemWarning.allowedCount > 0 && (
                      <button
                        type="button"
                        className="crt-btn-keep"
                        onClick={() => handleKeepAvailable(item, itemWarning.allowedCount)}
                      >
                        Оставить {itemWarning.allowedCount} {unitLabel}
                      </button>
                    )}
                    <button
                      type="button"
                      className="crt-btn-remove crt-btn-remove-warning"
                      onClick={() => removeFromCart(item.pid, item.isSampler)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="crt-item-controls">
              <div className="crt-quantity">
                <button
                  onClick={() =>
                    updateQuantity(item.pid, item.isSampler, item.count - step)
                  }
                  disabled={item.isSampler || item.count <= minCount}
                >
                  -
                </button>
                <span>
                  {item.count} {unitLabel}{item.isSampler && " (пробник)"}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(item.pid, item.isSampler, item.count + step)
                  }
                  disabled={item.isSampler || !canIncrease}
                >
                  +
                </button>
              </div>
              <div className="crt-item-total">
                {(item.price * item.count).toFixed(2)} ₽
              </div>
              {!itemWarning && (
                <button
                  className="crt-btn-remove"
                  onClick={() => removeFromCart(item.pid, item.isSampler)}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        );})}
      </div>
      {removedOutOfStockNotice && (
        <div className="crt-removed-notice">
          Некоторые позиции закончились и были удалены из заказа
        </div>
      )}
      <div className="crt-summary">
        <div className="crt-summary-inner">
          <div className="crt-summary-row">
            <span>Общий вес:</span>
            <span>{totalGrams} г</span>
          </div>
          <div className="crt-summary-row">
            <span>Стоимость товаров:</span>
            <span>{totalPrice} ₽</span>
          </div>
          <div className="crt-summary-row total">
            <span>Итого к оплате:</span>
            <span>{totalPrice} ₽</span>
          </div>
          <div className="crt-checkout-note">
            {cartItems.length === 0 && <p className="crt-warning">Добавьте товары.</p>}
            {hasStockWarnings && (
              <p className="crt-warning">Исправьте позиции, по которым не хватает товара на складе.</p>
            )}
            <Link
              to="/checkout"
              className={`btn btn-primary ${!canCheckout ? "disabled" : ""}`}
              aria-disabled={!canCheckout}
            >
              Оформить заказ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
