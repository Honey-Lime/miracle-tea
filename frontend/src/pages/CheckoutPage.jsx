import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const WIDGET_SCRIPT_ID = "eshop-logistic-widget-script";
const WIDGET_SCRIPT_SRC = "https://api.esplc.ru/widgets/cart/app.js";
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

const DELIVERY_WIDGET_EVENTS = [
  "eShopLogisticWidgetCart:selectDelivery",
  "eShopLogisticWidgetCart:onSelectDelivery",
  "eShopLogisticWidgetCart:chooseDelivery",
  "eShopLogisticWidgetCart:onChooseDelivery",
  "eShopLogisticWidgetCart:updateDeliveryResult",
  "eShopLogisticWidgetCart:onUpdateDeliveryResult",
  "eShopLogisticWidgetCart:result",
  "eShopLogisticWidgetCart:onResult",
];

const normalizeDeliveryData = (detail, fallbackCityName) => {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const address =
    detail.address ||
    detail.deliveryAddress ||
    detail.pickupPoint ||
    detail.tariff ||
    null;

  const provider =
    detail.provider ||
    detail.deliveryService ||
    detail.service ||
    detail.delivery?.provider ||
    "eshop";

  const rawPrice =
    detail.price ??
    detail.deliveryPrice ??
    detail.cost ??
    detail.tariffPrice ??
    detail.delivery?.price ??
    0;

  const did =
    detail.did ||
    detail.deliveryId ||
    detail.tariffId ||
    detail.id ||
    "";

  const normalizedPrice = Number(rawPrice) || 0;

  return {
    address,
    price: normalizedPrice,
    provider,
    did,
    city: detail.city || fallbackCityName,
    raw: detail,
  };
};

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user, token, openLoginModal } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const widgetRef = useRef(null);

  const [deliveryData, setDeliveryData] = useState(null);
  const [selectedCityName, setSelectedCityName] = useState(DEFAULT_SETTLEMENT.name);
  const [paymentMethod, setPaymentMethod] = useState("card");

  const selectedCity =
    CITY_OPTIONS.find((city) => city.name === selectedCityName) || DEFAULT_SETTLEMENT;

  const cart = cartItems.map((item) => ({
    article: item.pid,
    name: item.name,
    count: item.count,
    price: item.price * item.count,
    weight: Math.max(item.count / 1000, 0.01),
    dimensions: "15*10*5",
  }));

  // Общий вес заказа в граммах (уже есть в компоненте)
  const totalWeight = cartItems.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    setDeliveryData(null);
  }, [selectedCityName, paymentMethod, cartItems]);

  useEffect(() => {
    const root = widgetRef.current;
    if (!root) return;

    const dispatchWidgetParams = () => {
      if (!cart.length) return;

      const params = {
        offers: JSON.stringify(cart),
        payment: paymentMethod,
      };

      root.dispatchEvent(
        new CustomEvent("eShopLogisticWidgetCart:updateParamsRequest", {
          detail: { settlement: selectedCity, requestParams: params },
        }),
      );
    };

    const handleDeliveryEvent = (event) => {
      const normalized = normalizeDeliveryData(event.detail, selectedCity.name);
      if (normalized) {
        setDeliveryData(normalized);
      }
    };

    const ensureWidgetScript = () => {
      const existingScript = document.getElementById(WIDGET_SCRIPT_ID);
      if (existingScript) {
        if (existingScript.dataset.loaded === "true") {
          dispatchWidgetParams();
        }
        return;
      }

      const script = document.createElement("script");
      script.id = WIDGET_SCRIPT_ID;
      script.src = WIDGET_SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        dispatchWidgetParams();
      };
      document.body.appendChild(script);
    };

    // Функция, которая будет вызвана, когда виджет загрузится
    const onLoadApp = () => {
      dispatchWidgetParams();
    };

    // Слушаем событие готовности виджета
    root.addEventListener("eShopLogisticWidgetCart:onLoadApp", onLoadApp);
    DELIVERY_WIDGET_EVENTS.forEach((eventName) => {
      root.addEventListener(eventName, handleDeliveryEvent);
    });

    ensureWidgetScript();
    dispatchWidgetParams();

    // Очистка при размонтировании
    return () => {
      root.removeEventListener("eShopLogisticWidgetCart:onLoadApp", onLoadApp);
      DELIVERY_WIDGET_EVENTS.forEach((eventName) => {
        root.removeEventListener(eventName, handleDeliveryEvent);
      });
    };
  }, [cart, paymentMethod, selectedCity]);

  // Оформление заказа (с учётом выбранной доставки)
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

      if (!deliveryData) {
        addToast("Выберите вариант доставки", "warning");
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
            details: deliveryData.address,
          },
          price: deliveryData.price || 0,
          provider: deliveryData.provider || "eshop",
          did: deliveryData.did || "",
          paymentMethod,
          widgetData: deliveryData.raw || null,
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

  // Итоговая сумма с доставкой
  const totalWithDelivery = totalPrice + (deliveryData?.price || 0);

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

        <div className="chp-checkout-settings">
          <h2>Параметры доставки и оплаты</h2>
          <div className="chp-checkout-controls">
            <div className="chp-form-group">
              <label htmlFor="checkout-city">Город доставки</label>
              <select
                id="checkout-city"
                value={selectedCityName}
                onChange={(event) => setSelectedCityName(event.target.value)}
              >
                {CITY_OPTIONS.map((city) => (
                  <option key={city.fias} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="chp-form-group">
              <span className="chp-form-label">Способ оплаты</span>
              <div className="chp-payment-options">
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option.value} className="chp-payment-option">
                    <input
                      type="radio"
                      name="payment-method"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={widgetRef}
          id="eShopLogisticWidgetCart"
          data-lazy-load="false"
          data-key="685008-1634-1874"
        ></div>

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
                  {PAYMENT_OPTIONS.find((option) => option.value === paymentMethod)
                    ?.label || "Не выбрано"}
                </span>
              </div>
              <div>
                <span>Доставка:</span>
                <span>
                  {deliveryData
                    ? `${deliveryData.provider} ${deliveryData.price} ₽`
                    : "Выберите вариант в виджете"}
                </span>
              </div>
              {deliveryData?.address && (
                <div>
                  <span>Адрес/ПВЗ:</span>
                  <span>
                    {typeof deliveryData.address === "string"
                      ? deliveryData.address
                      : JSON.stringify(deliveryData.address)}
                  </span>
                </div>
              )}
              <div className="chp-grand-total">
                Всего: {totalWithDelivery} ₽
              </div>
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
