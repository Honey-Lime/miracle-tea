import { Link, NavLink } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import cartSVG from "/cart.svg";
import userSVG from "/user.svg";
import logoPNG from "/logo.png";
// import background from "/first-screen-bg.png";


const Header = () => {
  const { user, isAdmin, openLoginModal } = useContext(AuthContext);
  const { totalUniqueItems } = useContext(CartContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="hdr-header">
      <div className="container">
        <div className="hdr-content">
          <div className="hdr-logo">
            <Link className="logo-block" to="/">
              <img className="hdr-cart-icon" src={logoPNG} alt="" />
              <span className="logo-word logo-miracle">Чудо</span>
              <span className="logo-word logo-tea">чай</span>
            </Link>
            <p className="hdr-tagline">Качественный чай по лояльной цене</p>
          </div>
          <div className="hdr-actions">
            <button
              className="hdr-menu-toggle"
              type="button"
              aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={isMenuOpen}
              aria-controls="hdr-menu"
              onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            <nav
              id="hdr-menu"
              className={`hdr-nav${isMenuOpen ? " hdr-nav--open" : ""}`}
            >
              <NavLink to="/" onClick={closeMenu}>Главная</NavLink>
              <NavLink to="/catalog" onClick={closeMenu}>Каталог</NavLink>
              <NavLink to="/about" onClick={closeMenu}>О нас</NavLink>
              {user ? (
                <>
                <Link
                  to="/profile"
                  className="hdr-profile-link"
                  title="Личный кабинет"
                  onClick={closeMenu}
                >
                  {user.name}
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="hdr-admin-link"
                    title="Админка"
                    onClick={closeMenu}
                  >
                    Adm
                  </Link>
                )}
                </>
              ) : (
                <button
                  className="hdr-btn-login"
                  onClick={() => {
                    closeMenu();
                    openLoginModal();
                  }}
                  title="Вход"
                >
                  <img className="hdr-cart-icon" src={userSVG} alt="" />
                </button>
              )}
            </nav>
            <Link to="/cart" className="hdr-cart-link" title="Корзина">
              <img className="hdr-cart-icon" src={cartSVG} alt="" />
              {/* <span className="hdr-cart-icon">🛒</span> */}
              {totalUniqueItems > 0 && (
                <span className="hdr-cart-count">{totalUniqueItems}</span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
