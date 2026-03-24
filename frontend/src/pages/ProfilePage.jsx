import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "./ProfilePage.css";

const ProfilePage = () => {
  const { user, logout } = useContext(AuthContext);

  if (!user) {
    return (
      <div className="profile-page">
        <h1>Личный кабинет</h1>
        <p>Войдите, чтобы увидеть свои заказы.</p>
      </div>
    );
  }

  // Заглушка заказов
  const orders = [
    { id: "1", date: "2024-03-20", total: 1500, status: "Доставлен" },
    { id: "2", date: "2024-03-18", total: 2300, status: "В обработке" },
  ];

  return (
    <div className="profile-page">
      <h1>Личный кабинет</h1>
      <div className="profile-info">
        <h2>Привет, {user.name}!</h2>
        <p>Телефон: {user.phone}</p>
        <p>Общая сумма покупок: {user.total || 0} ₽</p>
        <button className="btn btn-secondary" onClick={logout}>
          Выйти
        </button>
      </div>
      <div className="orders">
        <h2>Ваши заказы</h2>
        {orders.length === 0 ? (
          <p>У вас пока нет заказов.</p>
        ) : (
          <table className="orders-table">
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
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.date}</td>
                  <td>{order.total} ₽</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
