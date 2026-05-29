import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

const ThankYouPage = () => {
  const location = useLocation();
  const { clearCart } = useCart();
  const clearStartedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (clearStartedRef.current) {
      return;
    }

    clearStartedRef.current = true;

    const handleSuccessfulPaymentReturn = async () => {
      try {
        await clearCart();
      } catch (err) {
        console.error("Ошибка очистки корзины:", err);
        setError("Оплата прошла, но не удалось очистить корзину.");
      } finally {
        setLoading(false);
      }
    };

    handleSuccessfulPaymentReturn();
  }, [clearCart, location.state]);

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
