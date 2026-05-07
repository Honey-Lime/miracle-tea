const HomePage = () => {
  return (
    <div className="hp-home-page">
      <section className="hp-hero">
        <div className="container">
          <h1>Чудо чай</h1>
          <p className="hp-subtitle">
            Здесь вы можете заказать качественный чай по лояльной цене
          </p>
        </div>
      </section>

      <section className="hp-benefits">
        <div className="container">
          <h2>Наши преимущества</h2>
          <div className="hp-benefits-grid">
            <div className="hp-benefit-card">
              <div className="hp-benefit-icon">🍃</div>
              <h3>Минимальный заказ 50г</h3>
              <p>Попробуйте небольшое количество, чтобы оценить вкус.</p>
            </div>
            <div className="hp-benefit-card">
              <div className="hp-benefit-icon">✅</div>
              <h3>Знак качества</h3>
              <p>Чай только высокого качества. Каждый продигустирован лично.</p>
            </div>
            <div className="hp-benefit-card">
              <div className="hp-benefit-icon">🎁</div>
              <h3>Снимите пробу</h3>
              <p>Можно заказать пробники по 10г</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hp-about">
        <div className="container">
          <h2>О нас</h2>
          <p>
            По всем вопросам вы можете обратиться в чат на сайте или по
            электронной почте{" "}
            <a href="mailto:vikdub01@mail.ru">vikdub01@mail.ru</a>
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
