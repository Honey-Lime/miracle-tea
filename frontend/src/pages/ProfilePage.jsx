import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { cancelOrder, getMyOrders } from "../services/orderService";
import { changePassword, updateName } from "../services/authService";

const PasswordEyeIcon = ({ isOpen }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {isOpen ? (
      <>
        <path
          d="M2.5 12C4.5 7.8 7.7 5.7 12 5.7C16.3 5.7 19.5 7.8 21.5 12C19.5 16.2 16.3 18.3 12 18.3C7.7 18.3 4.5 16.2 2.5 12Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </>
    ) : (
      <>
        <path
          d="M3 12C5.1 15.2 8.1 16.8 12 16.8C15.9 16.8 18.9 15.2 21 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6.5 15.2L5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 16.6L9.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 16.6L14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.5 15.2L19 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    )}
  </svg>
);

const ProfilePage = () => {
  const { user, logout, updateUser, openForgotPasswordModal } = useContext(AuthContext);
  const { addToCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reviewOpportunities, setReviewOpportunities] = useState([]);
  const [reviewBonusAmount, setReviewBonusAmount] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewOpportunity, setSelectedReviewOpportunity] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [nameValue, setNameValue] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const getStatusLabel = (status) => {
    const labels = {
      created: "Создан",
      paid: "Оплачен",
      assembled: "Собран",
      shipped: "Отправлен",
      completed: "Завершен",
      cancelled: "Отменен",
      refunded: "Возврат совершен",
      cart: "Корзина",
      payment_pending: "Ожидает оплаты",
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    const classes = {
      created: "prfp-status-ordered",
      paid: "prfp-status-paid",
      assembled: "prfp-status-shipped",
      shipped: "prfp-status-shipped",
      completed: "prfp-status-completed",
      cancelled: "prfp-status-cancelled",
      refunded: "prfp-status-completed",
      cart: "prfp-status-cart",
      payment_pending: "prfp-status-cart",
    };
    return classes[status] || "";
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setOrderModalOpen(true);
  };

  const loadReviewOpportunities = async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/reviews/my-opportunities", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();

      if (response.ok) {
        setReviewOpportunities(data.opportunities || []);
        setReviewBonusAmount(data.reviewBonusAmount || 0);
      }
    } catch (error) {
      console.error("Не удалось загрузить уведомления об отзывах", error);
    }
  };

  const canCancelOrder = (order) => order.status === "paid";

  const handleCancelOrder = async (id) => {
    if (!window.confirm("Отменить заказ?")) {
      return;
    }

    try {
      const response = await cancelOrder(id);
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === id ? { ...order, status: response.data.status } : order,
        ),
      );

      if (selectedOrder?.id === id) {
        setSelectedOrder((prev) => ({ ...prev, status: response.data.status }));
      }
    } catch (error) {
      alert(error.response?.data?.message || "Не удалось отменить заказ");
    }
  };

  const getRepeatOrderCount = (item) => {
    const product = item.pid;
    if (!product) {
      return 0;
    }

    const remains = Number(product.remains) || 0;
    if (remains <= 0) {
      return 0;
    }

    if (item.isSampler) {
      return remains >= 10 ? 10 : 0;
    }

    const unit = product.unit || "grams";
    const minCount = unit === "grams" ? 50 : 1;
    const requestedCount = Number(item.count) || 0;
    const availableCount = Math.min(requestedCount, remains);

    return availableCount >= minCount ? availableCount : 0;
  };

  const handleRepeatOrder = async (order) => {
    const itemsToAdd = (order.list || [])
      .map((item) => ({
        item,
        count: getRepeatOrderCount(item),
      }))
      .filter(({ count }) => count > 0);

    if (itemsToAdd.length === 0) {
      alert("В заказе нет товаров, доступных для повторного добавления в корзину");
      return;
    }

    for (const { item, count } of itemsToAdd) {
      const product = item.pid;
      await addToCart(
        {
          ...product,
          _id: product._id || product.id,
        },
        count,
        item.isSampler || false,
      );
    }

    if (itemsToAdd.length < (order.list || []).length) {
      alert(
        "Корзина обновлена. Некоторые товары не добавлены, потому что их нет в наличии или доступного остатка меньше минимального количества.",
      );
    }
  };

  const formatPrice = (price) => {
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  const paidTotalStatuses = ["paid", "assembled", "shipped", "completed"];
  const paidOrdersTotal = orders
    .filter((order) => paidTotalStatuses.includes(order.status))
    .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  const getDeliveryDetails = (order) => {
    const delivery = order?.delivery || {};
    const details = delivery.details || {};
    const address = delivery.address || details.address || {};

    return {
      name: details.name || delivery.name || "",
      phone: details.phone || delivery.phone || "",
      address:
        address.address ||
        address.fullAddress ||
        address.value ||
        (typeof address === "string" ? address : ""),
      room: details.room || delivery.room || "",
      comment: details.comment || delivery.comment || "",
      price: Number(delivery.price || details.price || 0),
    };
  };

  useEffect(() => {
    if (user) {
      setNameValue(user.name || "");
      getMyOrders()
        .then((res) => {
          // Исключаем корзину и временные заказы, ожидающие подтверждения оплаты.
          const completedOrders = res.data.filter(
            (order) => !["cart", "payment_pending"].includes(order.status),
          );
          setOrders(completedOrders);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Ошибка загрузки заказов:", err);
          setLoading(false);
        });
    }
  }, [user]);

  useEffect(() => {
    loadReviewOpportunities();
  }, [user]);

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setReviewError("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...selectedReviewOpportunity,
          text: reviewText,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Не удалось отправить отзыв");
      }

      setReviewOpportunities((prev) =>
        prev.filter(
          (item) =>
            !(
              item.orderId === selectedReviewOpportunity.orderId &&
              item.productId === selectedReviewOpportunity.productId &&
              item.isSampler === selectedReviewOpportunity.isSampler
            ),
        ),
      );
      setReviewModalOpen(false);
      setReviewText("");
      setSelectedReviewOpportunity(null);
    } catch (error) {
      setReviewError(error.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Новые пароли не совпадают");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("Пароль должен быть не менее 6 символов");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordSuccess("Пароль успешно изменён");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || "Ошибка при смене пароля",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const togglePasswordField = (field) => {
    setShowPasswordFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleNameChange = async (e) => {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");

    const normalizedName = nameValue.trim();
    if (!normalizedName) {
      setNameError("Имя не может быть пустым");
      return;
    }

    setNameLoading(true);
    try {
      const response = await updateName(normalizedName);
      updateUser(response.data);
      setNameSuccess("Имя успешно изменено");
      setTimeout(() => {
        setNameModalOpen(false);
        setNameSuccess("");
      }, 1500);
    } catch (error) {
      setNameError(error.response?.data?.message || "Ошибка при смене имени");
    } finally {
      setNameLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="prfp-profile-page container">
        <h1>Личный кабинет</h1>
        <p>Войдите, чтобы увидеть свои заказы.</p>
      </div>
    );
  }

  return (
    <div className="prfp-profile-page container">
      <h1>Личный кабинет</h1>
      <div className="prfp-profile-info">
        <h2>Привет, {user.name}!</h2>
        <p>Email: {user.email}</p>
        <p>Общая сумма покупок: {formatPrice(paidOrdersTotal)}</p>
        <p className="prfp-bonus-balance">
          Бонусов на балансе: <strong>{Number(user.bonusBalance) || 0}</strong>
        </p>
        <div className="prfp-profile-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setNameValue(user.name || "");
              setNameModalOpen(true);
            }}
          >
            Изменить имя
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setPasswordModalOpen(true)}
          >
            Сменить пароль
          </button>
          <button className="btn btn-secondary" onClick={logout}>
            Выйти
          </button>
        </div>
      </div>

      <div className="prfp-notifications">
        <h2>Уведомления</h2>
        {reviewOpportunities.length === 0 ? (
          <p>Новых уведомлений нет.</p>
        ) : (
          reviewOpportunities.map((item) => (
            <div className="prfp-notification-item" key={`${item.orderId}-${item.productId}-${item.isSampler}`}>
              <span>Вам понравился {item.productName}?</span>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setSelectedReviewOpportunity(item);
                  setReviewText("");
                  setReviewError("");
                  setReviewModalOpen(true);
                }}
              >
                Оставить отзыв +{reviewBonusAmount} Бонусов
              </button>
            </div>
          ))
        )}
      </div>

      {reviewModalOpen && selectedReviewOpportunity && (
        <div className="modal-overlay" onClick={() => setReviewModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prfp-modal-header">
              <h2>Отзыв о {selectedReviewOpportunity.productName}</h2>
              <button className="prfp-modal-close" onClick={() => setReviewModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitReview}>
              <div className="form-group">
                <label>Текст отзыва</label>
                <textarea
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  rows={5}
                  required
                />
              </div>
              {reviewError && <div className="error-message">{reviewError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setReviewModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">Отправить на модерацию</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно смены имени */}
      {nameModalOpen && (
        <div className="modal-overlay" onClick={() => setNameModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prfp-modal-header">
              <h2>Смена имени</h2>
              <button
                className="prfp-modal-close"
                onClick={() => setNameModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleNameChange}>
              <div className="form-group">
                <label>Новое имя</label>
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  required
                />
              </div>
              {nameError && <div className="error-message">{nameError}</div>}
              {nameSuccess && <div className="success-message">{nameSuccess}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNameModalOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={nameLoading}>
                  {nameLoading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно смены пароля */}
      {passwordModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setPasswordModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prfp-modal-header">
              <h2>Смена пароля</h2>
              <button
                className="prfp-modal-close"
                onClick={() => setPasswordModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Текущий пароль</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswordFields.currentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => togglePasswordField("currentPassword")}
                    aria-label={showPasswordFields.currentPassword ? "Скрыть пароль" : "Показать пароль"}
                    title={showPasswordFields.currentPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    <PasswordEyeIcon isOpen={showPasswordFields.currentPassword} />
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Новый пароль</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswordFields.newPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => togglePasswordField("newPassword")}
                    aria-label={showPasswordFields.newPassword ? "Скрыть пароль" : "Показать пароль"}
                    title={showPasswordFields.newPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    <PasswordEyeIcon isOpen={showPasswordFields.newPassword} />
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Подтвердите новый пароль</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswordFields.confirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => togglePasswordField("confirmPassword")}
                    aria-label={showPasswordFields.confirmPassword ? "Скрыть пароль" : "Показать пароль"}
                    title={showPasswordFields.confirmPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    <PasswordEyeIcon isOpen={showPasswordFields.confirmPassword} />
                  </button>
                </div>
              </div>
              {passwordError && (
                <div className="error-message">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="success-message">{passwordSuccess}</div>
              )}
              <button
                type="button"
                className="link-btn forgot-password-btn"
                onClick={() => {
                  setPasswordModalOpen(false);
                  openForgotPasswordModal(user?.email || "");
                }}
              >
                Забыли пароль?
              </button>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="prfp-orders">
        <h2>Ваши заказы</h2>
        {loading ? (
          <p>Загрузка заказов...</p>
        ) : orders.length === 0 ? (
          <p>У вас пока нет заказов.</p>
        ) : (
          <table className="prfp-orders-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="prfp-order-row-clickable"
                  onClick={() => handleViewOrder(order)}
                >
                  <td>{order.id}</td>
                  <td>{new Date(order.date).toLocaleDateString("ru-RU")}</td>
                  <td>{order.totalPrice} ₽</td>
                  <td>
                    <span
                      className={`prfp-order-status ${getStatusClass(
                        order.status,
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleRepeatOrder(order)}
                    >
                      Повторить заказ
                    </button>
                    {canCancelOrder(order) && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        Отменить заказ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Модальное окно просмотра заказа */}
      {orderModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setOrderModalOpen(false)}>
          <div
            className="modal-content prfp-order-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="prfp-modal-header">
              <h2>Заказ №{selectedOrder.id}</h2>
              <button
                className="prfp-modal-close"
                onClick={() => setOrderModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="prfp-modal-body">
              <div className="prfp-order-info-block">
                <h3>Информация о заказе</h3>
                <p>
                  <strong>Дата:</strong>{" "}
                  {new Date(selectedOrder.date).toLocaleString("ru-RU")}
                </p>
                <p>
                  <strong>Статус:</strong>{" "}
                  <span
                    className={`prfp-order-status ${getStatusClass(
                      selectedOrder.status,
                    )}`}
                  >
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </p>
                {(() => {
                  const deliveryDetails = getDeliveryDetails(selectedOrder);

                  return (
                    <>
                      {deliveryDetails.name && (
                        <p>
                          <strong>Имя:</strong> {deliveryDetails.name}
                        </p>
                      )}
                      {deliveryDetails.phone && (
                        <p>
                          <strong>Номер телефона:</strong> {deliveryDetails.phone}
                        </p>
                      )}
                      {deliveryDetails.address && (
                        <p>
                          <strong>Адрес доставки:</strong> {deliveryDetails.address}
                        </p>
                      )}
                      {deliveryDetails.room && (
                        <p>
                          <strong>Квартира:</strong> {deliveryDetails.room}
                        </p>
                      )}
                      {deliveryDetails.comment && (
                        <p>
                          <strong>Комментарий:</strong> {deliveryDetails.comment}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="prfp-order-items-block">
                <h3>Товары</h3>
                <ul className="prfp-order-items-list">
                  {selectedOrder.list.map((item, index) => {
                    const unitLabel = (item.pid?.unit || "grams") === "grams" ? "г" : "шт";
                    return (
                    <li key={index}>
                      <div className="prfp-item-row">
                        <span className="prfp-item-name">
                          {item.pid?.name || "Товар удален"}
                        </span>
                        <span className="prfp-item-quantity">
                          {item.count} {unitLabel}
                        </span>
                        <span className="prfp-item-price">
                          {formatPrice(item.count * item.priceAtOrder)}
                        </span>
                      </div>
                    </li>
                  );})}
                </ul>
              </div>
              <div className="prfp-order-total-block">
                <div className="prfp-total-row">
                  <span>Стоимость товаров:</span>
                  <span>
                    {formatPrice(
                      selectedOrder.list.reduce(
                        (sum, item) => sum + item.count * item.priceAtOrder,
                        0,
                      ),
                    )}
                  </span>
                </div>
                <div className="prfp-total-row">
                  <span>Стоимость доставки:</span>
                  <span>{formatPrice(getDeliveryDetails(selectedOrder).price)}</span>
                </div>
                <div className="prfp-total-row grand-total">
                  <span>Итого:</span>
                  <span>{formatPrice(selectedOrder.totalPrice)}</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setOrderModalOpen(false)}
              >
                Закрыть
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleRepeatOrder(selectedOrder)}
              >
                Повторить заказ
              </button>
              {canCancelOrder(selectedOrder) && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                >
                  Отменить заказ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
