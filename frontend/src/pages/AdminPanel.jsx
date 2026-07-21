import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import api from "../services/api";
import OrdersPage from "./admin/OrdersPage";
import EditPage from "./admin/EditPage";
import StatisticsTab from "./admin/StatisticsTab";
import LogsPage from "./admin/LogsPage";
import SettingsPage from "./admin/SettingsPage";
import CustomersPage from "./admin/CustomersPage";
import ReviewsPage from "./admin/ReviewsPage";
import ChatsPage from "./admin/ChatsPage";

const AdminPanel = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [counts, setCounts] = useState({ pendingReviews: 0, unreadChats: 0 });

  useEffect(() => {
    const loadCounts = () => {
      api.get("/admin/notifications/counts")
        .then((response) => setCounts(response.data))
        .catch(() => {});
    };
    loadCounts();
    const intervalId = setInterval(loadCounts, 30000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="ap-admin-panel">
      <aside className={`ap-admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="ap-sidebar-header">
          <h2>Админка</h2>
          <button
            className="ap-toggle-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? "←" : "→"}
          </button>
        </div>
        <nav className="ap-sidebar-nav">
          <NavLink to="/admin/orders" className="ap-sidebar-link">
            Заказы
          </NavLink>
          <NavLink to="/admin/customers" className="ap-sidebar-link">
            Клиенты
          </NavLink>
          <NavLink to="/admin/reviews" className="ap-sidebar-link">
            Отзывы {counts.pendingReviews > 0 && <span className="ap-nav-badge">{counts.pendingReviews}</span>}
          </NavLink>
          <NavLink to="/admin/chats" className="ap-sidebar-link">
            Чаты {counts.unreadChats > 0 && <span className="ap-nav-badge">{counts.unreadChats}</span>}
          </NavLink>
          <NavLink to="/admin/edit" className="ap-sidebar-link">
            Товары
          </NavLink>
          <NavLink to="/admin/statistics" className="ap-sidebar-link">
            Статистика
          </NavLink>
          <NavLink to="/admin/settings" className="ap-sidebar-link">
            Настройки
          </NavLink>
          <NavLink to="/admin/logs" className="ap-sidebar-link">
            Логи
          </NavLink>
        </nav>
      </aside>
      <main className="ap-admin-content">
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="/statistics" element={<StatisticsTab />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/" element={<OrdersPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminPanel;
