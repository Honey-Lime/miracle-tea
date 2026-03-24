import "./HomePage.css";
import YandexDeliveryCalculator from "../components/YandexDeliveryCalculator";

const HomePage = () => {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="container">
          <h1>Чудо чай</h1>
          <p className="subtitle">
            Здесь вы можете заказать качественный чай по лояльной цене
          </p>
        </div>
      </section>

      <section className="benefits">
        <div className="container">
          <h2>Наши преимущества</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">🍃</div>
              <h3>Минимальный заказ 50г</h3>
              <p>Попробуйте небольшое количество, чтобы оценить вкус.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">💰</div>
              <h3>Цена не завышена</h3>
              <p>Доставка не включена в стоимость, поэтому цена честная.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🎁</div>
              <h3>Пробники по 10г</h3>
              <p>От 5 сортов чая. Идеально для знакомства с новинками.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="delivery">
        <div className="container">
          <h2>Доставка</h2>
          <p>
            Мы находимся в Воронеже и осуществляем доставку через{" "}
            <strong>Яндекс Доставку</strong>— сервис, который обеспечивает
            быструю и надежную доставку по всей России. Теперь доступна новая
            интеграция с <strong>Яндекс Доставкой Next Day Delivery</strong>,
            позволяющая рассчитать стоимость доставки на следующий день в
            крупные города России.
          </p>
          <YandexDeliveryCalculator />
        </div>
      </section>

      <section className="about">
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
