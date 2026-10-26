import { useEffect, useState } from "react";
import api from "../../services/api";
import { getProducts } from "../../services/productService";

const SettingsPage = () => {
  const [bonusPercent, setBonusPercent] = useState("0");
  const [reviewBonusAmount, setReviewBonusAmount] = useState("0");
  const [samplerSizeGrams, setSamplerSizeGrams] = useState("20");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deliveryServices, setDeliveryServices] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [popularIds, setPopularIds] = useState([]);
  const [popularMax, setPopularMax] = useState(8);
  const [popularToAdd, setPopularToAdd] = useState("");
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularMessage, setPopularMessage] = useState("");
  const [popularError, setPopularError] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/admin/settings/bonuses");
        setBonusPercent(String(response.data.bonusPercent ?? 0));
        setReviewBonusAmount(String(response.data.reviewBonusAmount ?? 0));
        setSamplerSizeGrams(String(response.data.samplerSizeGrams ?? 20));
        setNotificationEmail(response.data.notificationEmail || "");
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Не удалось загрузить настройки");
      } finally {
        setLoading(false);
      }
    };

    const loadDeliverySettings = async () => {
      setDeliveryLoading(true);
      setDeliveryError("");

      try {
        const response = await api.get("/admin/settings/delivery");
        setDeliveryServices(response.data.services || []);
      } catch (requestError) {
        setDeliveryError(requestError.response?.data?.message || "Не удалось загрузить службы доставки");
      } finally {
        setDeliveryLoading(false);
      }
    };

    const loadPopularSettings = async () => {
      setPopularLoading(true);
      setPopularError("");

      try {
        const [settingsResponse, productsResponse] = await Promise.all([
          api.get("/admin/settings/popular"),
          getProducts(),
        ]);
        setPopularIds(settingsResponse.data.productIds || []);
        setPopularMax(settingsResponse.data.maxCount || 8);
        setAllProducts(
          [...productsResponse.data].sort((a, b) => a.name.localeCompare(b.name, "ru")),
        );
      } catch (requestError) {
        setPopularError(requestError.response?.data?.message || "Не удалось загрузить популярные сорта");
      } finally {
        setPopularLoading(false);
      }
    };

    loadSettings();
    loadDeliverySettings();
    loadPopularSettings();
  }, []);

  const toggleDeliveryService = (key) => {
    setDeliveryMessage("");
    setDeliveryServices((prev) =>
      prev.map((service) => (service.key === key ? { ...service, enabled: !service.enabled } : service)),
    );
  };

  const handleDeliverySubmit = async (event) => {
    event.preventDefault();
    setDeliveryMessage("");
    setDeliveryError("");
    setDeliveryLoading(true);

    try {
      const services = Object.fromEntries(deliveryServices.map((service) => [service.key, service.enabled]));
      const response = await api.put("/admin/settings/delivery", { services });
      setDeliveryServices(response.data.services || []);
      setDeliveryMessage("Службы доставки сохранены");
    } catch (requestError) {
      setDeliveryError(requestError.response?.data?.message || "Не удалось сохранить службы доставки");
    } finally {
      setDeliveryLoading(false);
    }
  };

  const productsById = new Map(allProducts.map((product) => [product._id, product]));
  const availableToAdd = allProducts.filter((product) => !popularIds.includes(product._id));

  const changePopular = (updater) => {
    setPopularMessage("");
    setPopularIds(updater);
  };

  const addPopular = () => {
    if (!popularToAdd) return;
    changePopular((prev) => (prev.length >= popularMax ? prev : [...prev, popularToAdd]));
    setPopularToAdd("");
  };

  const movePopular = (index, shift) => {
    changePopular((prev) => {
      const target = index + shift;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePopular = (id) => {
    changePopular((prev) => prev.filter((item) => item !== id));
  };

  const handlePopularSubmit = async (event) => {
    event.preventDefault();
    setPopularMessage("");
    setPopularError("");
    setPopularLoading(true);

    try {
      const response = await api.put("/admin/settings/popular", { productIds: popularIds });
      setPopularIds(response.data.productIds || []);
      setPopularMessage("Популярные сорта сохранены");
    } catch (requestError) {
      setPopularError(requestError.response?.data?.message || "Не удалось сохранить популярные сорта");
    } finally {
      setPopularLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedPercent = Number(bonusPercent);
    const normalizedReviewBonus = Math.floor(Number(reviewBonusAmount));
    const normalizedSamplerSize = Math.floor(Number(samplerSizeGrams));

    if (!Number.isFinite(normalizedPercent) || normalizedPercent < 0) {
      setError("Введите процент не меньше 0");
      return;
    }

    if (!Number.isFinite(normalizedReviewBonus) || normalizedReviewBonus < 0) {
      setError("Введите бонус за отзыв не меньше 0");
      return;
    }

    if (!Number.isFinite(normalizedSamplerSize) || normalizedSamplerSize <= 0) {
      setError("Введите размер пробника больше 0 грамм");
      return;
    }

    setLoading(true);
    try {
      const response = await api.put("/admin/settings/bonuses", {
        bonusPercent: normalizedPercent,
        reviewBonusAmount: normalizedReviewBonus,
        samplerSizeGrams: normalizedSamplerSize,
        notificationEmail,
      });
      setBonusPercent(String(response.data.bonusPercent ?? 0));
      setReviewBonusAmount(String(response.data.reviewBonusAmount ?? 0));
      setSamplerSizeGrams(String(response.data.samplerSizeGrams ?? 20));
      setNotificationEmail(response.data.notificationEmail || "");
      setMessage("Настройки сохранены");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось сохранить настройки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ap-settings-page">
      <h1>Настройки</h1>
      <form className="form-group" onSubmit={handleSubmit}>
        <label>Процент начисления бонусов</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={bonusPercent}
          onChange={(event) => setBonusPercent(event.target.value)}
          disabled={loading}
        />
        <small className="hint">
          Бонусы начисляются только на стоимость товаров. Если процент больше 0,
          клиент дополнительно получает +1 бонус за завершённый заказ.
        </small>
        <label>Бонусы за одобренный отзыв</label>
        <input
          type="number"
          min="0"
          step="1"
          value={reviewBonusAmount}
          onChange={(event) => setReviewBonusAmount(event.target.value)}
          disabled={loading}
        />
        <label>Email для уведомлений</label>
        <input
          type="email"
          value={notificationEmail}
          onChange={(event) => setNotificationEmail(event.target.value)}
          disabled={loading}
          placeholder="admin@example.com"
        />
        <small className="hint">
          На этот адрес приходят уведомления о новых сообщениях, заказах, отменах и отзывах на модерации.
        </small>
        <label>Размер пробника, г</label>
        <input
          type="number"
          min="1"
          step="1"
          value={samplerSizeGrams}
          onChange={(event) => setSamplerSizeGrams(event.target.value)}
          disabled={loading}
        />
        <small className="hint">
          Этот размер используется на сайте, в корзине и при проверке заказа.
        </small>
        {error && <p className="error">{error}</p>}
        {message && <p className="success-message">{message}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Сохранение..." : "Сохранить"}
        </button>
      </form>

      <h2>Популярное на главной</h2>
      <form className="form-group" onSubmit={handlePopularSubmit}>
        {popularIds.length > 0 ? (
          <ol className="ap-popular-list">
            {popularIds.map((id, index) => {
              const product = productsById.get(id);
              return (
                <li key={id} className="ap-popular-item">
                  <span className="ap-popular-name">
                    {product?.name || "Товар не найден"}
                    {product && product.remains <= 0 && (
                      <small className="hint"> — нет в наличии, на главной не показывается</small>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => movePopular(index, -1)}
                    disabled={popularLoading || index === 0}
                    aria-label="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => movePopular(index, 1)}
                    disabled={popularLoading || index === popularIds.length - 1}
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removePopular(id)}
                    disabled={popularLoading}
                    aria-label="Убрать"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="hint">Сорта не выбраны — на главной показываются первые 4 товара в наличии.</p>
        )}
        {popularIds.length < popularMax && (
          <div className="ap-popular-add">
            <select
              value={popularToAdd}
              onChange={(event) => setPopularToAdd(event.target.value)}
              disabled={popularLoading}
            >
              <option value="">Выберите сорт…</option>
              {availableToAdd.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                  {product.remains <= 0 ? " (нет в наличии)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addPopular}
              disabled={popularLoading || !popularToAdd}
            >
              Добавить
            </button>
          </div>
        )}
        <small className="hint">
          До {popularMax} сортов, в указанном порядке. Товары без фото или без остатка на главной не показываются.
        </small>
        {popularError && <p className="error">{popularError}</p>}
        {popularMessage && <p className="success-message">{popularMessage}</p>}
        <button type="submit" className="btn btn-primary" disabled={popularLoading}>
          {popularLoading ? "Сохранение..." : "Сохранить"}
        </button>
      </form>

      <h2>Службы доставки</h2>
      <form className="form-group" onSubmit={handleDeliverySubmit}>
        {deliveryServices.map((service) => (
          <label key={service.key} className="ap-delivery-service">
            <input
              type="checkbox"
              checked={service.enabled}
              onChange={() => toggleDeliveryService(service.key)}
              disabled={deliveryLoading}
            />{" "}
            {service.name}
            {!service.configured && (
              <small className="hint"> — не заданы ключи API на сервере, покупатели её не увидят</small>
            )}
          </label>
        ))}
        <small className="hint">
          Отключённые службы не показываются при оформлении заказа. Ключи API служб хранятся на сервере в backend/.env.
        </small>
        {deliveryError && <p className="error">{deliveryError}</p>}
        {deliveryMessage && <p className="success-message">{deliveryMessage}</p>}
        <button type="submit" className="btn btn-primary" disabled={deliveryLoading}>
          {deliveryLoading ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </section>
  );
};

export default SettingsPage;
