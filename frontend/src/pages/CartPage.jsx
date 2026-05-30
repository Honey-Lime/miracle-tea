import { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { Link } from "react-router-dom";

const CartPage = () => {
  const { cartItems, totalPrice, updateQuantity, removeFromCart } =
    useContext(CartContext);
  const totalGrams = cartItems
    .filter((item) => (item.unit || "grams") === "grams")
    .reduce((sum, item) => sum + item.count, 0);
  const canCheckout = cartItems.length > 0;

  if (cartItems.length === 0) {
    return (
      <div className="crt-cart-page crt-empty">
        <h1>Корзина пуста</h1>
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
          return (
          <div key={`${item.pid}-${item.isSampler}`} className="crt-item">
            <div className="crt-item-info">
              <h3>
                {item.name} {item.isSampler && "(Пробник 10г)"}
              </h3>
              <p>
                Цена: {isGrams ? `${(item.price * 10).toFixed(2)} ₽/10г` : `${item.price.toFixed(2)} ₽/шт`}
              </p>
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
                  disabled={item.isSampler || item.count >= item.maxRemains}
                >
                  +
                </button>
              </div>
              <div className="crt-item-total">
                {(item.price * item.count).toFixed(2)} ₽
              </div>
              <button
                className="crt-btn-remove"
                onClick={() => removeFromCart(item.pid, item.isSampler)}
              >
                Удалить
              </button>
            </div>
          </div>
        );})}
      </div>
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
            {!canCheckout && <p className="crt-warning">Добавьте товары.</p>}
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
