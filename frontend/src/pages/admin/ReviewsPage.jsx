import { useEffect, useState } from "react";
import AdminUserMenu from "../../components/AdminUserMenu";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

const ReviewsPage = () => {
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentPhotos, setCommentPhotos] = useState({});

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/reviews/pending");
      setReviews(response.data);
      setCommentDrafts(
        response.data.reduce((drafts, review) => ({
          ...drafts,
          [review._id]: review.adminComment?.text || "",
        }), {}),
      );
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось загрузить отзывы", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const addCommentPhotos = (reviewId, files) => {
    const nextPhotos = Array.from(files || [])
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setCommentPhotos((prev) => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] || []), ...nextPhotos],
    }));
  };

  const removeCommentPhoto = (reviewId, index) => {
    setCommentPhotos((prev) => {
      const photos = prev[reviewId] || [];
      const photo = photos[index];
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return {
        ...prev,
        [reviewId]: photos.filter((_, photoIndex) => photoIndex !== index),
      };
    });
  };

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

  const saveAdminComment = async (reviewId) => {
    try {
      const text = commentDrafts[reviewId] || "";
      const formData = new FormData();
      formData.append("text", text);
      (commentPhotos[reviewId] || []).forEach((photo) => formData.append("photos", photo.file));
      const response = await api.put(`/admin/reviews/${reviewId}/comment`, formData);
      setReviews((prev) =>
        prev.map((review) =>
          review._id === reviewId ? { ...review, adminComment: response.data.adminComment } : review,
        ),
      );
      setCommentPhotos((prev) => {
        (prev[reviewId] || []).forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        return { ...prev, [reviewId]: [] };
      });
      addToast(text.trim() ? "Комментарий сохранён" : "Комментарий удалён", "success");
    } catch (error) {
      addToast(error.response?.data?.message || "Не удалось сохранить комментарий", "error");
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
              <span><AdminUserMenu user={review.userId} /> · {review.userId?.email}</span>
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
            <div className="ap-review-admin-comment">
              <label htmlFor={`admin-comment-${review._id}`}>Комментарий администратора</label>
              <textarea
                id={`admin-comment-${review._id}`}
                rows={3}
                value={commentDrafts[review._id] || ""}
                onChange={(event) =>
                  setCommentDrafts((prev) => ({ ...prev, [review._id]: event.target.value }))
                }
                placeholder="Комментарий будет показан под отзывом на странице товара"
              />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  addCommentPhotos(review._id, event.target.files);
                  event.target.value = "";
                }}
              />
              {(commentPhotos[review._id] || []).length > 0 && (
                <div className="ap-review-selected-photos">
                  {(commentPhotos[review._id] || []).map((photo, index) => (
                    <div className="ap-review-selected-photo" key={photo.previewUrl}>
                      <img src={photo.previewUrl} alt={`Выбранное фото ${index + 1}`} />
                      <button type="button" onClick={() => removeCommentPhoto(review._id, index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-secondary" type="button" onClick={() => saveAdminComment(review._id)}>
                Сохранить комментарий
              </button>
            </div>
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
