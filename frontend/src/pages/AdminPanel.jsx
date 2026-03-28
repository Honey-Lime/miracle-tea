import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import OrdersPage from "./admin/OrdersPage";
import EditPage from "./admin/EditPage";

const AdminPanel = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          <NavLink to="/admin/edit" className="ap-sidebar-link">
            Редактирование
          </NavLink>
        </nav>
      </aside>
      <main className="ap-admin-content">
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="/" element={<OrdersPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminPanel;
