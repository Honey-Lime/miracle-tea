import { useEffect, useState } from "react";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = {
  code: "",
  discountType: "percent",
  discountValue: "10",
  usesPerUser: "1",
  maxUses: "0",
  minOrderTotal: "0",
  expiresAt: "",
  active: true,
  referralSourceId: "",
  comment: "",
};

const normalizeCode = (value) => value.toUpperCase().replace(/[^A-ZА-ЯЁ0-9_-]/g, "");
const formatPrice = (value = 0) => `${Number(value || 0).toLocaleString("ru-RU")} ₽`;

const formatDiscount = (promo) => {
  if (!promo.discountValue) return "Без скидки";
  return promo.discountType === "fixed" ? formatPrice(promo.discountValue) : `${promo.discountValue}%`;
};

const toForm = (promo) => ({
  code: promo.code,
  discountType: promo.discountType,
  discountValue: String(promo.discountValue ?? 0),
  usesPerUser: String(promo.usesPerUser ?? 0),
  maxUses: String(promo.maxUses ?? 0),
  minOrderTotal: String(promo.minOrderTotal ?? 0),
  expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : "",
  active: promo.active,
  referralSourceId: promo.referralSourceId || "",
  comment: promo.comment || "",
});

const PromoCodesPage = () => {
  const { addToast } = useToast();
  const [promos, setPromos] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [promoResponse, sourceResponse] = await Promise.all([
        api.get("/admin/promocodes"),
        api.get("/admin/referrals"),
      ]);
      setPromos(promoResponse.data);
      setSources(sourceResponse.data);
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить промокоды", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "code" ? normalizeCode(value) : value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.code) {
      addToast("Укажите промокод", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59` : null,
      referralSourceId: form.referralSourceId || null,
    };
    try {
      if (editingId) {
        await api.put(`/admin/promocodes/${editingId}`, payload);
        addToast("Промокод обновлён", "success");
      } else {
        await api.post("/admin/promocodes", payload);
        addToast("Промокод создан", "success");
      }
      resetForm();
      loadData();
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось сохранить промокод", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo) => {
    setEditingId(promo.id);
    setForm(toForm(promo));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = async (promo) => {
    try {
      await api.put(`/admin/promocodes/${promo.id}`, { ...toForm(promo), expiresAt: promo.expiresAt, active: !promo.active });
      loadData();
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось изменить промокод", "error");
    }
  };

  const handleDelete = async (promo) => {
    if (!window.confirm(`Удалить промокод ${promo.code}? Статистика заказов сохранится.`)) return;
    try {
      await api.delete(`/admin/promocodes/${promo.id}`);
      if (editingId === promo.id) resetForm();
      addToast("Промокод удалён", "success");
      loadData();
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось удалить промокод", "error");
    }
  };

  return (
    <section className="ap-marketing-page">
      <h1>Промокоды</h1>

      <form className="ap-marketing-form" onSubmit={handleSubmit}>
        <h2>{editingId ? `Редактирование ${form.code}` : "Новый промокод"}</h2>
        <div className="ap-marketing-grid">
          <label>
            <span>Код</span>
            <input
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="CHAI10"
              className="ap-marketing-code-input"
              required
            />
          </label>
          <label>
            <span>Тип скидки</span>
            <select name="discountType" value={form.discountType} onChange={handleChange}>
              <option value="percent">Процент от товаров</option>
              <option value="fixed">Фиксированная сумма, ₽</option>
            </select>
          </label>
          <label>
            <span>{form.discountType === "percent" ? "Скидка, %" : "Скидка, ₽"}</span>
            <input
              type="number"
              name="discountValue"
              min="0"
              max={form.discountType === "percent" ? 100 : undefined}
              step="1"
              value={form.discountValue}
              onChange={handleChange}
            />
            <small>0 — без скидки, только реферальная привязка</small>
          </label>
          <label>
            <span>Использований на аккаунт</span>
            <input type="number" name="usesPerUser" min="0" step="1" value={form.usesPerUser} onChange={handleChange} />
            <small>0 — без ограничений</small>
          </label>
          <label>
            <span>Общий лимит использований</span>
            <input type="number" name="maxUses" min="0" step="1" value={form.maxUses} onChange={handleChange} />
            <small>0 — без ограничений</small>
          </label>
          <label>
            <span>Минимальная сумма товаров, ₽</span>
            <input type="number" name="minOrderTotal" min="0" step="1" value={form.minOrderTotal} onChange={handleChange} />
          </label>
          <label>
            <span>Действует до</span>
            <input type="date" name="expiresAt" value={form.expiresAt} onChange={handleChange} />
            <small>Пусто — бессрочно</small>
          </label>
          <label>
            <span>Реферальный источник</span>
            <select name="referralSourceId" value={form.referralSourceId} onChange={handleChange}>
              <option value="">— не привязан —</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <small>Клиент, введший код, будет привязан к источнику</small>
          </label>
          <label className="ap-marketing-wide">
            <span>Комментарий</span>
            <input name="comment" value={form.comment} onChange={handleChange} placeholder="Для чего этот промокод" />
          </label>
          <label className="ap-marketing-check">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            <span>Активен</span>
          </label>
        </div>
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
        {!loading && promos.length === 0 && <p>Промокодов пока нет</p>}
        {!loading && promos.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Код</th>
                <th>Скидка</th>
                <th>Лимиты</th>
                <th>Использован</th>
                <th>Сумма скидок</th>
                <th>Источник</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => {
                const expired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
                return (
                  <tr key={promo.id} className={!promo.active || expired ? "ap-marketing-row-off" : ""}>
                    <td>
                      <strong>{promo.code}</strong>
                      {promo.comment && <small>{promo.comment}</small>}
                    </td>
                    <td>
                      {formatDiscount(promo)}
                      {promo.minOrderTotal > 0 && <small>от {formatPrice(promo.minOrderTotal)}</small>}
                    </td>
                    <td>
                      <small>На аккаунт: {promo.usesPerUser || "∞"}</small>
                      <small>Всего: {promo.maxUses || "∞"}</small>
                      {promo.expiresAt && (
                        <small>до {new Date(promo.expiresAt).toLocaleDateString("ru-RU")}</small>
                      )}
                    </td>
                    <td>
                      {promo.uses} раз
                      <small>клиентов: {promo.usersCount}</small>
                    </td>
                    <td>{formatPrice(promo.discountTotal)}</td>
                    <td>{promo.referralSource?.name || "—"}</td>
                    <td>{expired ? "Истёк" : promo.active ? "Активен" : "Выключен"}</td>
                    <td className="ap-marketing-row-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => handleEdit(promo)}>
                        Изменить
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => handleToggle(promo)}>
                        {promo.active ? "Выключить" : "Включить"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => handleDelete(promo)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default PromoCodesPage;
