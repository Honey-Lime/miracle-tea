import { useState } from "react";
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
  });
  const [loading, setLoading] = useState(false);

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
        <div className="att-tags-container">
          {["черный", "зеленый", "белый", "улун", "пуэр"].map((tag) => (
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

      <button type="submit" className="att-btn-submit" disabled={loading}>
        {loading ? "Добавление..." : "Добавить"}
      </button>
    </form>
  );
};

export default AddTeaTab;
