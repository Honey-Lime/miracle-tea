import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import "./Header.css";

const Header = () => {
  const { user, openLoginModal } = useContext(AuthContext);
  const { totalUniqueItems } = useContext(CartContext);

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <Link to="/">
              <h1>Чудо чай</h1>
            </Link>
            <p className="tagline">Качественный чай по лояльной цене</p>
          </div>
          <nav className="nav">
            <Link to="/">Главная</Link>
            <Link to="/catalog">Каталог</Link>
            <Link to="/cart">Корзина ({totalUniqueItems})</Link>
            {user ? (
              <Link to="/profile" className="profile-link">
                {user.name}
              </Link>
            ) : (
              <button className="btn-login" onClick={openLoginModal}>
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
