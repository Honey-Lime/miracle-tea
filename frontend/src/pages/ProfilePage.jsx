import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { getMyOrders } from "../services/orderService";
import { changePassword } from "../services/authService";

const ProfilePage = () => {
  const { user, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const getStatusLabel = (status) => {
    const labels = {
      ordered: "Заказан",
      paid: "На сборке",
      shipping: "В доставке",
      completed: "Выполнен",
      cancelled: "Отменён",
      cart: "Корзина",
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    const classes = {
      ordered: "prfp-status-ordered",
      paid: "prfp-status-paid",
      shipping: "prfp-status-shipping",
      completed: "prfp-status-completed",
      cancelled: "prfp-status-cancelled",
      cart: "prfp-status-cart",
    };
    return classes[status] || "";
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setOrderModalOpen(true);
  };

  const formatPrice = (price) => {
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  useEffect(() => {
    if (user) {
      getMyOrders()
        .then((res) => {
          // Исключаем заказы со статусом "cart" (активные корзины)
          const completedOrders = res.data.filter(
            (order) => order.status !== "cart",
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
        <p>Телефон: {user.phone}</p>
        <p>Общая сумма покупок: {user.total || 0} ₽</p>
        <div className="prfp-profile-actions">
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
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Новый пароль</label>
                <input
                  type="password"
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
              </div>
              <div className="form-group">
                <label>Подтвердите новый пароль</label>
                <input
                  type="password"
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
              </div>
              {passwordError && (
                <div className="error-message">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="success-message">{passwordSuccess}</div>
              )}
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
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order._id}
                  className="prfp-order-row-clickable"
                  onClick={() => handleViewOrder(order)}
                >
                  <td>{order._id.slice(-6)}</td>
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
              <h2>Заказ №{selectedOrder._id.slice(-6)}</h2>
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
                <p>
                  <strong>Адрес доставки:</strong>{" "}
                  {selectedOrder.delivery?.address?.fullAddress || "Не указан"}
                </p>
              </div>
              <div className="prfp-order-items-block">
                <h3>Товары</h3>
                <ul className="prfp-order-items-list">
                  {selectedOrder.list.map((item, index) => (
                    <li key={index}>
                      <div className="prfp-item-row">
                        <span className="prfp-item-name">
                          {item.pid?.name || "Товар удален"}
                        </span>
                        <span className="prfp-item-quantity">
                          {item.count} г
                        </span>
                        <span className="prfp-item-price">
                          {formatPrice(item.count * item.priceAtOrder)}
                        </span>
                      </div>
                    </li>
                  ))}
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
                {selectedOrder.delivery?.price > 0 && (
                  <div className="prfp-total-row">
                    <span>Доставка:</span>
                    <span>{formatPrice(selectedOrder.delivery.price)}</span>
                  </div>
                )}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
