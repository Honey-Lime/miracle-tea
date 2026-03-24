import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { getProduct } from "../services/productService";
import "./ProductPage.css";

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
    return <div className="product-loading">Загрузка товара...</div>;
  }

  if (error || !product) {
    return <div className="product-error">{error || "Товар не найден"}</div>;
  }

  const pricePerGram = product.price / 100;
  const totalPrice = (pricePerGram * selectedGrams).toFixed(2);
  const media = product.content || [];
  const isSamplerAvailable = product.remains >= 10;
  const hasSamplerInCart = cartItems.some(
    (item) => item.pid === product._id && item.isSampler === true,
  );

  return (
    <div className="product-page">
      <div className="product-container">
        {/* Левая колонка: медиа */}
        <div className="product-media">
          <div className="main-media">
            {media.length > 0 ? (
              media[activeMediaIndex].endsWith(".mp4") ||
              media[activeMediaIndex].endsWith(".webm") ? (
                <video controls src={`/uploads/${media[activeMediaIndex]}`} />
              ) : (
                <img
                  src={`/uploads/${media[activeMediaIndex]}`}
                  alt={product.name}
                />
              )
            ) : (
              <div className="no-media">Нет изображения</div>
            )}
          </div>
          {media.length > 1 && (
            <div className="media-thumbnails">
              {media.map((item, idx) => (
                <button
                  key={idx}
                  className={`thumbnail ${idx === activeMediaIndex ? "active" : ""}`}
                  onClick={() => setActiveMediaIndex(idx)}
                >
                  {item.endsWith(".mp4") || item.endsWith(".webm") ? (
                    <span>🎥</span>
                  ) : (
                    <img src={`/uploads/${item}`} alt={`${idx}`} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка: информация и покупка */}
        <div className="product-info">
          <h1 className="product-title">{product.name}</h1>
          <div className="product-price">
            <span className="price-value">
              {(pricePerGram * 10).toFixed(2)} ₽/10г
            </span>
            <span className="remains">Остаток: {product.remains} г</span>
          </div>

          <div className="product-description">
            <h3>Описание</h3>
            <p>{product.description}</p>
          </div>

          <div className="gram-selection">
            <h3>Выберите количество грамм</h3>
            <div className="gram-controls">
              <button
                className="gram-btn minus"
                onClick={() => handleGramChange(-10)}
                disabled={selectedGrams <= 50}
              >
                –10 г
              </button>
              <div className="gram-display">
                <input
                  type="number"
                  min="50"
                  max={product.remains}
                  value={selectedGrams}
                  onChange={(e) => handleSetGrams(Number(e.target.value))}
                />
                <span> г</span>
              </div>
              <button
                className="gram-btn plus"
                onClick={() => handleGramChange(10)}
                disabled={selectedGrams >= product.remains}
              >
                +10 г
              </button>
              <button
                className="gram-btn plus50"
                onClick={() => handleGramChange(50)}
                disabled={selectedGrams + 50 > product.remains}
              >
                +50 г
              </button>
            </div>
            <div className="gram-hint">
              Минимальный заказ — 50 г. Шаг изменения — 10 г.
            </div>
          </div>

          <div className="purchase-section">
            <div className="total-price">
              <span>Итого:</span>
              <strong>{totalPrice} ₽</strong>
              <span className="total-grams">({selectedGrams} г)</span>
            </div>
            <div className="action-buttons">
              <button
                className="btn btn-primary add-to-cart"
                onClick={() => handleAddToCart(false)}
                disabled={selectedGrams > product.remains}
              >
                Добавить в корзину
              </button>
              <button
                className="btn btn-secondary sampler"
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
            <p className="sampler-note">
              * Пробник можно добавить только один раз для каждого вида чая.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
