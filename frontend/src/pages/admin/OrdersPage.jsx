import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const OrdersPage = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(response.data);
      setError(null);
    } catch (err) {
      setError("Ошибка загрузки заказов");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await axios.put(
        `/api/admin/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      addToast("Статус заказа обновлен", "success");
      // Обновляем статус локально, чтобы не вызывать прыжок страницы
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId ? { ...order, status: newStatus } : order,
        ),
      );
    } catch (err) {
      addToast("Ошибка обновления статуса", "error");
      console.error(err);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      ordered: "Заказан",
      paid: "На сборке",
      shipping: "В доставке",
      completed: "Выполнен",
      cancelled: "Отменён",
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    const classes = {
      ordered: "op-status-ordered",
      paid: "op-status-paid",
      shipping: "op-status-shipping",
      completed: "op-status-completed",
      cancelled: "op-status-cancelled",
    };
    return classes[status] || "";
  };

  const formatPrice = (price) => {
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  if (loading) {
    return <div className="op-loading">Загрузка заказов...</div>;
  }

  if (error) {
    return <div className="op-error">{error}</div>;
  }

  return (
    <div className="op-orders-page">
      <h1>Заказы</h1>
      {orders.length === 0 ? (
        <p className="op-no-orders">Нет оформленных заказов</p>
      ) : (
        <div className="op-orders-list">
          {orders.map((order) => (
            <div key={order._id} className="op-order-row">
              <div className="op-order-info">
                <div className="op-order-header">
                  <span className="op-order-date">
                    {new Date(order.date).toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="op-order-customer">
                    {order.userId?.name || "Гость"} (
                    {order.userId?.phone || "N/A"})
                  </span>
                  <span
                    className={`op-order-status ${getStatusClass(
                      order.status,
                    )}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <div className="op-order-details">
                  <div className="op-order-items">
                    <strong>Товары:</strong>
                    <ul>
                      {order.list.map((item, index) => (
                        <li key={index}>
                          {item.pid?.name || "Товар удален"} - {item.count}г ×{" "}
                          {formatPrice(item.priceAtOrder * 100)}/100г ={" "}
                          {formatPrice(item.count * item.priceAtOrder)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="op-order-summary">
                    <div className="op-order-row-item">
                      <strong>Стоимость чая:</strong>{" "}
                      {formatPrice(
                        order.list.reduce(
                          (sum, item) => sum + item.count * item.priceAtOrder,
                          0,
                        ),
                      )}
                    </div>
                    <div className="op-order-row-item">
                      <strong>Стоимость доставки:</strong>{" "}
                      {formatPrice(order.delivery?.price || 0)}
                    </div>
                    <div className="op-order-row-item total">
                      <strong>Итого:</strong> {formatPrice(order.totalPrice)}
                    </div>
                  </div>
                  <div className="op-order-address">
                    <strong>Адрес доставки:</strong>{" "}
                    {order.delivery?.address?.fullAddress ||
                      order.delivery?.address?.label ||
                      order.delivery?.address?.data?.address ||
                      "Не указан"}
                  </div>
                  <div className="op-order-actions">
                    {order.status === "paid" && (
                      <button
                        className="op-btn-shipping"
                        onClick={() =>
                          handleUpdateStatus(order._id, "shipping")
                        }
                      >
                        Отправлен
                      </button>
                    )}
                    {order.status === "ordered" && (
                      <button
                        className="op-btn-paid"
                        onClick={() => handleUpdateStatus(order._id, "paid")}
                      >
                        Подтвердить оплату
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
