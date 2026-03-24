import { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { Link } from "react-router-dom";
import "./CartPage.css";

const CartPage = () => {
  const { cartItems, totalPrice, updateQuantity, removeFromCart } =
    useContext(CartContext);
  const totalGrams = cartItems.reduce((sum, item) => sum + item.count, 0);
  const canCheckout = totalGrams >= 50;

  if (cartItems.length === 0) {
    return (
      <div className="cart-page empty">
        <h1>Корзина пуста</h1>
        <p>Добавьте товары из каталога.</p>
        <Link to="/catalog" className="btn btn-primary">
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Корзина</h1>
      <div className="cart-items">
        {cartItems.map((item) => (
          <div key={`${item.pid}-${item.isSampler}`} className="cart-item">
            <div className="item-info">
              <h3>
                {item.name} {item.isSampler && "(Пробник 10г)"}
              </h3>
              <p>Цена: {(item.price * 10).toFixed(2)} ₽/10г</p>
            </div>
            <div className="item-controls">
              <div className="quantity">
                <button
                  onClick={() =>
                    updateQuantity(item.pid, item.isSampler, item.count - 10)
                  }
                  disabled={item.isSampler || item.count <= 50}
                >
                  -
                </button>
                <span>
                  {item.count} г{item.isSampler && " (пробник)"}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(item.pid, item.isSampler, item.count + 10)
                  }
                  disabled={item.isSampler || item.count >= item.maxRemains}
                >
                  +
                </button>
              </div>
              <div className="item-total">
                {(item.price * item.count).toFixed(2)} ₽
              </div>
              <button
                className="btn-remove"
                onClick={() => removeFromCart(item.pid, item.isSampler)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="cart-summary">
        <div className="summary-row">
          <span>Общий вес:</span>
          <span>{totalGrams} г</span>
        </div>
        <div className="summary-row">
          <span>Стоимость товаров:</span>
          <span>{totalPrice} ₽</span>
        </div>
        <div className="summary-row total">
          <span>Итого к оплате:</span>
          <span>{totalPrice} ₽</span>
        </div>
        <div className="checkout-note">
          {!canCheckout && (
            <p className="warning">
              Минимальный заказ 50 г. Добавьте ещё товаров.
            </p>
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
  );
};

export default CartPage;
