import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { getProduct } from "../services/productService";

const ProductPage = () => {
  const { id } = useParams();
  const { addToCart, cartItems } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGrams, setSelectedGrams] = useState(50);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await getProduct(id);
        setProduct(response.data);
      } catch (err) {
        setError("Не удалось загрузить товар");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleGramChange = (delta) => {
    if (!product) return;
    const newGrams = selectedGrams + delta;
    if (newGrams < 50) {
      setSelectedGrams(50);
    } else if (newGrams > product.remains) {
      setSelectedGrams(product.remains);
    } else {
      setSelectedGrams(newGrams);
    }
  };

  const handleAddToCart = (isSampler = false) => {
    if (!product) return;
    let grams = isSampler ? 10 : selectedGrams;
    // Проверка на пробник: ограничение 1 пробник каждого вида чая
    addToCart(product, grams, isSampler);
    if (!isSampler) {
      setSelectedGrams(50); // сброс после добавления
    }
  };

  const handleSetGrams = (value) => {
    if (!product) return;
    if (value < 50) value = 50;
    if (value > product.remains) value = product.remains;
    setSelectedGrams(value);
  };

  if (loading) {
    return <div className="pp-product-loading">Загрузка товара...</div>;
  }

  if (error || !product) {
    return <div className="pp-product-error">{error || "Товар не найден"}</div>;
  }

  const pricePerGram = product.price / 100;
  const totalPrice = (pricePerGram * selectedGrams).toFixed(2);
  const media = product.images || [];
  const isSamplerAvailable = product.remains >= 10;
  const hasSamplerInCart = cartItems.some(
    (item) => item.pid === product._id && item.isSampler === true,
  );

  return (
    <div className="pp-product-page container">
      <nav className="breadcrumbs">
        <Link to="/catalog">Каталог</Link> / <span>{product.name}</span>
      </nav>
      <div className="pp-product-container">
        {/* Левая колонка: медиа */}
        <div className="pp-product-media">
          <div className="pp-main-media">
            {media.length > 0 ? (
              media[activeMediaIndex].type === "video" ? (
                <video
                  autoPlay
                  muted
                  playsInline
                  loop
                  src={media[activeMediaIndex].url}
                />
              ) : (
                <img src={media[activeMediaIndex].url} alt={product.name} />
              )
            ) : (
              <div className="pp-no-media">Нет изображения</div>
            )}
          </div>
          {media.length > 1 && (
            <div className="pp-media-thumbnails">
              {media.map((item, idx) => (
                <button
                  key={idx}
                  className={`pp-thumbnail ${
                    idx === activeMediaIndex ? "active" : ""
                  }`}
                  onClick={() => setActiveMediaIndex(idx)}
                >
                  {item.type === "video" ? (
                    <span>🎥</span>
                  ) : (
                    <img src={item.url} alt={`${idx}`} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка: информация и покупка */}
        <div className="pp-product-info">
          <h1 className="pp-product-title">{product.name}</h1>
          {product.tags && product.tags.length > 0 && (
            <div className="product-tags">
              {product.tags.map((tag, index) => (
                <span key={index} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="pp-product-price">
            <span className="pp-price-value">{product.price} ₽/100г</span>
            {product.remains < 250 && (
              <span className="pp-remains">Остаток: {product.remains} г</span>
            )}
          </div>

          <div className="pp-product-description">
            <h3>Описание</h3>
            <p>{product.description}</p>
          </div>

          <div className="pp-gram-selection">
            <h3>Выберите количество грамм</h3>
            <div className="pp-gram-controls">
              <button
                className="pp-gram-btn minus50"
                onClick={() => handleGramChange(-50)}
                disabled={selectedGrams - 50 < 50}
              >
                -50 г
              </button>
              <div className="pp-gram-display">
                <input
                  type="number"
                  min="50"
                  max={product.remains}
                  step="50"
                  value={selectedGrams}
                  onChange={(e) => handleSetGrams(Number(e.target.value))}
                />
                <span> г</span>
              </div>
              <button
                className="pp-gram-btn plus50"
                onClick={() => handleGramChange(50)}
                disabled={selectedGrams + 50 > product.remains}
              >
                +50 г
              </button>
            </div>
            <div className="pp-gram-hint">Минимальный заказ — 50 г.</div>
          </div>

          <div className="pp-purchase-section">
            <div className="pp-total-price">
              <span>Итого:</span>
              <strong>{totalPrice} ₽</strong>
              <span className="pp-total-grams">({selectedGrams} г)</span>
            </div>
            <div className="pp-action-buttons">
              <button
                className="pp-btn pp-btn-primary"
                onClick={() => handleAddToCart(false)}
                disabled={selectedGrams > product.remains}
                title="Добавить в корзину"
              >
                🛒
              </button>
              <button
                className="pp-btn pp-btn-secondary"
                onClick={() => handleAddToCart(true)}
                disabled={!isSamplerAvailable || hasSamplerInCart}
                title={
                  hasSamplerInCart
                    ? "Пробник уже добавлен"
                    : "Пробник 10 г (можно добавить только один)"
                }
              >
                Хочу пробник (10 г)
              </button>
            </div>
            <p className="pp-sampler-note">
              * Пробник можно добавить только один раз для каждого вида чая.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
