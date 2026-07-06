const HomePage = () => {
  return (
    <div className="hp-home-page">
      <section className="hp-hero">
        <div className="hp-hero-content container">
          <div className="hp-hero-copy">
            <h1>Чудо чай</h1>
            <p className="hp-subtitle">Качественный чай по лояльной цене</p>
            <div className="hp-hero-actions">
              <a href="/catalog">Каталог</a>
              <a href="/cart">Корзина</a>
            </div>
          </div>
          <img src="" alt="" />
        </div>
      </section>

      <section className="hp-intro hp-feature-row hp-feature-row-first">
        <div className="container">
          <div className="hp-feature-image hp-feature-image-left"></div>
          <div className="hp-feature-text">
            <h2>Настоящий Китай<br />в каждой заварке</h2>
            <p>
              В нашем каталоге вас ждут проверенные сорта, которые составят
              достойную конкуренцию дорогому премиум-сегменту.
            </p>
          </div>
        </div>
      </section>

      <section className="hp-benefits hp-feature-row">
        <div className="container">
          <div className="hp-feature-text hp-feature-text-left">
            <h2>Знак качества</h2>
            <p>
              Мы не доверяем выбор фасованным образцам вслепую. Перед тем как
              сорт попадёт на склад, его заваривает и оценивает наш
              мастер-тестер. Так мы гарантируем чистый вкус, правильную скрутку
              и отсутствие «дорваных» примесей.
            </p>
          </div>
          <div className="hp-feature-image hp-feature-image-right"></div>
        </div>
      </section>

      <section className="hp-sampler hp-feature-row">
        <div className="container">
          <div className="hp-feature-image hp-feature-image-bottom"></div>
          <div className="hp-feature-text">
            <h2>Снимите пробу</h2>
            <p>
              Не уверены в своём вкусе? Хотите сравнить несколько позиций без
              лишних трат? Можно заказать пробники по 10 г — это 2-3
              полноценные чайные церемонии. Удобный формат, чтобы найти «тот
              самый» чай.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
