import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";

const ThankYouPage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const updateOrderStatus = async () => {
      try {
        const orderId = location.state?.orderId;
        if (orderId) {
          const token = localStorage.getItem("token");
          await axios.put(
            `/api/orders/${orderId}/status`,
            { status: "paid" },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }
      } catch (err) {
        console.error("Ошибка обновления статуса заказа:", err);
        setError("Не удалось обновить статус заказа");
      } finally {
        setLoading(false);
      }
    };

    updateOrderStatus();
  }, [location.state]);

  if (loading) {
    return (
      <div className="typ-thank-you-page container">
        <div className="typ-thank-you-content">
          <p>Обработка заказа...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="typ-thank-you-page container">
      <div className="typ-thank-you-content">
        <h1>Спасибо за заказ!</h1>
        <p>
          Ваш заказ успешно оформлен и оплачен. Мы свяжемся с вами в ближайшее
          время.
        </p>
        {error && <p className="typ-error">{error}</p>}
        <Link to="/" className="typ-btn btn btn-primary">
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
};

export default ThankYouPage;
