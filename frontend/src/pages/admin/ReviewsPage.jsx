import { useEffect, useState } from "react";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

const ReviewsPage = () => {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/reviews/pending");
      setReviews(response.data);
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить отзывы", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const approveReview = async (reviewId) => {
    try {
      await api.put(`/admin/reviews/${reviewId}/approve`);
      setReviews((prev) => prev.filter((review) => review._id !== reviewId));
      addToast("Отзыв одобрен, бонусы начислены", "success");
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось одобрить отзыв", "error");
    }
  };

  const rejectReview = async (reviewId) => {
    try {
      await api.put(`/admin/reviews/${reviewId}/reject`);
      setReviews((prev) => prev.filter((review) => review._id !== reviewId));
      addToast("Отзыв отклонён", "success");
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось отклонить отзыв", "error");
    }
  };

  return (
    <section className="ap-reviews-page">
      <h1>Модерация отзывов</h1>
      {loading && <p>Загрузка...</p>}
      {!loading && reviews.length === 0 && <p>Отзывов на модерации нет</p>}
      <div className="ap-reviews-list">
        {reviews.map((review) => (
          <article className="ap-review-card" key={review._id}>
            <div>
              <strong>{review.productId?.name || "Товар"}</strong>
              <span>{review.userId?.name || "Клиент"} · {review.userId?.email}</span>
            </div>
            <p>{review.text}</p>
            {review.photos?.length > 0 && (
              <div className="ap-review-photos">
                {review.photos.map((photo, index) => (
                  <a href={photo.url} target="_blank" rel="noreferrer" key={`${review._id}-${photo.url}`}>
                    <img src={photo.url} alt={`Фото к отзыву ${index + 1}`} />
                  </a>
                ))}
              </div>
            )}
            <small>Бонус за отзыв: {review.bonusAmount || 0}</small>
            <div className="ap-review-actions">
              <button className="btn btn-primary" type="button" onClick={() => approveReview(review._id)}>
                Одобрить
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => rejectReview(review._id)}>
                Отклонить
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ReviewsPage;
