import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/productService";
import { getProductPath } from "../utils/productUrl";
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
  const [popularProducts, setPopularProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    getProducts()
      .then((response) => {
        if (!isActive) return;
        const inStock = response.data.filter(
          (product) => product.remains > 0 && product.images?.some((img) => img.type !== "video"),
        );
        setPopularProducts(inStock.slice(0, 4));
      })
      .catch((error) => console.error("Ошибка загрузки товаров:", error))
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="hp-home-page">
      <section className="hp-hero">
        <div className="container hp-hero-inner">
          <div className="hp-hero-copy">
            <h1>
              Качественный <span className="accent-script">чай</span> недорого с доставкой
            </h1>
            <p className="hp-subtitle">
              Китайский и листовой чай по честным ценам — от 50 г
            </p>
            <div className="hp-hero-actions">
              <Link className="btn btn--primary" to="/catalog">Перейти в каталог</Link>
              <Link className="btn btn--secondary" to="/about">О нас</Link>
            </div>
          </div>
          <img className="hp-hero-image" src={firstscreen} alt="Чайник, пиала и листья китайского чая" fetchpriority="high" width="1976" height="1636" />
        </div>
      </section>

      {(isLoading || popularProducts.length > 0) && (
        <section className="hp-popular" aria-labelledby="hp-popular-title" aria-busy={isLoading}>
          <h2 id="hp-popular-title">Популярное</h2>
          <ul className="hp-popular-list">
            {isLoading
              ? [0, 1, 2, 3].map((index) => (
                  <li key={index} className="hp-popular-card hp-skeleton" aria-hidden="true">
                    <span className="hp-skeleton-block hp-skeleton-image" />
                    <span className="hp-skeleton-block hp-skeleton-line" />
                    <span className="hp-skeleton-block hp-skeleton-line hp-skeleton-line--short" />
                  </li>
                ))
              : popularProducts.map((product) => {
                  const image = product.images.find((img) => img.type !== "video");
                  return (
                    <li key={product._id}>
                      <Link className="hp-popular-card" to={getProductPath(product)}>
                        <img src={image.url} alt={product.name} loading="lazy" decoding="async" width="400" height="400" />
                        <span className="hp-popular-name">{product.name}</span>
                        <span className="hp-popular-price">
                          {product.price} ₽ <small>за 100 г</small>
                        </span>
                        <span className="btn btn--primary hp-popular-cta">Выбрать</span>
                      </Link>
                    </li>
                  );
                })}
          </ul>
          <Link className="hp-popular-all" to="/catalog">
            Весь каталог →
          </Link>
        </section>
      )}

      <section className="hp-feature">
        <div className="container hp-feature-grid">
          <div className="hp-feature-media">
            <img className="hp-block-image" src={homepage1} alt="Заваренный китайский чай в пиале" loading="lazy" decoding="async" width="1103" height="986" />
            <img className="leaf1" src={leaf1} alt="" loading="lazy" decoding="async" />
            <img className="leaf2" src={leaf2} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="hp-feature-text">
            <h2>Качественный китайский чай<br />по доступной цене</h2>
            <p>
              В каталоге — китайский чай: улуны, пуэры, зеленые и красные сорта.
              Мы отбираем позиции с выразительным вкусом и предлагаем их по
              доступной цене без переплаты за дорогую упаковку.
            </p>
          </div>
        </div>
      </section>

      <section className="hp-feature hp-feature--reverse">
        <div className="container hp-feature-grid">
          <div className="hp-feature-media">
            <img className="hp-block-image" src={homepage2} alt="Мастер-тестер оценивает чай" loading="lazy" decoding="async" width="1103" height="986" />
            <img className="leaf3" src={leaf3} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="hp-feature-text">
            <h2>Знак качества</h2>
            <p>
              Мы не доверяем выбор фасованным образцам вслепую. Перед тем как
              сорт попадёт на склад, его заваривает и оценивает наш
              мастер-тестер. Так мы выбираем качественный чай с чистым вкусом,
              правильной скруткой и без «дорваных» примесей — недорого для
              ежедневного чаепития.
            </p>
          </div>
        </div>
      </section>

      <section className="hp-feature">
        <div className="container hp-feature-grid">
          <div className="hp-feature-media">
            <img className="hp-block-image" src={homepage3} alt="Пробники чая для знакомства со вкусом" loading="lazy" decoding="async" width="1103" height="986" />
            <img className="leaf4" src={leaf4} alt="" loading="lazy" decoding="async" />
          </div>
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

      <section className="hp-order-info" aria-labelledby="hp-order-title">
        <h2 id="hp-order-title">Как заказать</h2>
        <ol className="hp-order-steps">
          <li>
            <strong>Выберите чай</strong>
            <span>Заказ от 50 г, шаг — 50 г. Можно взять пробник {samplerSizeGrams} г.</span>
          </li>
          <li>
            <strong>Оформите заказ</strong>
            <span>Укажите контакты и пункт выдачи — стоимость доставки рассчитается отдельно.</span>
          </li>
          <li>
            <strong>Оплатите онлайн</strong>
            <span>Оплата на сайте, статус заказа виден в личном кабинете.</span>
          </li>
        </ol>
      </section>
    </div>
  );
};

export default HomePage;
