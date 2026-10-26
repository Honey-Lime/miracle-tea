import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getProducts } from "../services/productService";
import { useCart } from "../context/CartContext";
import { useSamplerSettings } from "../context/SamplerSettingsContext";
import { getProductPath } from "../utils/productUrl";

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [gramCounts, setGramCounts] = useState({});
  const [sortOrder, setSortOrder] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart, cartItems } = useCart();
  const { samplerSizeGrams } = useSamplerSettings();
  const selectedTag = searchParams.get("tag") || null;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await getProducts();
        setProducts(response.data);
        // Инициализируем количество для каждого товара
        const initialGrams = {};
        response.data.forEach((product) => {
          const minCount = (product.unit || "grams") === "grams" ? 50 : 1;
          initialGrams[product._id] =
            product.remains < minCount ? product.remains : minCount;
        });
        setGramCounts(initialGrams);
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [reloadKey]);

  // Получаем все уникальные теги
  const allTags = [...new Set(products.flatMap((p) => p.tags || []))];

  // Фильтруем товары по выбранному тегу
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter(
    (product) =>
      (!selectedTag || product.tags?.includes(selectedTag)) &&
      (!normalizedQuery || product.name.toLowerCase().includes(normalizedQuery)),
  );

  const formatRub = (value) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
      Math.round(value * 100) / 100,
    );

  const displayedProducts = [...filteredProducts].sort((firstProduct, secondProduct) => {
    if (sortOrder === "price-asc") {
      return firstProduct.price - secondProduct.price;
    }

    if (sortOrder === "price-desc") {
      return secondProduct.price - firstProduct.price;
    }

    return 0;
  });

  const handleTagChange = (tag) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (tag) {
      nextSearchParams.set("tag", tag);
    } else {
      nextSearchParams.delete("tag");
    }

    setSearchParams(nextSearchParams);
  };

  const resetFilters = () => {
    setSearchQuery("");
    handleTagChange(null);
  };

  const handleGramChange = (product, delta) => {
    setGramCounts((prev) => {
      const minCount = (product.unit || "grams") === "grams" ? 50 : 1;
      const alreadyInCart = cartItems
        .filter((item) => item.pid === product._id)
        .reduce((sum, item) => sum + item.count, 0);
      const availableToAdd = Math.max(product.remains - alreadyInCart, 0);
      const currentGrams = prev[product._id] || minCount;
      const newGrams = currentGrams + delta;
      if (newGrams < minCount) {
        return { ...prev, [product._id]: minCount };
      } else if (newGrams > availableToAdd) {
        return { ...prev, [product._id]: availableToAdd };
      }
      return { ...prev, [product._id]: newGrams };
    });
  };

  const handleAddToCart = (product, grams) => {
    const minCount = (product.unit || "grams") === "grams" ? 50 : 1;
    const alreadyInCart = cartItems
      .filter((item) => item.pid === product._id)
      .reduce((sum, item) => sum + item.count, 0);
    const availableToAdd = Math.max(product.remains - alreadyInCart, 0);

    if (grams < minCount || grams > availableToAdd) {
      return;
    }

    addToCart(product, grams, false);
    setGramCounts((prev) => ({ ...prev, [product._id]: minCount }));
  };

  const handleAddSamplerToCart = (product) => {
    addToCart(product, samplerSizeGrams, true);
  };

  // Получить первое изображение (не видео) для отображения в каталоге
  const getFirstImage = (product) => {
    if (!product.images || product.images.length === 0) return null;
    // Если первый элемент - не видео, возвращаем его
    if (product.images[0].type !== "video") {
      return product.images[0];
    }
    // Иначе ищем первую фотографию
    const firstPhoto = product.images.find((img) => img.type !== "video");
    return firstPhoto || null;
  };

  if (loading) {
    return (
      <div className="cp-catalog-page" aria-busy="true">
        <div className="container">
          <h1>Качественный чай недорого</h1>
          <div className="cp-products-grid" aria-label="Загрузка каталога">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="cp-product-card cp-skeleton" aria-hidden="true">
                <div className="cp-skeleton-image" />
                <div className="cp-skeleton-line" />
                <div className="cp-skeleton-line cp-skeleton-line--short" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-catalog-page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/">Главная</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Каталог</span>
        </nav>
        <h1>Качественный чай недорого</h1>
        <p className="cp-price-note">
          Китайский, черный, зеленый и другой листовой чай. Цена указана за 100 г.
        </p>
        <p className="cp-seo-intro">
          Выбирайте качественный китайский чай недорого: улуны, пуэры, зеленые и
          красные сорта. Заказать чай можно от 50 г, чтобы познакомиться со вкусом
          без лишних расходов.
        </p>

        <div className="cp-catalog-controls">
          {allTags.length > 0 && (
            <div className="cp-tags-filter" role="group" aria-label="Фильтр по тегам">
              <button
                aria-pressed={!selectedTag}
                className={`cp-tag-filter-btn ${!selectedTag ? "active" : ""}`}
                onClick={() => handleTagChange(null)}
              >
                Все
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  aria-pressed={selectedTag === tag}
                  className={`cp-tag-filter-btn ${
                    selectedTag === tag ? "active" : ""
                  }`}
                  onClick={() => handleTagChange(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <label className="cp-search-filter">
            <span className="visually-hidden">Поиск по названию</span>
            <input
              type="search"
              className="cp-search-input"
              placeholder="Поиск по названию"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label className="cp-sort-filter">
            <span>Сортировка:</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="">По умолчанию</option>
              <option value="price-asc">Цена: по возрастанию</option>
              <option value="price-desc">Цена: по убыванию</option>
            </select>
          </label>
          </div>

        <div className="cp-products-grid">
        {loadError ? (
          <div className="cp-no-products" role="alert">
            <p>Не удалось загрузить каталог. Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" className="cp-reset-btn" onClick={() => setReloadKey((key) => key + 1)}>
              Повторить
            </button>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="cp-no-products">
            <p>По вашему запросу ничего не найдено</p>
            <button type="button" className="cp-reset-btn" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </div>
        ) : (
          displayedProducts.map((product) => {
            const isGrams = (product.unit || "grams") === "grams";
            const step = isGrams ? 50 : 1;
            const minCount = isGrams ? 50 : 1;
            const unitLabel = isGrams ? "г" : "шт";
            const alreadyInCart = cartItems
              .filter((item) => item.pid === product._id)
              .reduce((sum, item) => sum + item.count, 0);
            const availableToAdd = Math.max(product.remains - alreadyInCart, 0);
            const currentCount = gramCounts[product._id] || minCount;
            const canAddCurrentCount = currentCount >= minCount && currentCount <= availableToAdd;
            const isOutOfStock = product.remains < minCount;
            const isSamplerAvailable = isGrams && availableToAdd >= samplerSizeGrams;
            const hasSamplerInCart = cartItems.some(
              (item) => item.pid === product._id && item.isSampler === true,
            );
            return (
            <article key={product._id} className="cp-product-card">
              <Link
                className="cp-product-link"
                to={getProductPath(product)}
                aria-label={`Купить ${product.name}`}
              >
                <div className="cp-product-image">
                {getFirstImage(product) ? (
                  <img src={getFirstImage(product).url} alt={product.name} loading="lazy" decoding="async" />
                ) : (
                  <div className="cp-no-image">Нет изображения</div>
                )}
                </div>
               <div className="cp-product-info">
                  <h2>{product.name}</h2>
                </div>
              </Link>
              <div className="cp-product-info">
                {product.tags && product.tags.length > 0 && (
                  <div className="product-tags">
                    {product.tags.map((tag, index) => (
                      <span key={index} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {/* <p className="cp-description">
                  {product.description.substring(0, 100)}...
                </p> */}
                <div className="cp-product-meta">
                  <span className="cp-price">
                    {formatRub(product.price)}₽
                    <small className="cp-price-unit">{isGrams ? "за 100 г" : "за шт"}</small>
                  </span>
                  {isOutOfStock ? (
                    <span className="cp-remains cp-remains--out">Нет в наличии</span>
                  ) : product.remains < 250 && (
                    <span className="cp-remains">
                      Остаток {product.remains}{unitLabel}
                    </span>
                  )}
                </div>
                <div className="cp-cart-order">
                  <div className="gram-controls">
                    <button
                      className="gram-btn gram-btn_minus"
                      onClick={() =>
                        handleGramChange(product, -step)
                      }
                      aria-label={`Уменьшить на ${step} ${unitLabel}`}
                      disabled={currentCount - step < minCount}
                    >
                      -{step}
                    </button>
                    <span className="gram-count" aria-live="polite">
                      <span className="current">{currentCount}{unitLabel}</span>
                      <span className="line"></span>
                      <span className="price">{formatRub(product.price * currentCount * 0.01)}₽</span>
                    </span>
                    <button
                      className="gram-btn gram-btn_plus"
                      onClick={() =>
                        handleGramChange(product, step)
                      }
                      aria-label={`Увеличить на ${step} ${unitLabel}`}
                      disabled={currentCount + step > availableToAdd}
                    >
                      +{step}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cp-buy-btn"
                    onClick={() => handleAddToCart(product, currentCount)}
                    disabled={!canAddCurrentCount}
                  >
                    {isOutOfStock
                      ? "Нет в наличии"
                      : `В корзину · ${formatRub(product.price * currentCount * 0.01)}₽`}
                  </button>
                  <button
                    type="button"
                    className="cp-sampler-btn"
                    onClick={() => handleAddSamplerToCart(product)}
                    disabled={!isSamplerAvailable || hasSamplerInCart}
                  >
                    {hasSamplerInCart
                      ? "Пробник уже в корзине"
                      : `Пробник ${samplerSizeGrams} г`}
                  </button>
                </div>
              </div>
            </article>
          );})
        )}
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
