import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { EShopLogistic } from "../components/EShopLogistic";
// import { EShopLogistic } from "eshoplogistic-react/client";
// import "eshoplogistic-react/styles.css";


const DADATA_TOKEN = "eb5a9b17d07d3320d19d665bc0ade765f3f016d3";
const ESHOPLOGISTIC_TOKEN = "df616893f983b20fed6ac71e5f6cb9f2";
const YANDEX_API_KEY = "d748d3d0-760c-44fa-923c-d865d6017c60";


// const PAYMENT_OPTIONS = [
//   { value: "card", label: "Картой онлайн" },
// ];

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user, token, updateUser } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [deliveryData, setDeliveryData] = useState(null);
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);
  const [bonusPercent, setBonusPercent] = useState(0);
  const [bonusSpent, setBonusSpent] = useState(0);
  const [testOrder, setTestOrder] = useState(false);
  const canPay = Boolean(
    deliveryData?.checked && personalDataAccepted && refundPolicyAccepted,
  );

  const totalWeight = cartItems
    .filter((item) => (item.unit || "grams") === "grams")
    .reduce((sum, item) => sum + item.count, 0);
  const userBonusBalance = Number(user?.bonusBalance) || 0;
  const maxBonusSpent = Math.min(userBonusBalance, Math.floor(totalPrice * 0.5));
  const requestedBonusSpent = Math.floor(Number(bonusSpent) || 0);
  const normalizedBonusSpent = Math.min(requestedBonusSpent, maxBonusSpent);
  const deliveryPrice = deliveryData?.price || 0;
  const finalTotal = Math.max(0, totalPrice - normalizedBonusSpent) + deliveryPrice;
  const expectedBonusEarned = useMemo(() => {
    const percent = Number(bonusPercent) || 0;

    if (!user || percent <= 0) {
      return 0;
    }

    return Math.floor(totalPrice * (percent / 100)) + 1;
  }, [bonusPercent, totalPrice, user]);

  useEffect(() => {
    fetch("/api/bonus-settings")
      .then((response) => response.json())
      .then((data) => setBonusPercent(Number(data.bonusPercent) || 0))
      .catch(() => setBonusPercent(0));
  }, []);

  // Оформление заказа
  const handlePlaceOrder = async () => {
    try {
      if (!cartItems.length) {
        addToast("Корзина пуста", "warning");
        return;
      }

      if (!deliveryData?.checked) {
        addToast("Подтвердите способ и адрес доставки", "warning");
        return;
      }

      if (!personalDataAccepted || !refundPolicyAccepted) {
        addToast("Перед оплатой нужно принять обе политики", "warning");
        return;
      }

      if (normalizedBonusSpent !== requestedBonusSpent) {
        addToast(`Можно списать не более ${maxBonusSpent} бонусов`, "warning");
        return;
      }

      const cartItemsWithDetails = cartItems.map((item) => ({
        pid: item.pid,
        count: item.count,
        isSampler: item.isSampler,
      }));

      // console.log('cartItemsWithDetails', cartItemsWithDetails);
      

      const orderData = {
        customerType: user && token ? "user" : "guest",
        userId: user?.id || user?._id || null,
        list: cartItemsWithDetails,
        delivery: {
          address: deliveryData?.address || null,
          price: deliveryData?.price || 0,
          provider: deliveryData?.service || "eshop",
          did: deliveryData?.code || "",
          details: deliveryData,
        },
        consents: {
          personalData: personalDataAccepted,
          refundPolicy: refundPolicyAccepted,
          acceptedAt: new Date().toISOString(),
        },
        bonuses: {
          spent: normalizedBonusSpent,
        },
        testOrder: Boolean(user?.isAdmin && testOrder),
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(orderData),
      });


      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Ошибка при оформлении заказа");
      }

      const order = await response.json();
      if (normalizedBonusSpent > 0) {
        updateUser({
          ...user,
          bonusBalance: Math.max(0, userBonusBalance - normalizedBonusSpent),
        });
      }

      // await fetch("/api/test", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     ...(token ? { Authorization: `Bearer ${token}` } : {}),
      //   },
      //   body: JSON.stringify({
      //     id: order.id,
      //     deliveryData: deliveryData
      //   }),
      // });

      if (user?.isAdmin && testOrder) {
        await clearCart();
        addToast("Тестовый заказ оформлен и отмечен оплаченным", "success");
        navigate("/thank-you", { state: { testOrder: true, orderId: order.id } });
        return;
      }

      const payment = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: order.id,
          deliveryData: deliveryData
        }),
      });

      if (!payment.ok) {
        const error = await payment.json();
        throw new Error(error.message || "Ошибка при оплате");
      }
      
      addToast("Заказ успешно оформлен!", "success");
      const paymentResponse = await payment.json();
       
      sessionStorage.setItem(
        "lastPayment",
        JSON.stringify({
          id: order.id,
          paymentId: paymentResponse.paymentId,
        })
      );
      window.location.href = paymentResponse.paymentUrl;



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
            {cartItems.map((item) => {
              const isGrams = (item.unit || "grams") === "grams";
              const unitLabel = isGrams ? "г" : "шт";
              const priceLabel = isGrams
                ? `${item.price * 10} ₽/10г`
                : `${item.price} ₽/шт`;
              return (
                <li key={`${item.pid}-${item.isSampler}`}>
                  {item.name} {item.isSampler && "(Пробник)"} — {item.count} {unitLabel} ×{" "}
                  {priceLabel} = {item.count * item.price} ₽
                </li>
              );
            })}
          </ul>
          <div className="chp-summary-total">
            <strong>Сумма товаров: {totalPrice} ₽</strong>
            <br />
            <small>Общий вес: {totalWeight} г</small>
            {user && (
              <>
                <br />
                <small>Будет начислено бонусов: {expectedBonusEarned}</small>
              </>
            )}
          </div>
        </div>

        <EShopLogistic
          DADATA_TOKEN={DADATA_TOKEN}
          ESHOPLOGISTIC_TOKEN={ESHOPLOGISTIC_TOKEN}
          YANDEX_API_KEY={YANDEX_API_KEY}
          orderWeight={totalWeight / 1000}

          // получаем выходные данные в state deliveryData
          // data.checked true если есть все данные для создания заказа
          onDeliveryConfirm={(data) => {
            setDeliveryData(data);
            // console.log(data);
          }}
        />

        <div className="chp-checkout-sidebar">
          <div className="chp-final-total">
            <h2>Итого к оплате</h2>
            <div className="chp-total-breakdown">
              <div>
                <span>Товары: </span>
                <span>{totalPrice} ₽</span>
              </div>
              {deliveryData?.price && (
                <div>
                  <span>Доставка: </span>
                  <span>{deliveryData.price} ₽</span>
                </div>
              )}
              {user && (
                <div className="chp-bonus-control">
                  <label htmlFor="bonusSpent">Списать бонусы:</label>
                  <input
                    id="bonusSpent"
                    type="number"
                    min="0"
                    max={maxBonusSpent}
                    step="1"
                    value={bonusSpent}
                    onChange={(event) => setBonusSpent(event.target.value)}
                  />
                  <small>
                    Доступно: {userBonusBalance}. Можно списать до {maxBonusSpent} бонусов
                  </small>
                </div>
              )}
              {normalizedBonusSpent > 0 && (
                <div>
                  <span>Списание бонусов: </span>
                  <span>-{normalizedBonusSpent} ₽</span>
                </div>
              )}
              {user && (
                <div>
                  <span>Начислится бонусов: </span>
                  <span>{expectedBonusEarned}</span>
                </div>
              )}
              <div>
                <span>Оплата:</span>
                <span>
                  {user?.isAdmin && testOrder ? "Тестовый заказ" : "Картой"}
                  {/* {PAYMENT_OPTIONS.find(
                    (option) => option.value === paymentMethod,
                  )?.label || "Не выбрано"} */}
                </span>
              </div>
              <div className="chp-grand-total">
                Всего: {finalTotal} ₽
              </div>
            </div>

            <div className="chp-policy-consents" aria-label="Обязательные согласия">
              <label className="chp-policy-consent">
                <input
                  type="checkbox"
                  checked={personalDataAccepted}
                  onChange={(event) => setPersonalDataAccepted(event.target.checked)}
                />
                <span>
                  Я согласен(на) с{" "}
                  <Link to="/personal-data-policy" target="_blank" rel="noopener noreferrer">
                    политикой обработки персональных данных
                  </Link>
                </span>
              </label>

              <label className="chp-policy-consent">
                <input
                  type="checkbox"
                  checked={refundPolicyAccepted}
                  onChange={(event) => setRefundPolicyAccepted(event.target.checked)}
                />
                <span>
                  Я согласен(на) с{" "}
                  <Link to="/refund-policy" target="_blank" rel="noopener noreferrer">
                    политикой возврата средств
                  </Link>
                </span>
              </label>
            </div>

            {user?.isAdmin && (
              <label className="chp-policy-consent">
                <input
                  type="checkbox"
                  checked={testOrder}
                  onChange={(event) => setTestOrder(event.target.checked)}
                />
                <span>Тестовый заказ</span>
              </label>
            )}

            <button
              className="btn btn-primary chp-btn-large"
              disabled={!canPay}
              onClick={()=> {
                if (canPay) {
                  handlePlaceOrder();
                } else {
                  addToast("Подтвердите доставку и примите обе политики", "warning");
                }
              }}
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
