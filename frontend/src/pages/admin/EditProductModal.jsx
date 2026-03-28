import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const EditProductModal = ({ product, onClose, onProductUpdated }) => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    description: "",
    price: "",
    cost: "",
    remains: "",
    tags: [],
    images: [],
  });
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Инициализация формы данными продукта
    setFormData({
      name: product.name || "",
      content: Array.isArray(product.content) ? product.content.join(", ") : "",
      description: product.description || "",
      price: product.price?.toString() || "",
      cost: product.cost?.toString() || "",
      remains: product.remains?.toString() || "",
      tags: product.tags || [],
      images: product.images || [],
    });

    // Загрузка всех доступных тегов
    fetchAllTags();
  }, [product]);

  const fetchAllTags = async () => {
    try {
      const response = await axios.get("/api/admin/products/tags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllTags(response.data);
    } catch (error) {
      console.error("Ошибка загрузки тегов:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "content"
          ? value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : value,
    }));
  };

  const handleTagToggle = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      files.forEach((file) => {
        formDataUpload.append("media", file);
      });

      const response = await axios.post(
        "/api/admin/products/upload-media",
        formDataUpload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...response.data.files],
      }));
      addToast(`Загружено ${response.data.files.length} файлов`, "success");
    } catch (error) {
      addToast("Ошибка загрузки файлов", "error");
      console.error(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = async (index) => {
    if (!confirm("Вы уверены, что хотите удалить это изображение/видео?")) {
      return;
    }

    try {
      await axios.put(
        `/api/admin/products/${product._id}/delete-media`,
        { imageIndex: index },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setFormData((prev) => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      }));
      addToast("Файл удален", "success");
    } catch (error) {
      addToast("Ошибка удаления файла", "error");
      console.error(error);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Меняем местами элементы при перетаскивании
    const newImages = [...formData.images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setFormData((prev) => ({ ...prev, images: newImages }));
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      // Сохраняем новый порядок на сервере
      await axios.put(
        `/api/admin/products/${product._id}/reorder-media`,
        { images: formData.images },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setDraggedIndex(null);
    } catch (error) {
      addToast("Ошибка сохранения порядка", "error");
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        cost: formData.cost ? Number(formData.cost) : undefined,
        remains: Number(formData.remains),
        content: Array.isArray(formData.content) ? formData.content : [],
      };

      const response = await axios.put(
        `/api/admin/products/${product._id}`,
        productData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      onProductUpdated(response.data);
    } catch (error) {
      addToast("Ошибка обновления товара", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="epm-modal-overlay" onClick={onClose}>
      <div className="epm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="epm-modal-header">
          <h2>Редактирование товара</h2>
          <button className="epm-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="epm-modal-body">
          <form onSubmit={handleSubmit} className="epm-form">
            <div className="epm-form-group">
              <label htmlFor="name">Название</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Например: Да Хун Пао"
              />
            </div>

            <div className="epm-form-group">
              <label htmlFor="content">Содержимое (через запятую)</label>
              <input
                type="text"
                id="content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Например: улун, сильноферментированный"
              />
            </div>

            <div className="epm-form-group">
              <label>Теги</label>
              <div className="epm-tags-container">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`epm-tag-btn ${
                      formData.tags.includes(tag) ? "active" : ""
                    }`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="epm-form-group">
              <label htmlFor="description">Описание</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="4"
                placeholder="Описание чая..."
              />
            </div>

            <div className="epm-form-row">
              <div className="epm-form-group">
                <label htmlFor="price">Цена (₽)</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="epm-form-group">
                <label htmlFor="cost">Себестоимость (₽)</label>
                <input
                  type="number"
                  id="cost"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="epm-form-group">
                <label htmlFor="remains">Остаток на складе (г)</label>
                <input
                  type="number"
                  id="remains"
                  name="remains"
                  value={formData.remains}
                  onChange={handleChange}
                  required
                  min="0"
                />
              </div>
            </div>

            <div className="epm-form-group">
              <label>Медиафайлы (изображения и видео)</label>
              <p className="epm-media-hint">
                Перетаскивайте файлы для изменения порядка. Поддерживаются:
                JPEG, PNG, WebP, GIF, MP4, WebM, MOV
              </p>

              {formData.images && formData.images.length > 0 && (
                <div className="epm-media-list">
                  {formData.images.map((media, index) => (
                    <div
                      key={index}
                      className={`epm-media-item ${
                        draggedIndex === index ? "dragging" : ""
                      }`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="epm-media-preview">
                        {media.type === "video" ? (
                          <video src={media.url} controls />
                        ) : (
                          <img src={media.url} alt={`Медиа ${index + 1}`} />
                        )}
                      </div>
                      <div className="epm-media-overlay">
                        <span className="epm-media-type">
                          {media.type === "video" ? "🎬" : "🖼️"}
                        </span>
                        <span className="epm-media-order">{index + 1}</span>
                      </div>
                      <button
                        type="button"
                        className="epm-remove-media"
                        onClick={() => handleRemoveImage(index)}
                        title="Удалить"
                      >
                        ×
                      </button>
                      <div className="epm-drag-handle">
                        <span>⋮⋮</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="epm-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="media-upload"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="epm-file-input"
                />
                <label htmlFor="media-upload" className="epm-upload-label">
                  {uploading ? (
                    <span>Загрузка...</span>
                  ) : (
                    <>
                      <span className="epm-upload-icon">📁</span>
                      <span>Выберите файлы или перетащите сюда</span>
                      <span className="epm-upload-sub">
                        До 10 файлов, макс. 50MB каждый
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="epm-form-actions">
              <button
                type="button"
                className="epm-btn-cancel"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="epm-btn-save"
                disabled={loading || uploading}
              >
                {loading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
