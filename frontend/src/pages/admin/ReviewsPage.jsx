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
            <small>Бонус за отзыв: {review.bonusAmount || 0}</small>
            <button className="btn btn-primary" type="button" onClick={() => approveReview(review._id)}>
              Одобрить
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ReviewsPage;
