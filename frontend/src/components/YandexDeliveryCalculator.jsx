import { useState, useEffect, useRef } from "react";
import {
  getYandexCities,
  calculateYandexDelivery,
  searchYandexCities,
} from "../services/yandexDeliveryService";
import "./YandexDeliveryCalculator.css";

const YandexDeliveryCalculator = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [weight, setWeight] = useState(100);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);

  // Поиск городов
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Загружаем список городов при монтировании
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const data = await getYandexCities();
        setCities(data);
        if (data.length > 0) {
          setSelectedCity(data[0].name);
          setSearchQuery(data[0].name);
        }
      } catch (err) {
        console.error("Ошибка загрузки городов:", err);
        setError("Не удалось загрузить список городов");
      }
    };
    fetchCities();
  }, []);

  // Поиск городов при вводе
  useEffect(() => {
    if (searchQuery.length >= 2) {
      setIsSearching(true);

      // Debounce поиск
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchYandexCities(searchQuery);
          setSearchResults(results);
          setShowDropdown(true);
        } catch (err) {
          console.error("Ошибка поиска городов:", err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCitySelect = (city) => {
    setSelectedCity(city.name);
    setSearchQuery(city.name);
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleCalculate = async () => {
    if (!selectedCity || weight <= 0) {
      setError("Пожалуйста, выберите город и укажите вес");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await calculateYandexDelivery(
        selectedCity,
        weight,
        "Воронеж",
        amount,
      );
      setResult(data);
      setAvailable(true);
    } catch (err) {
      console.error("Ошибка расчета доставки:", err);
      setError("Сервис расчета временно недоступен. Попробуйте позже.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="yandex-delivery-calculator">
      <div className="yandex-header">
        <img
          src="https://yastatic.net/s3/lavka-web/public/assets/logo_ya_market.svg"
          alt="Яндекс Доставка"
          className="yandex-logo"
        />
        <h3>Калькулятор Яндекс Доставки (Next Day Delivery)</h3>
      </div>
      <p className="description">
        Рассчитайте стоимость доставки вашего заказа через{" "}
        <strong>Яндекс Доставку Next Day Delivery</strong>. Доставка на
        следующий день доступна в крупные города России. Отправка осуществляется
        из Воронежа.
      </p>

      <div className="calculator-form">
        <div className="form-group">
          <label htmlFor="city">Город получения</label>
          <div className="city-search" ref={searchRef}>
            <input
              id="city"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Начните вводить название города"
              className="city-input"
              autoComplete="off"
            />
            {isSearching && <span className="search-loading">⏳</span>}
            {showDropdown && searchResults.length > 0 && (
              <div className="city-dropdown">
                {searchResults.map((city) => (
                  <div
                    key={city.code}
                    className="city-option"
                    onClick={() => handleCitySelect(city)}
                  >
                    {city.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {cities.length > 0 && !searchQuery && (
            <div className="popular-cities">
              <span>Популярные: </span>
              {cities.slice(0, 5).map((city, index) => (
                <button
                  key={city.code}
                  type="button"
                  className="popular-city-btn"
                  onClick={() => handleCitySelect(city)}
                >
                  {city.name}
                  {index < Math.min(4, cities.length - 1) && ","}
                </button>
              ))}
            </div>
          )}
          {!available && (
            <p className="warning">
              Доставка в выбранный город может быть недоступна
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="weight">Вес заказа (г)</label>
          <div className="weight-input">
            <input
              id="weight"
              type="range"
              min="50"
              max="5000"
              step="10"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value))}
            />
            <span className="weight-value">{weight} г</span>
          </div>
          <div className="weight-hint">
            Минимальный заказ 50 г. Обычный вес чая: 100–200 г.
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Стоимость заказа (руб)</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="100"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
          <div className="hint">Укажите для расчета страховки</div>
        </div>

        <button
          className="calculate-btn"
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? "Рассчитываем..." : "Рассчитать доставку"}
        </button>

        {error && <div className="error-message">{error}</div>}

        {result && result.success && (
          <div className="result">
            <h4>Результат расчета</h4>
            <p>
              Доставка в <strong>{selectedCity}</strong> при весе{" "}
              <strong>{weight} г</strong>:
            </p>
            <div className="price">
              {result.price} {result.currency}
            </div>
            <div className="details">
              <p>
                <strong>Срок:</strong> {result.minDays}–{result.maxDays} рабочих
                дня
              </p>
              <p>
                <strong>Сервис:</strong> {result.service}
              </p>
              {result.details?.note && (
                <p className="note">{result.details.note}</p>
              )}
              {result.service?.includes("(stub)") && (
                <p className="stub-notice">
                  ℹ️ Расчет выполнен в демонстрационном режиме. Для получения
                  точной стоимости настройте API ключ Яндекс Доставки.
                </p>
              )}
            </div>
          </div>
        )}

        {result && !result.success && (
          <div className="error-message">
            Не удалось рассчитать доставку. {result.message}
          </div>
        )}
      </div>

      <div className="calculator-info">
        <p>
          <strong>Примечание:</strong> Расчет является предварительным. Точная
          стоимость будет определена при оформлении заказа. Для уточнения
          информации свяжитесь с нами.
        </p>
        <p className="yandex-brand">
          Интегрировано с <strong>Яндекс Доставкой Next Day Delivery</strong>.
          Узнайте больше на{" "}
          <a
            href="https://dostavka.yandex.ru/next-day-delivery-corp/"
            target="_blank"
            rel="noreferrer"
          >
            официальном сайте
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default YandexDeliveryCalculator;
