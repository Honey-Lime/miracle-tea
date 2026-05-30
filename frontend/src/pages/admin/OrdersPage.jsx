import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const OrdersPage = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await axios.put(
        `/api/admin/orders/${id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      addToast("Статус заказа обновлен", "success");
      // Обновляем статус локально, чтобы не вызывать прыжок страницы
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === id ? { ...order, status: newStatus } : order,
        ),
      );
    } catch (err) {
      addToast("Ошибка обновления статуса", "error");
      console.error(err);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      created: "Создан",
      paid: "Оплачен",
      assembled: "Собран",
      shipped: "Отправлен",
      completed: "Завершен",
      cancelled: "Отменен",
      refunded: "Возврат совершен",
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    const classes = {
      created: "op-status-created",
      paid: "op-status-paid",
      assembled: "op-status-assembled",
      shipped: "op-status-shipped",
      completed: "op-status-completed",
      cancelled: "op-status-cancelled",
      refunded: "op-status-cancelled",
    };
    return classes[status] || "";
  };

  const formatPrice = (price) => {
    return `${price.toLocaleString("ru-RU")} ₽`;
  };

  const getDeliveryDetails = (order) => order.delivery?.details || {};

  const getDeliveryAddress = (order) => {
    const details = getDeliveryDetails(order);
    const address = details.address || order.delivery?.address;

    if (!address) return "Не указан";
    if (typeof address === "string") return address;

    return address.address || address.value || address.details || "Не указан";
  };

  const getDeliveryTypeLabel = (order) => {
    const type = getDeliveryDetails(order).type;

    if (type === "door") return "До двери";
    if (type === "terminal") return "До пункта выдачи";

    return "Не указан";
  };

  const getDeliveryTime = (order) => {
    const details = getDeliveryDetails(order);

    if (!details.time) return "Не указано";

    return `${details.time} ${details.unitTime || ""}`.trim();
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredOrders = normalizedSearchQuery
    ? orders.filter((order) => {
        const id = (order.id || "").toLowerCase();
        const deliveryPhone = (getDeliveryDetails(order).phone || "").toLowerCase();
        const deliveryPhoneDigits = deliveryPhone.replace(/\D/g, "");
        const queryDigits = normalizedSearchQuery.replace(/\D/g, "");

        return (
          id.includes(normalizedSearchQuery) ||
          deliveryPhone.includes(normalizedSearchQuery) ||
          (queryDigits && deliveryPhoneDigits.includes(queryDigits))
        );
      })
    : orders;

  if (loading) {
    return <div className="op-loading">Загрузка заказов...</div>;
  }

  if (error) {
    return <div className="op-error">{error}</div>;
  }

  return (
    <div className="op-orders-page">
      <h1>Заказы</h1>
      <div className="op-orders-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по ID заказа или телефону доставки"
        />
      </div>
      {orders.length === 0 ? (
        <p className="op-no-orders">Нет оформленных заказов</p>
      ) : filteredOrders.length === 0 ? (
        <p className="op-no-orders">Заказы не найдены</p>
      ) : (
        <div className="op-orders-list">
          {filteredOrders.map((order) => (
            <div key={order.id} className="op-order-row">
              <div className="op-order-info">
                <div className="op-order-header">
                  <span className="op-order-number">
                    Заказ №{order.id}
                  </span>
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
                    {order.userId?.email || order.userId?.phone || "N/A"})
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
                      {order.list.map((item, index) => {
                        const isGrams = (item.pid?.unit || "grams") === "grams";
                        const unitLabel = isGrams ? "г" : "шт";
                        const priceLabel = isGrams
                          ? `${formatPrice(item.priceAtOrder * 100)}/100г`
                          : `${formatPrice(item.priceAtOrder)}/шт`;
                        return (
                          <li key={index}>
                            {item.pid?.name || "Товар удален"} - {item.count}{unitLabel} ×{" "}
                            {priceLabel} = {formatPrice(item.count * item.priceAtOrder)}
                          </li>
                        );
                      })}
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
                  <div className="op-order-delivery">
                    <strong>Доставка:</strong>
                    <div className="op-delivery-grid">
                      <div>
                        <span>Адрес:</span>
                        <strong>{getDeliveryAddress(order)}</strong>
                      </div>
                      <div>
                        <span>Тип:</span>
                        <strong>{getDeliveryTypeLabel(order)}</strong>
                      </div>
                      <div>
                        <span>Стоимость доставки:</span>
                        <strong>{formatPrice(order.delivery?.price || 0)}</strong>
                      </div>
                      <div>
                        <span>Время доставки:</span>
                        <strong>{getDeliveryTime(order)}</strong>
                      </div>
                      <div>
                        <span>Квартира:</span>
                        <strong>{getDeliveryDetails(order).room || "Не указана"}</strong>
                      </div>
                      <div>
                        <span>Имя:</span>
                        <strong>{getDeliveryDetails(order).name || "Не указано"}</strong>
                      </div>
                      <div>
                        <span>Телефон:</span>
                        <strong>{getDeliveryDetails(order).phone || "Не указан"}</strong>
                      </div>
                      <div className="op-delivery-comment">
                        <span>Комментарий:</span>
                        <strong>{getDeliveryDetails(order).comment || "Нет комментария"}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="op-order-actions">
                    {order.status === "created" && (
                      <button
                        className="op-btn-paid"
                        onClick={() => handleUpdateStatus(order.id, "paid")}
                      >
                        Оплачен
                      </button>
                    )}
                    {order.status === "paid" && (
                      <button
                        className="op-btn-shipping"
                        onClick={() => handleUpdateStatus(order.id, "assembled")}
                      >
                        Собран
                      </button>
                    )}
                    {order.status === "assembled" && (
                      <button
                        className="op-btn-shipping"
                        onClick={() => handleUpdateStatus(order.id, "shipped")}
                      >
                        Отправлен
                      </button>
                    )}
                    {order.status === "shipped" && (
                      <button
                        className="op-btn-shipping"
                        onClick={() => handleUpdateStatus(order.id, "completed")}
                      >
                        Завершен
                      </button>
                    )}
                    {order.status === "cancelled" && (
                      <button
                        className="op-btn-paid"
                        onClick={() => handleUpdateStatus(order.id, "refunded")}
                      >
                        Возврат совершен
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
