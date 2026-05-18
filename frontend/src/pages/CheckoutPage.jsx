import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import EShopLogistic from "../components/EShopLogistic";

const DADATA_TOKEN = "eb5a9b17d07d3320d19d665bc0ade765f3f016d3";
const ESHOPLOGISTIC_TOKEN = "df616893f983b20fed6ac71e5f6cb9f2";
const YANDEX_API_KEY = "d748d3d0-760c-44fa-923c-d865d6017c60";

const DEFAULT_SETTLEMENT = {
  name: "Воронеж",
  fias: "5bf5ddff-6353-4a3d-80c4-6fb27f00c6c1",
  services: ["sdek", "yandex"],
};

const CITY_OPTIONS = [
  {
    name: "Воронеж",
    fias: "5bf5ddff-6353-4a3d-80c4-6fb27f00c6c1",
    services: ["sdek", "yandex"],
  },
  {
    name: "Москва",
    fias: "c2deb16a-0330-4f05-821f-1d09c93331e6",
    services: ["sdek", "yandex"],
  },
  {
    name: "Санкт-Петербург",
    fias: "c2f7c3f6-2f8f-40c4-9b7a-2e2aaf2b6fcb",
    services: ["sdek", "yandex"],
  },
  {
    name: "Казань",
    fias: "8bcd3d3f-2b82-4f86-8c84-6e7e9c7c4d6b",
    services: ["sdek", "yandex"],
  },
];

const PAYMENT_OPTIONS = [
  { value: "card", label: "Картой онлайн" },
  { value: "cash", label: "Наличные" },
  { value: "cashless", label: "Безналичный расчёт" },
  { value: "prepay", label: "Предоплата" },
  { value: "upon_receipt", label: "Оплата при получении" },
];

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user, token, openLoginModal } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [selectedCityName, setSelectedCityName] = useState(
    DEFAULT_SETTLEMENT.name,
  );
  const [paymentMethod, setPaymentMethod] = useState("card");

  const selectedCity =
    CITY_OPTIONS.find((city) => city.name === selectedCityName) ||
    DEFAULT_SETTLEMENT;

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
            city: selectedCity.name,
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
        />

        <div className="chp-checkout-sidebar">
          <div className="chp-final-total">
            <h2>Итого к оплате</h2>
            <div className="chp-total-breakdown">
              <div>Товары: {totalPrice} ₽</div>
              <div>
                <span>Город:</span>
                <span>{selectedCity.name}</span>
              </div>
              <div>
                <span>Оплата:</span>
                <span>
                  {PAYMENT_OPTIONS.find(
                    (option) => option.value === paymentMethod,
                  )?.label || "Не выбрано"}
                </span>
              </div>
              <div>
                <span>Доставка:</span>
                <span>Будет согласована после оформления</span>
              </div>
              <div className="chp-grand-total">Всего: {totalPrice} ₽</div>
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
