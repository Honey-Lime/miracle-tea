import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";

const Header = () => {
  const { user, isAdmin, openLoginModal } = useContext(AuthContext);
  const { totalUniqueItems } = useContext(CartContext);

  return (
    <header className="hdr-header">
      <div className="container">
        <div className="hdr-content">
          <div className="hdr-logo">
            <Link to="/">
              <h1>Чудо чай</h1>
            </Link>
            <p className="hdr-tagline">Качественный чай по лояльной цене</p>
          </div>
          <nav className="hdr-nav">
            <Link to="/">Главная</Link>
            <Link to="/catalog">Каталог</Link>
            <Link to="/cart">Корзина ({totalUniqueItems})</Link>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hdr-profile-link"
                  title="Личный кабинет"
                >
                  {user.name}
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="hdr-admin-link" title="Админка">
                    Adm
                  </Link>
                )}
              </>
            ) : (
              <button className="hdr-btn-login" onClick={openLoginModal}>
                Вход
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
