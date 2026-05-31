import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminUserMenu = ({ user, fallback = "Клиент" }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const userId = user?.id || user?._id;

  if (!userId) return <span>{user?.name || fallback}</span>;

  return (
    <span className="ap-user-menu">
      <button type="button" className="ap-user-menu-name" onClick={() => setOpen((value) => !value)}>
        {user?.name || fallback}
      </button>
      {open && (
        <span className="ap-user-menu-popover">
          <button type="button" onClick={() => navigate(`/admin/customers?customerId=${userId}`)}>
            Перейти в профиль
          </button>
        </span>
      )}
    </span>
  );
};

export default AdminUserMenu;
