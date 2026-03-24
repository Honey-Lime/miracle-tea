import { useState, useContext, useEffect } from "react";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  getYandexCities,
  calculateYandexDelivery,
} from "../services/yandexDeliveryService";
import "./CheckoutPage.css";

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [address, setAddress] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const [cities, setCities] = useState([]);
  const [selectedCityName, setSelectedCityName] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  // Вычисляем общий вес заказа в граммах
  const totalWeight = cartItems.reduce((sum, item) => sum + item.count, 0);

  // Загружаем список городов при монтировании
  useEffect(() => {
    const fetchCities = async () => {
      const citiesList = await getYandexCities();
      setCities(citiesList);
      if (citiesList.length > 0) {
        setSelectedCityName(citiesList[0].name);
      }
    };
    fetchCities();
  }, []);

  const handleCalculateDelivery = async () => {
    if (!selectedCityName) {
      addToast("Выберите город", "warning");
      return;
    }
    setIsCalculating(true);
    try {
      const result = await calculateYandexDelivery(
        selectedCityName,
        totalWeight,
      );
      setDeliveryPrice(result.price);
      addToast(`Доставка рассчитана: ${result.price} ₽`, "success");
    } catch (error) {
      addToast("Не удалось рассчитать доставку", "error");
      console.error(error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePlaceOrder = () => {
    // Заглушка: здесь будет отправка заказа на сервер
    addToast("Заказ оформлен! (заглушка)", "success");
    clearCart();
  };

  const totalWithDelivery = totalPrice + deliveryPrice;

  return (
    <div className="checkout-page">
      <h1>Оформление заказа</h1>
      <div className="checkout-content">
        <div className="order-summary">
          <h2>Ваш заказ</h2>
          <ul>
            {cartItems.map((item) => (
              <li key={`${item.pid}-${item.isSampler}`}>
                {item.name} {item.isSampler && "(Пробник)"} — {item.count} г ×{" "}
                {item.price * 10} ₽/10г = {item.count * item.price} ₽
              </li>
            ))}
          </ul>
          <div className="summary-total">
            <strong>Сумма товаров: {totalPrice} ₽</strong>
            <br />
            <small>Общий вес: {totalWeight} г</small>
          </div>
        </div>
        <div className="delivery-section">
          <h2>Доставка</h2>
          <div className="delivery-method">
            <label>
              <input
                type="radio"
                value="pickup"
                checked={deliveryMethod === "pickup"}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              />
              Самовывоз (бесплатно)
            </label>
            <label>
              <input
                type="radio"
                value="cdek"
                checked={deliveryMethod === "cdek"}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              />
              Доставка Яндекс
            </label>
          </div>
          {deliveryMethod === "cdek" && (
            <div className="cdek-calculator">
              <h3>Калькулятор Яндекс Доставки</h3>
              <div className="address-input">
                <label>Город доставки</label>
                <select
                  value={selectedCityName}
                  onChange={(e) => setSelectedCityName(e.target.value)}
                >
                  {cities.map((city) => (
                    <option key={city.code} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="address-input">
                <label>Адрес доставки (улица, дом)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Улица, дом, квартира"
                />
              </div>
              <div className="weight-info">
                <p>Вес заказа: {totalWeight} г</p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleCalculateDelivery}
                disabled={isCalculating}
              >
                {isCalculating ? "Расчет..." : "Рассчитать доставку"}
              </button>
              {deliveryPrice > 0 && (
                <p className="delivery-result">
                  Стоимость доставки: <strong>{deliveryPrice} ₽</strong>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="final-total">
          <h2>Итого к оплате</h2>
          <div className="total-breakdown">
            <div>Товары: {totalPrice} ₽</div>
            <div>Доставка: {deliveryPrice} ₽</div>
            <div className="grand-total">Всего: {totalWithDelivery} ₽</div>
          </div>
          <button
            className="btn btn-primary btn-large"
            onClick={handlePlaceOrder}
          >
            Оплатить
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
