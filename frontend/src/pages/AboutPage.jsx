import { Link } from "react-router-dom";

const AboutPage = () => (
  <div className="abp-about-page">
    <section className="abp-hero">
      <p className="abp-eyebrow">Чудо чай</p>
      <h1>О нас</h1>
      <p className="abp-lead">
        Мы молодая компания, которая хочет, чтобы у каждого была возможность
        покупать хороший чай по приятным ценам.
      </p>
    </section>

    <section className="abp-section abp-section-story">
      <div>
        <h2>Выбираем чай как для себя</h2>
        <p>
          Мы сами очень любим чай и выбираем поставщиков только с высоким
          качеством чая. Мы не продаем то, что сами не стали бы пить.
        </p>
      </div>
      <div className="abp-highlight">
        <span>Наш принцип</span>
        <strong>Честный выбор и приятная цена</strong>
      </div>
    </section>

    <section className="abp-section abp-pricing">
      <h2>Почему наши цены лояльные</h2>
      <p className="abp-section-intro">
        Мы стараемся делать хороший чай доступнее и не включать в его стоимость
        лишние расходы.
      </p>
      <ol>
        <li>
          <strong>Не платим за аренду.</strong>
          <span> Это помогает не повышать цену чая.</span>
        </li>
        <li>
          <strong>Упаковываем заказы сами.</strong>
          <span> Так мы контролируем процесс и избегаем лишних наценок.</span>
        </li>
        <li>
          <strong>Не включаем доставку в цену чая.</strong>
          <span> Стоимость доставки рассчитывается отдельно при оформлении заказа.</span>
        </li>
      </ol>
    </section>

    <section className="abp-section abp-delivery">
      <div>
        <h2>Работаем из Воронежа, доставляем по России</h2>
        <p>
          Мы находимся в Воронеже и отправляем заказы с чаем покупателям по всей
          России.
        </p>
      </div>
      <Link className="abp-catalog-link" to="/catalog">
        Выбрать чай
      </Link>
    </section>
  </div>
);

export default AboutPage;
