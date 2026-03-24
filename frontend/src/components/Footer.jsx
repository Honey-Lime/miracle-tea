import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Чудо чай</h3>
            <p>
              Качественный чай по лояльной цене. Доставка по Воронежу и через
              СДЭК.
            </p>
          </div>
          <div className="footer-section">
            <h4>Контакты</h4>
            <p>Email: vikdub01@mail.ru</p>
            <p>Телефон: +7 (XXX) XXX-XX-XX</p>
          </div>
          <div className="footer-section">
            <h4>Быстрые ссылки</h4>
            <a href="/catalog">Каталог</a>
            <a href="/cart">Корзина</a>
            <a href="/profile">Личный кабинет</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Чудо чай. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
