import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProduct } from "../services/productService";

const ProductPage = () => {
  const { id } = useParams();
  const { addToCart, cartItems } = useCart();
  const { user, token } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGrams, setSelectedGrams] = useState(50);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewsSort, setReviewsSort] = useState("likes");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await getProduct(id);
        setProduct(response.data);
        const unit = response.data.unit || "grams";
        const minCount = unit === "grams" ? 50 : 1;
        setSelectedGrams(response.data.remains < minCount ? response.data.remains : minCount);
      } catch (err) {
        setError("Не удалось загрузить товар");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    fetch(`/api/reviews/product/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => response.json())
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]));
  }, [id, token]);

  const handleGramChange = (delta) => {
    if (!product) return;
    const unit = product.unit || "grams";
    const step = unit === "grams" ? 50 : 1;
    const minCount = unit === "grams" ? 50 : 1;
    const newGrams = selectedGrams + delta;
    if (newGrams < minCount) {
      setSelectedGrams(minCount);
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
      setSelectedGrams((product.unit || "grams") === "grams" ? 50 : 1); // сброс после добавления
    }
  };

  const handleSetGrams = (value) => {
    if (!product) return;
    const minCount = (product.unit || "grams") === "grams" ? 50 : 1;
    if (value < minCount) value = minCount;
    if (value > product.remains) value = product.remains;
    setSelectedGrams(value);
  };

  const handleReviewReaction = async (reviewId, type) => {
    if (!user || !token) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/reaction`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Не удалось сохранить реакцию");
      }

      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? { ...review, likes: data.likes, dislikes: data.dislikes, myReaction: data.myReaction }
            : review,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="pp-product-loading">Загрузка товара...</div>;
  }

  if (error || !product) {
    return <div className="pp-product-error">{error || "Товар не найден"}</div>;
  }

  const unit = product.unit || "grams";
  const isGrams = unit === "grams";
  const step = isGrams ? 50 : 1;
  const minCount = isGrams ? 50 : 1;
  const unitLabel = isGrams ? "г" : "шт";
  const pricePerUnit = isGrams ? product.price / 100 : product.price;
  const totalPrice = (pricePerUnit * selectedGrams).toFixed(2);
  const media = product.images || [];
  const isSamplerAvailable = product.remains >= 10;
  const hasSamplerInCart = cartItems.some(
    (item) => item.pid === product._id && item.isSampler === true,
  );
  const sortedReviews = [...reviews].sort((firstReview, secondReview) => {
    if (reviewsSort === "oldest") {
      return new Date(firstReview.date) - new Date(secondReview.date);
    }

    if (reviewsSort === "newest") {
      return new Date(secondReview.date) - new Date(firstReview.date);
    }

    if (reviewsSort === "dislikes") {
      return (secondReview.dislikes || 0) - (firstReview.dislikes || 0);
    }

    return (secondReview.likes || 0) - (firstReview.likes || 0);
  });

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
            <span className="pp-price-value">
              {product.price} ₽/{isGrams ? "100г" : "шт"}
            </span>
            {product.remains < 250 && (
              <span className="pp-remains">Остаток: {product.remains} {unitLabel}</span>
            )}
          </div>

          <div className="pp-product-description">
            <h3>Описание</h3>
            <p>{product.description}</p>
          </div>

          <div className="pp-gram-selection">
            <h3>Выберите количество</h3>
            <div className="pp-gram-controls">
              <button
                className="pp-gram-btn minus50"
                onClick={() => handleGramChange(-step)}
                disabled={selectedGrams - step < minCount}
              >
                -{step} {unitLabel}
              </button>
              <div className="pp-gram-display">
                <input
                  type="number"
                  min={minCount}
                  max={product.remains}
                  step={step}
                  value={selectedGrams}
                  onChange={(e) => handleSetGrams(Number(e.target.value))}
                />
                <span> {unitLabel}</span>
              </div>
              <button
                className="pp-gram-btn plus50"
                onClick={() => handleGramChange(step)}
                disabled={selectedGrams + step > product.remains}
              >
                +{step} {unitLabel}
              </button>
            </div>
            <div className="pp-gram-hint">Минимальный заказ — {minCount} {unitLabel}.</div>
          </div>

          <div className="pp-purchase-section">
            <div className="pp-total-price">
              <span>Итого:</span>
              <strong>{totalPrice} ₽</strong>
              <span className="pp-total-grams">({selectedGrams} {unitLabel})</span>
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
      <section className="pp-reviews-section">
        <div className="pp-reviews-header">
          <h2>Отзывы</h2>
          {reviews.length > 0 && (
            <label className="pp-reviews-sort">
              <span>Сортировка:</span>
              <select value={reviewsSort} onChange={(event) => setReviewsSort(event.target.value)}>
                <option value="likes">По лайкам</option>
                <option value="dislikes">По дизлайкам</option>
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
              </select>
            </label>
          )}
        </div>
        {reviews.length === 0 ? (
          <p>Отзывов пока нет.</p>
        ) : (
          <div className="pp-reviews-list">
            {sortedReviews.map((review) => (
              <article className="pp-review-card" key={review.id}>
                <div className="pp-review-header">
                  <strong>{review.name}</strong>
                  <span>{new Date(review.date).toLocaleDateString("ru-RU")}</span>
                </div>
                <p>{review.text}</p>
                {review.adminComment?.text && (
                  <div className="pp-review-admin-comment">
                    <strong>Ответ магазина</strong>
                    <p>{review.adminComment.text}</p>
                  </div>
                )}
                {review.photos?.length > 0 && (
                  <div className="pp-review-photos">
                    {review.photos.map((photo, index) => (
                      <a href={photo.url} target="_blank" rel="noreferrer" key={`${review.id}-${photo.url}`}>
                        <img src={photo.url} alt={`Фото к отзыву ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                )}
                <div className="pp-review-reactions">
                  <button
                    type="button"
                    className={review.myReaction === "like" ? "active" : ""}
                    onClick={() => handleReviewReaction(review.id, "like")}
                    disabled={!user}
                    title={user ? "Нравится" : "Войдите, чтобы поставить лайк"}
                  >
                    👍 {review.likes}
                  </button>
                  <button
                    type="button"
                    className={review.myReaction === "dislike" ? "active" : ""}
                    onClick={() => handleReviewReaction(review.id, "dislike")}
                    disabled={!user}
                    title={user ? "Не нравится" : "Войдите, чтобы поставить дизлайк"}
                  >
                    👎 {review.dislikes}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProductPage;
