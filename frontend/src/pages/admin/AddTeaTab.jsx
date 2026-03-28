import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const AddTeaTab = () => {
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  const fetchAvailableTags = async () => {
    try {
      const response = await axios.get("/api/admin/products/tags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableTags(response.data);
    } catch (error) {
      console.error("Ошибка загрузки тегов:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "content" ? value.split(",").map((s) => s.trim()) : value,
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

  const handleRemoveImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Drag and Drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...formData.images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setFormData((prev) => ({ ...prev, images: newImages }));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        cost: Number(formData.cost),
        remains: Number(formData.remains),
      };

      await axios.post("/api/admin/products", productData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      addToast("Чай успешно добавлен", "success");
      setFormData({
        name: "",
        content: "",
        description: "",
        price: "",
        cost: "",
        remains: "",
        tags: [],
        images: [],
      });
    } catch (error) {
      addToast("Ошибка при добавлении чая", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="att-add-tea-form" onSubmit={handleSubmit}>
      <div className="att-form-group">
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

      <div className="att-form-group">
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

      <div className="att-form-group">
        <label>Теги</label>
        {availableTags.length === 0 ? (
          <p className="att-no-tags">
            Теги отсутствуют. Создайте теги во вкладке "Теги".
          </p>
        ) : (
          <div className="att-tags-container">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`att-tag-btn ${
                  formData.tags.includes(tag) ? "active" : ""
                }`}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="att-form-group">
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

      <div className="att-form-row">
        <div className="att-form-group">
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

        <div className="att-form-group">
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

        <div className="att-form-group">
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

      <div className="att-form-group">
        <label>Медиафайлы (изображения и видео)</label>
        <p className="att-media-hint">
          Перетаскивайте файлы для изменения порядка. Поддерживаются: JPEG, PNG,
          WebP, GIF, MP4, WebM, MOV
        </p>

        {formData.images && formData.images.length > 0 && (
          <div className="att-images-list">
            {formData.images.map((media, index) => (
              <div
                key={index}
                className={`att-image-item ${
                  draggedIndex === index ? "dragging" : ""
                }`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="att-media-preview">
                  {media.type === "video" ? (
                    <video src={media.url} controls />
                  ) : (
                    <img src={media.url} alt={`Медиа ${index + 1}`} />
                  )}
                </div>
                <div className="att-media-overlay">
                  <span className="att-media-type">
                    {media.type === "video" ? "🎬" : "🖼️"}
                  </span>
                  <span className="att-media-order">{index + 1}</span>
                </div>
                <button
                  type="button"
                  className="att-remove-image"
                  onClick={() => handleRemoveImage(index)}
                  title="Удалить"
                >
                  ×
                </button>
                <div className="att-drag-handle">
                  <span>⋮⋮</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="att-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            id="media-upload"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
            className="att-file-input"
          />
          <label htmlFor="media-upload" className="att-upload-label">
            {uploading ? (
              <span>Загрузка...</span>
            ) : (
              <>
                <span className="att-upload-icon">📁</span>
                <span>Выберите файлы или перетащите сюда</span>
                <span className="att-upload-sub">
                  До 10 файлов, макс. 50MB каждый
                </span>
              </>
            )}
          </label>
        </div>
      </div>

      <button
        type="submit"
        className="att-btn-submit"
        disabled={loading || uploading}
      >
        {loading || uploading ? "Добавление..." : "Добавить"}
      </button>
    </form>
  );
};

export default AddTeaTab;
