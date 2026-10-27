import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { DeliveryWidget } from "../components/DeliveryWidget";
import api from "../services/api";
import { clearReferralCode, getReferralCode } from "../utils/referral";


const DADATA_TOKEN = "eb5a9b17d07d3320d19d665bc0ade765f3f016d3";
const YANDEX_API_KEY = "d748d3d0-760c-44fa-923c-d865d6017c60";


const normalizePromoInput = (value) => value.toUpperCase().replace(/\s+/g, "");

// Та же формула, что на сервере: скидка только на товары и не до нуля.
const calculatePromoDiscount = (promo, itemsTotal) => {
  if (!promo || itemsTotal <= 0) return 0;
  const value = Number(promo.discountValue) || 0;
  const discount =
    promo.discountType === "fixed" ? value : Math.floor((itemsTotal * Math.min(value, 100)) / 100);
  return Math.max(0, Math.min(Math.floor(discount), Math.ceil(itemsTotal) - 1));
};

// const PAYMENT_OPTIONS = [
//   { value: "card", label: "Картой онлайн" },
// ];

const CheckoutPage = () => {
  const { cartItems, totalPrice, clearCart } = useContext(CartContext);
  const { user, token, updateUser, openLoginModal } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [deliveryData, setDeliveryData] = useState(null);
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  const [refundPolicyAccepted, setRefundPolicyAccepted] = useState(false);
  const [bonusPercent, setBonusPercent] = useState(0);
  const [bonusSpent, setBonusSpent] = useState(0);
  const [withoutPayment, setWithoutPayment] = useState(false);
  const [withoutDeliveryPayment, setWithoutDeliveryPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const canPay = Boolean(
    deliveryData?.checked && personalDataAccepted && refundPolicyAccepted,
  );

  const totalWeight = cartItems
    .filter((item) => (item.unit || "grams") === "grams")
    .reduce((sum, item) => sum + item.count, 0);
  const userBonusBalance = Number(user?.bonusBalance) || 0;
  const promoDiscount = user ? calculatePromoDiscount(appliedPromo, totalPrice) : 0;
  const discountedItemsTotal = Math.max(0, totalPrice - promoDiscount);
  const maxBonusSpent = Math.min(userBonusBalance, Math.floor(discountedItemsTotal * 0.5));
  const requestedBonusSpent = Math.floor(Number(bonusSpent) || 0);
  const normalizedBonusSpent = Math.min(requestedBonusSpent, maxBonusSpent);
  const deliveryPrice = deliveryData?.price || 0;
  const finalTotal = Math.max(0, discountedItemsTotal - normalizedBonusSpent) + deliveryPrice;
  const expectedBonusEarned = useMemo(() => {
    const percent = Number(bonusPercent) || 0;

    if (!user || percent <= 0) {
      return 0;
    }

    return Math.floor(discountedItemsTotal * (percent / 100)) + 1;
  }, [bonusPercent, discountedItemsTotal, user]);

  useEffect(() => {
    fetch("/api/bonus-settings")
      .then((response) => response.json())
      .then((data) => setBonusPercent(Number(data.bonusPercent) || 0))
      .catch(() => setBonusPercent(0));
  }, []);

  const handleApplyPromo = async (event) => {
    event.preventDefault();
    const code = normalizePromoInput(promoInput);
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoError("");
    try {
      const response = await api.post("/orders/promo/check", { code, itemsTotal: totalPrice });
      setAppliedPromo(response.data);
      addToast(`Промокод ${response.data.code} применён`, "success");
    } catch (error) {
      setAppliedPromo(null);
      setPromoError(error.response?.data?.message || "Не удалось проверить промокод");
    } finally {
      setPromoChecking(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
  };

  // Оформление заказа
  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setOrderError("");
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
          price: withoutDeliveryPayment ? 0 : deliveryData?.price || 0,
          provider: deliveryData?.service || "",
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
        promoCode: user && appliedPromo ? appliedPromo.code : undefined,
        referralCode: getReferralCode() || undefined,
        withoutPayment: Boolean(user?.isAdmin && withoutPayment),
        withoutDeliveryPayment: Boolean(user?.isAdmin && withoutDeliveryPayment),
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
      clearReferralCode();
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

      if (user?.isAdmin && withoutPayment) {
        await clearCart();
        addToast("Тестовый заказ оформлен и отмечен оплаченным", "success");

        await fetch("/api/test", {
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

        navigate("/thank-you", { state: { withoutPayment: true, orderId: order.id } });
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
       
      // sessionStorage.setItem(
      //   "lastPayment",
      //   JSON.stringify({
      //     id: order.id,
      //     PaymentId: paymentResponse.PaymentId,
      //   })
      // );

      await clearCart();
      window.location.href = paymentResponse.paymentUrl;

    } catch (error) {
      addToast(error.message, "error");
      setOrderError(error.message);
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingSteps = [
    !deliveryData?.checked && "подтвердите способ и адрес доставки",
    !personalDataAccepted && "примите политику обработки персональных данных",
    !refundPolicyAccepted && "примите политику возврата средств",
  ].filter(Boolean);

  return (
    <div className="chp-checkout-page container">
      <h1>Оформление заказа</h1>
      <ol className="chp-steps" aria-label="Шаги оформления заказа">
        <li className="chp-step chp-step--done">Корзина</li>
        <li className={`chp-step ${deliveryData?.checked ? "chp-step--done" : "chp-step--current"}`}>
          Доставка
        </li>
        <li
          className={`chp-step ${
            deliveryData?.checked && !canPay ? "chp-step--current" : canPay ? "chp-step--done" : ""
          }`}
        >
          Согласия
        </li>
        <li className={`chp-step ${canPay ? "chp-step--current" : ""}`}>Оплата</li>
      </ol>
      <div className="chp-checkout-content">
        <div className="chp-order-summary">
          <h2>Ваш заказ</h2>
          <ul>
            {cartItems.map((item) => {
              const isGrams = (item.unit || "grams") === "grams";
              const unitLabel = isGrams ? "г" : "шт";
              const priceLabel = isGrams
                ? `${Math.round(item.price * 100 * 100) / 100} ₽ за 100 г`
                : `${item.price} ₽ за шт`;
              return (
                <li key={`${item.pid}-${item.isSampler}`}>
                  {item.name} {item.isSampler && "(Пробник)"} — {item.count} {unitLabel} ×{" "}
                  {priceLabel} = {Math.round(item.count * item.price * 100) / 100} ₽
                </li>
              );
            })}
          </ul>
          <div className="chp-summary-total">
            <strong>
              Сумма товаров:{" "}
              {promoDiscount > 0 ? (
                <>
                  <s className="chp-price-old">{totalPrice} ₽</s>{" "}
                  <span className="chp-price-new">{discountedItemsTotal} ₽</span>
                </>
              ) : (
                `${totalPrice} ₽`
              )}
            </strong>
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

        <DeliveryWidget
          DADATA_TOKEN={DADATA_TOKEN}
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
                {promoDiscount > 0 ? (
                  <span>
                    <s className="chp-price-old">{totalPrice} ₽</s>{" "}
                    <span className="chp-price-new">{discountedItemsTotal} ₽</span>
                  </span>
                ) : (
                  <span>{totalPrice} ₽</span>
                )}
              </div>
              {Boolean(deliveryData?.price) && (
                <div>
                  <span>Доставка: </span>
                  <span>{deliveryData.price} ₽</span>
                </div>
              )}
              <div className="chp-promo-control">
                {user ? (
                  appliedPromo ? (
                    <div className="chp-promo-applied">
                      <span>
                        Промокод <strong>{appliedPromo.code}</strong>
                        {promoDiscount > 0 ? `: -${promoDiscount} ₽` : " применён"}
                      </span>
                      <button type="button" className="chp-promo-remove" onClick={handleRemovePromo}>
                        Убрать
                      </button>
                    </div>
                  ) : (
                    <form className="chp-promo-form" onSubmit={handleApplyPromo}>
                      <label htmlFor="promoCode">Промокод:</label>
                      <div>
                        <input
                          id="promoCode"
                          type="text"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck="false"
                          value={promoInput}
                          onChange={(event) => {
                            setPromoInput(normalizePromoInput(event.target.value));
                            setPromoError("");
                          }}
                          placeholder="ВВЕДИТЕ КОД"
                          aria-invalid={Boolean(promoError)}
                          aria-describedby={promoError ? "promoCodeError" : undefined}
                        />
                        <button
                          type="submit"
                          className="btn btn-secondary"
                          disabled={!promoInput || promoChecking}
                        >
                          {promoChecking ? "…" : "Применить"}
                        </button>
                      </div>
                      {promoError && (
                        <small id="promoCodeError" className="chp-promo-error" role="alert">
                          {promoError}
                        </small>
                      )}
                    </form>
                  )
                ) : (
                  <small>
                    Есть промокод?{" "}
                    <button type="button" className="chp-promo-login" onClick={openLoginModal}>
                      Войдите
                    </button>
                    , чтобы применить его.
                  </small>
                )}
              </div>
              {user && (
                <div className="chp-bonus-control">
                  <label htmlFor="bonusSpent">Списать бонусы:</label>
                  <input
                    id="bonusSpent"
                    type="number"
                    min="0"
                    max={maxBonusSpent}
                    step="1"
                    inputMode="numeric"
                    aria-describedby="bonusSpentHint"
                    value={bonusSpent}
                    onChange={(event) => setBonusSpent(event.target.value)}
                  />
                  <small id="bonusSpentHint">
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
                  {user?.isAdmin && withoutPayment ? "Тестовый заказ" : "Картой"}
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
                  checked={withoutPayment}
                  onChange={(event) => setWithoutPayment(event.target.checked)}
                />
                <span>Без оплаты</span>
              </label>
            )}

            {user?.isAdmin && (
              <label className="chp-policy-consent">
                <input
                  type="checkbox"
                  checked={withoutDeliveryPayment}
                  onChange={(event) => setWithoutDeliveryPayment(event.target.checked)}
                />
                <span>Без оплаты доставки</span>
              </label>
            )}

            <p>
              Если оформляете заказ до 17:00 по МСК, то он будет отправлен в тот же день. Трэк-номер заказа вы получите по почте.
              Также вы можете посмотреть статус заказа в личном кабинете.
            </p>

            {pendingSteps.length > 0 && (
              <p className="chp-pending" id="chp-pending">
                Чтобы оплатить: {pendingSteps.join("; ")}.
              </p>
            )}
            {orderError && (
              <p className="chp-order-error" role="alert">
                {orderError}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary chp-btn-large"
              disabled={!canPay || isSubmitting}
              aria-describedby={pendingSteps.length > 0 ? "chp-pending" : undefined}
              onClick={handlePlaceOrder}
            >
              {isSubmitting ? "Оформляем заказ…" : `Оплатить ${finalTotal} ₽`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
