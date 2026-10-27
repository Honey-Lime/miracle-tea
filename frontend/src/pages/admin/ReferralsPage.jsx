import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = { name: "", links: "", comment: "", active: true };

const formatPrice = (value = 0) =>
  `${Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;

const buildLink = (code) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

const VIA_LABELS = { link: "Ссылка", promo: "Промокод", admin: "Вручную" };

const ReferralsPage = () => {
  const { addToast } = useToast();
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSources = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/referrals");
      setSources(response.data);
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить источники", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (sourceId) => {
    setDetailsLoading(true);
    try {
      const response = await api.get(`/admin/referrals/${sourceId}`);
      setDetails(response.data);
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить источник", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "links" ? value.toUpperCase() : value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/referrals/${editingId}`, form);
        addToast("Источник обновлён", "success");
        if (details?.source?.id === editingId) loadDetails(editingId);
      } else {
        await api.post("/admin/referrals", form);
        addToast("Источник создан", "success");
      }
      resetForm();
      loadSources();
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось сохранить источник", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (source) => {
    setEditingId(source.id);
    setForm({
      name: source.name,
      links: (source.links || []).join("\n"),
      comment: source.comment || "",
      active: source.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (source) => {
    if (!window.confirm(`Удалить источник «${source.name}»?`)) return;
    try {
      await api.delete(`/admin/referrals/${source.id}`);
      if (details?.source?.id === source.id) setDetails(null);
      if (editingId === source.id) resetForm();
      addToast("Источник удалён", "success");
      loadSources();
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось удалить источник", "error");
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(buildLink(code));
      addToast("Ссылка скопирована", "success");
    } catch {
      addToast(buildLink(code), "info");
    }
  };

  return (
    <section className="ap-marketing-page">
      <h1>Рефералы</h1>

      <form className="ap-marketing-form" onSubmit={handleSubmit}>
        <h2>{editingId ? `Редактирование «${form.name}»` : "Новый реферальный источник"}</h2>
        <div className="ap-marketing-grid">
          <label>
            <span>Название</span>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Блогер Анна" required />
          </label>
          <label>
            <span>Коды ссылок</span>
            <textarea
              name="links"
              rows="3"
              value={form.links}
              onChange={handleChange}
              placeholder={"ANNA\nANNA-STORIES"}
            />
            <small>По одному на строку. Ссылка: {window.location.origin}/?ref=КОД</small>
          </label>
          <label className="ap-marketing-wide">
            <span>Комментарий</span>
            <input name="comment" value={form.comment} onChange={handleChange} />
          </label>
          <label className="ap-marketing-check">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            <span>Активен (выключенные ссылки перестают привязывать новых клиентов)</span>
          </label>
        </div>
        <p className="ap-marketing-hint">
          Промокоды привязываются к источнику на странице <Link to="/admin/promocodes">«Промокоды»</Link>.
        </p>
        <div className="ap-marketing-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {editingId ? "Сохранить" : "Создать"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Отмена
            </button>
          )}
        </div>
      </form>

      <div className="ap-marketing-table">
        {loading && <p>Загрузка...</p>}
        {!loading && sources.length === 0 && <p>Реферальных источников пока нет</p>}
        {!loading && sources.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Источник</th>
                <th>Ссылки и промокоды</th>
                <th>Клиентов</th>
                <th>Заказов</th>
                <th>Выручка</th>
                <th>Чистая прибыль</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr
                  key={source.id}
                  className={`${!source.active ? "ap-marketing-row-off" : ""} ${
                    details?.source?.id === source.id ? "ap-marketing-row-active" : ""
                  }`}
                >
                  <td>
                    <strong>{source.name}</strong>
                    {source.comment && <small>{source.comment}</small>}
                    {!source.active && <small>Выключен</small>}
                  </td>
                  <td>
                    {source.links.map((code) => (
                      <small key={code}>
                        🔗 {code}{" "}
                        <button type="button" className="ap-marketing-link-btn" onClick={() => handleCopy(code)}>
                          копировать
                        </button>
                      </small>
                    ))}
                    {source.promoCodes.map((promo) => (
                      <small key={promo.id}>🏷 {promo.code}{!promo.active && " (выкл.)"}</small>
                    ))}
                    {source.links.length === 0 && source.promoCodes.length === 0 && <small>—</small>}
                  </td>
                  <td>{source.stats.clientsCount}</td>
                  <td>{source.stats.ordersCount}</td>
                  <td>{formatPrice(source.stats.revenue)}</td>
                  <td>{formatPrice(source.stats.profit)}</td>
                  <td className="ap-marketing-row-actions">
                    <button type="button" className="btn btn-primary" onClick={() => loadDetails(source.id)}>
                      Подробнее
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleEdit(source)}>
                      Изменить
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleDelete(source)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailsLoading && <p>Загрузка источника...</p>}
      {details && !detailsLoading && (
        <div className="ap-customer-details ap-marketing-details">
          <h2>{details.source.name}</h2>
          <div className="ap-customer-info-grid">
            <div><span>Клиентов</span><strong>{details.stats.clientsCount}</strong></div>
            <div><span>Из них гостей</span><strong>{details.stats.guestClientsCount}</strong></div>
            <div><span>Оплаченных заказов</span><strong>{details.stats.ordersCount}</strong></div>
            <div><span>Выручка с чая</span><strong>{formatPrice(details.stats.revenue)}</strong></div>
            <div><span>Себестоимость</span><strong>{formatPrice(details.stats.cost)}</strong></div>
            <div><span>Чистая прибыль</span><strong>{formatPrice(details.stats.profit)}</strong></div>
          </div>
          <p className="ap-marketing-hint">
            Выручка — стоимость чая в оплаченных заказах за вычетом промокодов и бонусов, без доставки.
            Прибыль — выручка минус себестоимость чая.
          </p>

          <div className="ap-customer-orders">
            <h3>По ссылкам и промокодам</h3>
            {details.stats.byCode.length === 0 ? (
              <p>Данных пока нет</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Клиентов</th>
                    <th>Заказов</th>
                    <th>Выручка</th>
                    <th>Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {details.stats.byCode.map((item) => (
                    <tr key={item.code}>
                      <td>{item.code}</td>
                      <td>{item.clientsCount}</td>
                      <td>{item.ordersCount}</td>
                      <td>{formatPrice(item.revenue)}</td>
                      <td>{formatPrice(item.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="ap-customer-orders">
            <h3>Привлечённые клиенты</h3>
            {details.clients.length === 0 ? (
              <p>Клиентов пока нет</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Как пришёл</th>
                    <th>Дата</th>
                    <th>Заказов</th>
                    <th>Выручка</th>
                    <th>Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {details.clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <Link to={`/admin/customers?customerId=${client.id}`}>{client.name}</Link>
                        <small>{client.email}</small>
                      </td>
                      <td>
                        {VIA_LABELS[client.via] || "—"} {client.code}
                      </td>
                      <td>{new Date(client.boundAt).toLocaleDateString("ru-RU")}</td>
                      <td>{client.ordersCount}</td>
                      <td>{formatPrice(client.revenue)}</td>
                      <td>{formatPrice(client.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {details.guests.length > 0 && (
            <div className="ap-customer-orders">
              <h3>Гостевые заказы</h3>
              <table>
                <thead>
                  <tr>
                    <th>Покупатель</th>
                    <th>Ссылка</th>
                    <th>Заказов</th>
                    <th>Выручка</th>
                    <th>Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {details.guests.map((guest, index) => (
                    <tr key={`${guest.phone}-${index}`}>
                      <td>
                        {guest.name}
                        {guest.phone && <small>{guest.phone}</small>}
                      </td>
                      <td>{guest.code || "—"}</td>
                      <td>{guest.ordersCount}</td>
                      <td>{formatPrice(guest.revenue)}</td>
                      <td>{formatPrice(guest.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ReferralsPage;
