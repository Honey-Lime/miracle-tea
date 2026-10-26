import { useEffect, useState } from "react";
import api from "../../services/api";

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

    loadSettings();
    loadDeliverySettings();
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
