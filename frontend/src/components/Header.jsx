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
  const { totalUniqueItems, totalPrice } = useContext(CartContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="hdr-header">
      <div className="container">
        <div className="hdr-content">
          <div className="hdr-logo">
            <Link className="logo-block" to="/" aria-label="Чудо чай — на главную">
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
              aria-label="Основное меню"
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
                    Админка
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
                  title="Войти"
                  aria-label="Войти в личный кабинет"
                >
                  <img className="hdr-cart-icon" src={userSVG} alt="" />
                </button>
              )}
            </nav>
            <Link
              to="/cart"
              className="hdr-cart-link"
              title="Корзина"
              aria-label={
                totalUniqueItems > 0
                  ? `Корзина: ${totalUniqueItems} поз., ${totalPrice} ₽`
                  : "Корзина пуста"
              }
            >
              <img className="hdr-cart-icon" src={cartSVG} alt="" />
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
