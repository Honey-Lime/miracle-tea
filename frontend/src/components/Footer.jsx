import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="ftr-footer">
      <div className="container">
        <div className="ftr-content">
          <div className="ftr-section">
            <h3>Чудо чай</h3>
            <p>Качественный чай по лояльной цене.</p>
          </div>
          <div className="ftr-section">
            <h4>Контакты</h4>
            <p>
              Email:{" "}
              <a className="ftr-inline-link" href="mailto:vikdub01@mail.ru">
                vikdub01@mail.ru
              </a>
            </p>
          </div>
          <div className="ftr-section">
            <h4>Навигация</h4>
            <Link to="/catalog">Каталог</Link>
            <Link to="/about">О нас</Link>
            <Link to="/cart">Корзина</Link>
            <Link to="/profile">Личный кабинет</Link>
          </div>
          <div className="ftr-section">
            <h4>Информация</h4>
            <Link to="/refund-policy">Возврат и обмен</Link>
            <Link to="/personal-data-policy">Политика конфиденциальности</Link>
          </div>
        </div>
        <div className="ftr-bottom">
          <p>&copy; {new Date().getFullYear()} Чудо чай. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
