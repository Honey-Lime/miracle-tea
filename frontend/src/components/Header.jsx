import { Link, NavLink } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import cartSVG from "/cart.svg";
import userSVG from "/user.svg";
import logoSVG from "/logo.svg";
// import background from "/first-screen-bg.png";


const Header = () => {
  const { user, isAdmin, openLoginModal } = useContext(AuthContext);
  const { totalUniqueItems } = useContext(CartContext);

  return (
    <header className="hdr-header">
      <div className="container">
        <div className="hdr-content">
          <div className="hdr-logo">
            <Link className="logo-block" to="/">
              <img className="hdr-cart-icon" src={logoSVG} alt="" />
              <h1 className="logo-miracle">Чудо</h1>
              <h1 className="logo-tea">чай</h1>
            </Link>
            <p className="hdr-tagline">Качественный чай по лояльной цене</p>
          </div>
          <nav className="hdr-nav">
            <NavLink to="/">Главная</NavLink>
            <NavLink to="/catalog">Каталог</NavLink>
            <Link to="/cart" className="hdr-cart-link" title="Корзина">
              <img className="hdr-cart-icon" src={cartSVG} alt="" />
              {/* <span className="hdr-cart-icon">🛒</span> */}
              {totalUniqueItems > 0 && (
                <span className="hdr-cart-count">{totalUniqueItems}</span>
              )}
            </Link>
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
              <button className="hdr-btn-login" onClick={openLoginModal} title="Вход">
                <img className="hdr-cart-icon" src={userSVG} alt="" />
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
