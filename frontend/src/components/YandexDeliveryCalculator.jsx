import { useState, useEffect, useRef } from "react";
import {
  getYandexCities,
  calculateYandexDelivery,
  searchYandexCities,
} from "../services/yandexDeliveryService";

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
    <div className="ydc-calculator">
      <div className="ydc-form">
        <div className="ydc-form-group">
          <label htmlFor="city">Город получения</label>
          <div className="ydc-city-search" ref={searchRef}>
            <input
              id="city"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Начните вводить название города"
              className="ydc-city-input"
              autoComplete="off"
            />
            {isSearching && <span className="ydc-search-loading">⏳</span>}
            {showDropdown && searchResults.length > 0 && (
              <div className="ydc-city-dropdown">
                {searchResults.map((city) => (
                  <div
                    key={city.code}
                    className="ydc-city-option"
                    onClick={() => handleCitySelect(city)}
                  >
                    {city.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {cities.length > 0 && !searchQuery && (
            <div className="ydc-popular-cities">
              <span>Популярные: </span>
              {cities.slice(0, 5).map((city, index) => (
                <button
                  key={city.code}
                  type="button"
                  className="ydc-popular-city-btn"
                  onClick={() => handleCitySelect(city)}
                >
                  {city.name}
                  {index < Math.min(4, cities.length - 1) && ","}
                </button>
              ))}
            </div>
          )}
          {!available && (
            <p className="ydc-warning">
              Доставка в выбранный город может быть недоступна
            </p>
          )}
        </div>

        <div className="ydc-form-group">
          <label htmlFor="weight">Вес заказа (г)</label>
          <div className="ydc-weight-input">
            <input
              id="weight"
              type="range"
              min="50"
              max="5000"
              step="10"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value))}
            />
            <span className="ydc-weight-value">{weight} г</span>
          </div>
        </div>

        <div className="ydc-form-group">
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
        </div>

        <button
          className="ydc-calculate-btn"
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? "Рассчитываем..." : "Рассчитать доставку"}
        </button>

        {error && <div className="ydc-error-message">{error}</div>}

        {result && result.success && (
          <div className="ydc-result">
            <div className="ydc-price">
              {result.price} {result.currency}
            </div>
            <p>
              <strong>Срок:</strong> {result.minDays}–{result.maxDays} рабочих
              дня
            </p>
          </div>
        )}

        {result && !result.success && (
          <div className="ydc-error-message">{result.message}</div>
        )}
      </div>
    </div>
  );
};

export default YandexDeliveryCalculator;
