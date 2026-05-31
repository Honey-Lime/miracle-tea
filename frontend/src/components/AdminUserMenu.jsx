import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminUserMenu = ({ user, fallback = "Клиент" }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [open]);

  if (!userId) return <span>{user?.name || fallback}</span>;

  return (
    <span className="ap-user-menu" ref={menuRef}>
      <button type="button" className="ap-user-menu-name" onClick={() => setOpen((value) => !value)}>
        {user?.name || fallback}
      </button>
      {open && (
        <span className="ap-user-menu-popover">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(`/admin/customers?customerId=${userId}`);
            }}
          >
            Перейти в профиль
          </button>
        </span>
      )}
    </span>
  );
};

export default AdminUserMenu;
