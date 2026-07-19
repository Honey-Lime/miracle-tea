import homepage1 from "/homepage1.png";
import homepage2 from "/homepage2.png";
import homepage3 from "/homepage3.png";
import leaf1 from "/leaf1.png";
import leaf2 from "/leaf2.png";
import leaf3 from "/leaf3.png";
import leaf4 from "/leaf4.png";
import firstscreen from "/firstscreen.png";
import { useSamplerSettings } from "../context/SamplerSettingsContext";

const HomePage = () => {
  const { samplerSizeGrams } = useSamplerSettings();

  return (
    <div className="hp-home-page">
      <section className="hp-hero">
        <div className="hp-hero-content block">
          <div className="hp-hero-copy">
            <h1>Чудо чай</h1>
            <p className="hp-subtitle">Качественный чай по лояльной цене</p>
            <div className="hp-hero-actions">
              <a href="/catalog">Каталог</a>
              <a href="/cart">Корзина</a>
            </div>
          </div>
          <img className="firstscreen-image" src={firstscreen} alt="" />
        </div>
      </section>

      <section className="hp-intro hp-feature-row hp-feature-row-first">
        <div className="block">
          <img className="hp-block-image" src={homepage1} alt="" />
          <img className="leaf1" src={leaf1} alt="" />
          <img className="leaf2" src={leaf2} alt="" />
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
        <div className="block">
          <div className="hp-feature-text hp-feature-text-left">
            <h2>Знак качества</h2>
            <p>
              Мы не доверяем выбор фасованным образцам вслепую. Перед тем как
              сорт попадёт на склад, его заваривает и оценивает наш
              мастер-тестер. Так мы гарантируем чистый вкус, правильную скрутку
              и отсутствие «дорваных» примесей.
            </p>
          </div>
          <img className="hp-block-image" src={homepage2} alt="" />
          <img className="leaf3" src={leaf3} alt="" />
          {/* <div className="hp-feature-image hp-feature-image-right"></div> */}
        </div>
      </section>

      <section className="hp-sampler hp-feature-row">
        <div className="block">
          <img className="hp-block-image" src={homepage3} alt="" />
          <img className="leaf4" src={leaf4} alt="" />
          {/* <div className="hp-feature-image hp-feature-image-bottom"></div> */}
          <div className="hp-feature-text">
            <h2>Снимите пробу</h2>
            <p>
              Не уверены в своём вкусе? Хотите сравнить несколько позиций без
              лишних трат? Можно заказать пробники по {samplerSizeGrams} г — это 2-3
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
