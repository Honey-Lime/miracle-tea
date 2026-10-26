import { Link } from "react-router-dom";

const VK_URL = "https://vk.com/TODO";
const TELEGRAM_URL = "https://t.me/TODO";

const SOCIAL_LINKS = [
  {
    label: "ВКонтакте",
    href: VK_URL,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12.8 17.5c-6.1 0-9.6-4.2-9.7-11.2h3.1c.1 5.1 2.4 7.3 4.2 7.7V6.3h2.9v4.4c1.8-.2 3.7-2.2 4.3-4.4h2.9c-.5 2.7-2.5 4.7-3.9 5.5 1.4.7 3.7 2.4 4.5 5.7h-3.2c-.7-2.1-2.4-3.8-4.7-4v4h-.4Z"
        />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: TELEGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M21.4 4.6 2.9 11.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.8.8.8.5 0 .7-.2 1-.5l2.3-2.3 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.4-1.4ZM8.6 13.9l9.7-6.1c.5-.3.9-.1.5.2l-8.1 7.3-.3 3.5-1.8-4.9Z"
        />
      </svg>
    ),
  },
];

const PAYMENT_BADGES = [
  { label: "Т-Банк", text: "Т-Банк", width: 72 },
  { label: "СБП", text: "СБП", width: 48 },
  { label: "Visa", text: "VISA", width: 52 },
  { label: "Mastercard", mastercard: true, width: 40 },
  { label: "МИР", text: "МИР", width: 52 },
  { label: "СДЭК", text: "СДЭК", width: 56 },
];

const Badge = ({ label, text, mastercard, width }) => (
  <svg
    className="ftr-badge"
    viewBox={`0 0 ${width} 24`}
    width={width}
    height="24"
    role="img"
    aria-label={label}
  >
    {mastercard ? (
      <>
        <circle cx="14" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="26" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      </>
    ) : (
      <>
        <rect x="1" y="1" width={width - 2} height="22" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text
          x={width / 2}
          y="16.5"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="Jost, sans-serif"
          fontSize="13"
          fontWeight="500"
        >
          {text}
        </text>
      </>
    )}
  </svg>
);

const Footer = () => {
  return (
    <footer className="ftr-footer">
      <div className="container">
        <div className="ftr-content">
          <div className="ftr-section">
            <h3>Чудо чай</h3>
            <p>Качественный чай по лояльной цене.</p>
            <p>
              Email:{" "}
              <a className="ftr-inline-link" href="mailto:vikdub01@mail.ru">
                vikdub01@mail.ru
              </a>
            </p>
            <ul className="ftr-social">
              {SOCIAL_LINKS.map(({ label, href, icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                    {icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <nav className="ftr-section" aria-label="Навигация по сайту">
            <h4>Навигация</h4>
            <Link to="/catalog">Каталог</Link>
            <Link to="/about">О нас</Link>
            <Link to="/cart">Корзина</Link>
            <Link to="/profile">Личный кабинет</Link>
          </nav>
          <nav className="ftr-section" aria-label="Информация">
            <h4>Информация</h4>
            <Link to="/refund-policy">Возврат и обмен</Link>
            <Link to="/personal-data-policy">Политика конфиденциальности</Link>
          </nav>
          <div className="ftr-section">
            <h4>Оплата и доставка</h4>
            <ul className="ftr-badges">
              {PAYMENT_BADGES.map((badge) => (
                <li key={badge.label}>
                  <Badge {...badge} />
                </li>
              ))}
            </ul>
            <p className="ftr-note">
              Оплата через Т-Банк, доставка СДЭК (eShopLogistic).
            </p>
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
