import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import EShopLogistic from "../components/EShopLogistic";

const DADATA_TOKEN = "eb5a9b17d07d3320d19d665bc0ade765f3f016d3";
const ESHOPLOGISTIC_TOKEN = "df616893f983b20fed6ac71e5f6cb9f2";
const YANDEX_API_KEY = "d748d3d0-760c-44fa-923c-d865d6017c60";


// const PAYMENT_OPTIONS = [
//   { value: "card", label: "Картой онлайн" },
// ];

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user, token, openLoginModal } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [deliveryData, setDeliveryData] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("card");

  // Общий вес заказа в граммах (уже есть в компоненте)
  const totalWeight = cartItems.reduce((sum, item) => sum + item.count, 0);

  // Оформление заказа
  const handlePlaceOrder = async () => {
    try {
      if (!user || !token) {
        addToast("Для оформления заказа нужно войти в аккаунт", "warning");
        openLoginModal();
        return;
      }

      if (!cartItems.length) {
        addToast("Корзина пуста", "warning");
        return;
      }

      const cartItemsWithDetails = cartItems.map((item) => ({
        pid: item.pid,
        count: item.count,
        isSampler: item.isSampler,
      }));

      const orderData = {
        userId: user?._id,
        list: cartItemsWithDetails,
        delivery: {
          address: {
            details: null,
          },
          price: 0,
          provider: "manual",
          did: "",
        },
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка при оформлении заказа");
      }

      const order = await response.json();
      addToast("Заказ успешно оформлен!", "success");
      await clearCart();
      navigate("/thank-you", { state: { orderId: order._id } });
    } catch (error) {
      addToast(error.message, "error");
      console.error(error);
    }
  };

  return (
    <div className="chp-checkout-page container">
      <h1>Оформление заказа</h1>
      <div className="chp-checkout-content">
        <div className="chp-order-summary">
          <h2>Ваш заказ</h2>
          <ul>
            {cartItems.map((item) => (
              <li key={`${item.pid}-${item.isSampler}`}>
                {item.name} {item.isSampler && "(Пробник)"} — {item.count} г ×{" "}
                {item.price * 10} ₽/10г = {item.count * item.price} ₽
              </li>
            ))}
          </ul>
          <div className="chp-summary-total">
            <strong>Сумма товаров: {totalPrice} ₽</strong>
            <br />
            <small>Общий вес: {totalWeight} г</small>
          </div>
        </div>

        <EShopLogistic
          DADATA_TOKEN={DADATA_TOKEN}
          ESHOPLOGISTIC_TOKEN={ESHOPLOGISTIC_TOKEN}
          YANDEX_API_KEY={YANDEX_API_KEY}
          onDeliveryConfirm={(outputData) => {
            // console.log("Доставка из дочернего компонента:", outputData);
            setDeliveryData(outputData);
          }}
        />

        <div className="chp-checkout-sidebar">
          <div className="chp-final-total">
            <h2>Итого к оплате</h2>
            <div className="chp-total-breakdown">
              <div>Товары: {totalPrice} ₽</div>
              <div>Доставка: {deliveryData?.price} ₽</div>
              <div>
                <span>Оплата:</span>
                <span>
                  Картой
                  {/* {PAYMENT_OPTIONS.find(
                    (option) => option.value === paymentMethod,
                  )?.label || "Не выбрано"} */}
                </span>
              </div>
              <div className="chp-grand-total">Всего: {totalPrice + deliveryData?.price} ₽</div>
            </div>

            <button
              className="btn btn-primary chp-btn-large"
              onClick={handlePlaceOrder}
            >
              Оплатить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
