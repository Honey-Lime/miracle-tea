import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

const formatPrice = (value = 0) => `${Number(value || 0).toLocaleString("ru-RU")} ₽`;

const CustomersPage = () => {
  const { addToast } = useToast();
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [query, setQuery] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadCustomers = async (search = query) => {
    setLoading(true);
    try {
      const response = await api.get("/admin/customers", { params: { query: search } });
      setCustomers(response.data);
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить клиентов", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customerId) => {
    setDetailsLoading(true);
    try {
      const response = await api.get(`/admin/customers/${customerId}`);
      setSelectedCustomer(response.data.customer);
      setOrders(response.data.orders || []);
      setReviews(response.data.reviews || []);
      setBonusAmount("");
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить клиента", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers("");
  }, []);

  useEffect(() => {
    const customerId = new URLSearchParams(location.search).get("customerId");
    if (customerId) loadCustomerDetails(customerId);
  }, [location.search]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadCustomers(query);
  };

  const handleBonusChange = async (operation) => {
    if (!selectedCustomer) return;

    const amount = Math.floor(Number(bonusAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast("Введите положительное количество бонусов", "warning");
      return;
    }

    try {
      const response = await api.put(`/admin/customers/${selectedCustomer.id}/bonuses`, {
        operation,
        amount,
      });
      setSelectedCustomer((prev) => ({ ...prev, bonusBalance: response.data.bonusBalance }));
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === selectedCustomer.id
            ? { ...customer, bonusBalance: response.data.bonusBalance }
            : customer,
        ),
      );
      setBonusAmount("");
      addToast(operation === "add" ? "Бонусы начислены" : "Бонусы списаны", "success");
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось изменить бонусы", "error");
    }
  };

  return (
    <section className="ap-customers-page">
      <div className="ap-customers-header">
        <h1>Клиенты</h1>
        <form className="ap-customers-search" onSubmit={handleSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени или email"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            Найти
          </button>
        </form>
      </div>

      <div className="ap-customers-layout">
        <div className="ap-customers-list">
          {loading && <p>Загрузка...</p>}
          {!loading && customers.length === 0 && <p>Клиенты не найдены</p>}
          {!loading && customers.map((customer) => (
            <button
              type="button"
              key={customer.id}
              className={`ap-customer-card ${selectedCustomer?.id === customer.id ? "active" : ""}`}
              onClick={() => loadCustomerDetails(customer.id)}
            >
              <strong>{customer.name}</strong>
              <span>{customer.email}</span>
              <small>
                Заказов: {customer.ordersCount} · Бонусов: {customer.bonusBalance || 0}
              </small>
            </button>
          ))}
        </div>

        <div className="ap-customer-details">
          {!selectedCustomer && <p>Выберите клиента из списка</p>}
          {detailsLoading && <p>Загрузка клиента...</p>}
          {selectedCustomer && !detailsLoading && (
            <>
              <h2>{selectedCustomer.name}</h2>
              <div className="ap-customer-info-grid">
                <div><span>Email</span><strong>{selectedCustomer.email}</strong></div>
                <div><span>Бонусы</span><strong>{selectedCustomer.bonusBalance || 0}</strong></div>
                <div><span>Сумма покупок</span><strong>{formatPrice(selectedCustomer.total)}</strong></div>
                <div><span>Дата регистрации</span><strong>{new Date(selectedCustomer.createdAt).toLocaleDateString("ru-RU")}</strong></div>
                <div><span>Роль</span><strong>{selectedCustomer.isAdmin ? "Админ" : "Клиент"}</strong></div>
              </div>

              <div className="ap-bonus-editor">
                <h3>Изменить бонусы</h3>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bonusAmount}
                  onChange={(event) => setBonusAmount(event.target.value)}
                  placeholder="Количество бонусов"
                />
                <div>
                  <button className="btn btn-primary" type="button" onClick={() => handleBonusChange("add")}>
                    Начислить
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => handleBonusChange("subtract")}>
                    Списать
                  </button>
                </div>
              </div>

              <div className="ap-customer-orders">
                <h3>Последние заказы</h3>
                {orders.length === 0 ? (
                  <p>Заказов пока нет</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Статус</th>
                        <th>Сумма</th>
                        <th>Бонусы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>{new Date(order.date).toLocaleDateString("ru-RU")}</td>
                          <td>{order.status}</td>
                          <td>{formatPrice(order.totalPrice)}</td>
                          <td>+{order.bonuses?.earned || 0} / -{order.bonuses?.spent || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="ap-customer-orders">
                <h3>Отзывы клиента</h3>
                {reviews.length === 0 ? (
                  <p>Отзывов пока нет</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((review) => (
                        <tr key={review._id}>
                          <td>{review.productId?.name || "Товар"}</td>
                          <td>{review.status}</td>
                          <td>{new Date(review.createdAt).toLocaleDateString("ru-RU")}</td>
                          <td>
                            <a className="btn btn-secondary" href={`/product/${review.productId?._id}#review-${review._id}`} target="_blank" rel="noreferrer">
                              Перейти
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default CustomersPage;
