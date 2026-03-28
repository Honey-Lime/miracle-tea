import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getProducts } from "../services/productService";
import { useCart } from "../context/CartContext";

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gramCounts, setGramCounts] = useState({});
  const [selectedTag, setSelectedTag] = useState(null);
  const navigate = useNavigate();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await getProducts();
        setProducts(response.data);
        // Инициализируем граммовку для каждого товара (50г по умолчанию)
        const initialGrams = {};
        response.data.forEach((product) => {
          initialGrams[product._id] = 50;
        });
        setGramCounts(initialGrams);
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Получаем все уникальные теги
  const allTags = [...new Set(products.flatMap((p) => p.tags || []))];

  // Фильтруем товары по выбранному тегу
  const filteredProducts = selectedTag
    ? products.filter((product) => product.tags?.includes(selectedTag))
    : products;

  const handleGramChange = (productId, delta, maxRemains) => {
    setGramCounts((prev) => {
      const currentGrams = prev[productId] || 50;
      const newGrams = currentGrams + delta;
      if (newGrams < 50) {
        return { ...prev, [productId]: 50 };
      } else if (newGrams > maxRemains) {
        return { ...prev, [productId]: maxRemains };
      }
      return { ...prev, [productId]: newGrams };
    });
  };

  const handleAddToCart = (product, grams) => {
    addToCart(product, grams, false);
    // Сбрасываем граммовку до 50г после добавления
    setGramCounts((prev) => ({ ...prev, [product._id]: 50 }));
  };

  const handleCardClick = (e, productId) => {
    // Не переходим на страницу товара, если кликнули на кнопки управления
    if (
      e.target.closest(".gram-btn") ||
      e.target.closest(".cp-add-to-cart-btn")
    ) {
      return;
    }
    navigate(`/product/${productId}`);
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

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="cp-catalog-page container">
      <nav className="breadcrumbs">
        <Link to="/catalog">Каталог</Link>
      </nav>
      <h1>Каталог чая</h1>
      <p className="cp-price-note">*Цена указана за 100г</p>

      {/* Фильтр по тегам */}
      {allTags.length > 0 && (
        <div className="cp-tags-filter">
          <button
            className={`cp-tag-filter-btn ${!selectedTag ? "active" : ""}`}
            onClick={() => setSelectedTag(null)}
          >
            Все
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`cp-tag-filter-btn ${
                selectedTag === tag ? "active" : ""
              }`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="cp-products-grid">
        {filteredProducts.length === 0 ? (
          <p className="cp-no-products">Товары с выбранным тегом не найдены</p>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product._id}
              className="cp-product-card"
              onClick={(e) => handleCardClick(e, product._id)}
            >
              <div className="cp-product-image">
                {getFirstImage(product) ? (
                  <img src={getFirstImage(product).url} alt={product.name} />
                ) : (
                  <div className="cp-no-image">Нет изображения</div>
                )}
              </div>
              <div className="cp-product-info">
                <h2>{product.name}</h2>
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
                  <span className="cp-price">{product.price}₽</span>
                  {product.remains < 250 && (
                    <span className="cp-remains">
                      Остаток {product.remains}г
                    </span>
                  )}
                </div>
                <div className="cp-cart-order">
                  <div className="gram-controls">
                    <button
                      className="gram-btn gram-btn_minus"
                      onClick={() =>
                        handleGramChange(product._id, -50, product.remains)
                      }
                      disabled={(gramCounts[product._id] || 50) - 50 < 50}
                    >
                      -50
                    </button>
                    <span className="gram-count">
                      {gramCounts[product._id] || 50}г
                    </span>
                    <button
                      className="gram-btn gram-btn_plus"
                      onClick={() =>
                        handleGramChange(product._id, 50, product.remains)
                      }
                      disabled={
                        (gramCounts[product._id] || 50) + 50 > product.remains
                      }
                    >
                      +50
                    </button>
                  </div>
                  <button
                    className="btn btn-primary cp-add-to-cart-btn"
                    onClick={() =>
                      handleAddToCart(product, gramCounts[product._id] || 50)
                    }
                    disabled={(gramCounts[product._id] || 50) > product.remains}
                    title="Добавить в корзину"
                  >
                    🛒
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CatalogPage;
