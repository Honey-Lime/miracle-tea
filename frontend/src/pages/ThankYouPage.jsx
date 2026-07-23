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

    // if (location.state?.withoutPayment) {
    //   setLoading(false);
    //   return;
    // }
    setLoading(false);
  
    // const handleSuccessfulPaymentReturn = async () => {
    //   try {
    //     // const lastPayment = JSON.parse(sessionStorage.getItem("lastPayment") || "null");

    //     // if (!lastPayment?.id || !lastPayment?.PaymentId) {
    //     //   setError("Не удалось найти данные платежа. Если оплата прошла, заказ обновится после уведомления банка.");
    //     //   return;
    //     // }

    //     // const response = await fetch("/api/check-payment", {
    //     //   method: "POST",
    //     //   headers: {
    //     //     "Content-Type": "application/json",
    //     //   },
    //     //   body: JSON.stringify(lastPayment),
    //     // });

    //     // const result = await response.json();

    //     // if (!response.ok) {
    //     //   throw new Error(result.error || "Не удалось проверить статус оплаты");
    //     // }

    //     // if (!result.paid) {
    //     //   setError("Оплата ещё не подтверждена банком. Корзина пока не очищена.");
    //     //   return;
    //     // }

    //     await clearCart();
    //     // sessionStorage.removeItem("lastPayment");
    //   } catch (err) {
    //     console.error("Ошибка обработки оплаты:", err);
    //     setError(err.message || "Не удалось обработать оплату.");
    //   } finally {
    //     setLoading(false);
    //   }
    // };

    // handleSuccessfulPaymentReturn();
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
          Ваш заказ успешно оформлен и оплачен. ID заказа в системе доставки отправлен Вам по почте.
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
