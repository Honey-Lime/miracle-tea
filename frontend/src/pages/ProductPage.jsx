import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProduct } from "../services/productService";
import api from "../services/api";
import AdminUserMenu from "../components/AdminUserMenu";

const ProductPage = () => {
  const { id } = useParams();
  const { addToCart, cartItems } = useCart();
  const { user, token, isAdmin } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGrams, setSelectedGrams] = useState(50);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewsSort, setReviewsSort] = useState("likes");
  const [reviewPhotoViewer, setReviewPhotoViewer] = useState(null);
  const [adminCommentEditorOpen, setAdminCommentEditorOpen] = useState({});
  const [adminCommentDrafts, setAdminCommentDrafts] = useState({});
  const [adminCommentExistingPhotos, setAdminCommentExistingPhotos] = useState({});
  const [adminCommentPhotos, setAdminCommentPhotos] = useState({});
  const [adminCommentDropActive, setAdminCommentDropActive] = useState({});

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
      .then((data) => {
        const nextReviews = Array.isArray(data) ? data : [];
        setReviews(nextReviews);
        setAdminCommentDrafts(
          nextReviews.reduce((drafts, review) => ({
            ...drafts,
            [review.id]: review.adminComment?.text || "",
          }), {}),
        );
        setAdminCommentExistingPhotos(
          nextReviews.reduce((photos, review) => ({
            ...photos,
            [review.id]: review.adminComment?.photos || [],
          }), {}),
        );
      })
      .catch(() => setReviews([]));
  }, [id, token]);

  useEffect(() => {
    if (!window.location.hash || reviews.length === 0) return;
    const target = document.querySelector(window.location.hash);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reviews]);

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

  const saveAdminComment = async (reviewId) => {
    const formData = new FormData();
    formData.append("text", adminCommentDrafts[reviewId] || "");
    formData.append(
      "keptPhotoUrls",
      JSON.stringify((adminCommentExistingPhotos[reviewId] || []).map((photo) => photo.url)),
    );
    (adminCommentPhotos[reviewId] || []).forEach((photo) => formData.append("photos", photo));

    try {
      const response = await api.put(`/admin/reviews/${reviewId}/comment`, formData);
      setReviews((prev) => prev.map((review) => (
        review.id === reviewId ? { ...review, adminComment: response.data.adminComment } : review
      )));
      setAdminCommentExistingPhotos((prev) => ({
        ...prev,
        [reviewId]: response.data.adminComment?.photos || [],
      }));
      setAdminCommentPhotos((prev) => ({ ...prev, [reviewId]: [] }));
      setAdminCommentEditorOpen((prev) => ({ ...prev, [reviewId]: false }));
    } catch (err) {
      alert(err.response?.data?.message || "Не удалось сохранить комментарий");
    }
  };

  const deleteAdminComment = async (reviewId) => {
    const formData = new FormData();
    formData.append("text", "");
    formData.append("keptPhotoUrls", JSON.stringify([]));

    try {
      const response = await api.put(`/admin/reviews/${reviewId}/comment`, formData);
      setReviews((prev) => prev.map((review) => (
        review.id === reviewId ? { ...review, adminComment: response.data.adminComment } : review
      )));
      setAdminCommentDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      setAdminCommentExistingPhotos((prev) => ({ ...prev, [reviewId]: [] }));
      setAdminCommentPhotos((prev) => ({ ...prev, [reviewId]: [] }));
      setAdminCommentEditorOpen((prev) => ({ ...prev, [reviewId]: false }));
    } catch (err) {
      alert(err.response?.data?.message || "Не удалось удалить комментарий");
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
  const closeReviewPhotoViewer = () => setReviewPhotoViewer(null);
  const showPrevReviewPhoto = () => {
    setReviewPhotoViewer((viewer) => viewer && {
      ...viewer,
      index: viewer.index === 0 ? viewer.photos.length - 1 : viewer.index - 1,
    });
  };
  const showNextReviewPhoto = () => {
    setReviewPhotoViewer((viewer) => viewer && {
      ...viewer,
      index: viewer.index === viewer.photos.length - 1 ? 0 : viewer.index + 1,
    });
  };

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
              <article className="pp-review-card" id={`review-${review.id}`} key={review.id}>
                <div className="pp-review-header">
                  <strong>
                    {isAdmin ? <AdminUserMenu user={review.user} fallback={review.name} /> : review.name}
                  </strong>
                  <span>{new Date(review.date).toLocaleDateString("ru-RU")}</span>
                </div>
                <p>{review.text}</p>
                {review.adminComment?.text && (
                  <div className="pp-review-admin-comment">
                    <strong>Ответ магазина</strong>
                    <p>{review.adminComment.text}</p>
                    {review.adminComment.photos?.length > 0 && (
                      <div className="pp-review-photos">
                        {review.adminComment.photos.map((photo, index) => (
                          <button
                            type="button"
                            key={`admin-${review.id}-${photo.url}`}
                            onClick={() => setReviewPhotoViewer({ photos: review.adminComment.photos, index })}
                          >
                            <img src={photo.url} alt={`Фото ответа магазина ${index + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <>
                    <button
                      className="btn btn-secondary pp-admin-comment-toggle"
                      type="button"
                      onClick={() => setAdminCommentEditorOpen((prev) => ({ ...prev, [review.id]: !prev[review.id] }))}
                    >
                      Дать комментарий
                    </button>
                    {adminCommentEditorOpen[review.id] && (
                      <div className="pp-admin-review-comment-form">
                        <label>Комментарий администратора</label>
                        <textarea
                          rows={3}
                          value={adminCommentDrafts[review.id] || ""}
                          onChange={(event) => setAdminCommentDrafts((prev) => ({ ...prev, [review.id]: event.target.value }))}
                          placeholder="Ответ магазина под отзывом"
                        />
                        {(adminCommentExistingPhotos[review.id] || []).length > 0 && (
                          <div className="pp-admin-comment-files">
                            {(adminCommentExistingPhotos[review.id] || []).map((photo) => (
                              <div className="pp-admin-comment-file" key={photo.url}>
                                <img src={photo.url} alt="Прикрепленное фото" />
                                <button
                                  type="button"
                                  onClick={() => setAdminCommentExistingPhotos((prev) => ({
                                    ...prev,
                                    [review.id]: (prev[review.id] || []).filter((item) => item.url !== photo.url),
                                  }))}
                                >
                                  Удалить
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {(adminCommentPhotos[review.id] || []).length > 0 && (
                          <div className="pp-admin-comment-files">
                            {(adminCommentPhotos[review.id] || []).map((photo, index) => (
                              <div className="pp-admin-comment-file" key={`${photo.name}-${photo.lastModified}-${index}`}>
                                <img src={URL.createObjectURL(photo)} alt="Новое прикрепленное фото" />
                                <button
                                  type="button"
                                  onClick={() => setAdminCommentPhotos((prev) => ({
                                    ...prev,
                                    [review.id]: (prev[review.id] || []).filter((_, photoIndex) => photoIndex !== index),
                                  }))}
                                >
                                  Удалить
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label
                          className={`pp-admin-comment-dropzone ${adminCommentDropActive[review.id] ? "dragging" : ""}`}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            setAdminCommentDropActive((prev) => ({ ...prev, [review.id]: true }));
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setAdminCommentDropActive((prev) => ({ ...prev, [review.id]: true }));
                          }}
                          onDragLeave={() => setAdminCommentDropActive((prev) => ({ ...prev, [review.id]: false }))}
                          onDrop={(event) => {
                            event.preventDefault();
                            setAdminCommentDropActive((prev) => ({ ...prev, [review.id]: false }));
                            setAdminCommentPhotos((prev) => ({
                              ...prev,
                              [review.id]: Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/")),
                            }));
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => setAdminCommentPhotos((prev) => ({
                              ...prev,
                              [review.id]: Array.from(event.target.files || []),
                            }))}
                          />
                          {(adminCommentPhotos[review.id] || []).length > 0
                            ? `Выбрано новых фото: ${adminCommentPhotos[review.id].length}`
                            : "Перетащите фото или выберите файлы"}
                        </label>
                        <div className="pp-admin-comment-actions">
                          <button className="btn btn-secondary" type="button" onClick={() => saveAdminComment(review.id)}>
                            Сохранить комментарий
                          </button>
                          <button className="btn btn-secondary" type="button" onClick={() => deleteAdminComment(review.id)}>
                            Удалить комментарий
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {review.photos?.length > 0 && (
                  <div className="pp-review-photos">
                    {review.photos.map((photo, index) => (
                      <button
                        type="button"
                        key={`${review.id}-${photo.url}`}
                        onClick={() => setReviewPhotoViewer({ photos: review.photos, index })}
                      >
                        <img src={photo.url} alt={`Фото к отзыву ${index + 1}`} />
                      </button>
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
      {reviewPhotoViewer && (
        <div className="pp-review-photo-modal" onClick={closeReviewPhotoViewer}>
          <div className="pp-review-photo-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="pp-review-photo-close" type="button" onClick={closeReviewPhotoViewer}>×</button>
            <button className="pp-review-photo-nav prev" type="button" onClick={showPrevReviewPhoto}>‹</button>
            <img
              src={reviewPhotoViewer.photos[reviewPhotoViewer.index].url}
              alt={`Фото отзыва ${reviewPhotoViewer.index + 1}`}
            />
            <button className="pp-review-photo-nav next" type="button" onClick={showNextReviewPhoto}>›</button>
            <div className="pp-review-photo-counter">
              {reviewPhotoViewer.index + 1} / {reviewPhotoViewer.photos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
