import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const TagsTab = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [allTags, setAllTags] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);
  const [newTagName, setNewTagName] = useState("");
  const [contextMenuTag, setContextMenuTag] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setContextMenuTag(null);
    if (contextMenuTag) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenuTag]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }
    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tagsResponse, productsResponse] = await Promise.all([
        axios.get("/api/admin/products/tags", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/products", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setAllTags(tagsResponse.data);
      setProducts(productsResponse.data);
      setFilteredProducts(productsResponse.data);
    } catch (error) {
      addToast("Ошибка загрузки данных", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (productId, tag) => {
    if (!tag.trim()) {
      addToast("Введите название тега", "error");
      return;
    }
    try {
      await axios.put(
        "/api/admin/products/add-tag",
        { productId, tag: tag.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      addToast("Тег добавлен", "success");
      // Обновляем локально без перезагрузки
      setProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? { ...p, tags: [...(p.tags || []), tag.trim()] }
            : p,
        ),
      );
      setFilteredProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? { ...p, tags: [...(p.tags || []), tag.trim()] }
            : p,
        ),
      );
      // Обновляем список всех тегов если тег новый
      const trimmedTag = tag.trim();
      if (!allTags.includes(trimmedTag)) {
        setAllTags((prev) => [...prev, trimmedTag]);
      }
      setTagSearchQuery("");
      setShowTagDropdown(false);
      setActiveProductId(null);
    } catch (error) {
      if (error.response?.status === 400) {
        addToast(
          error.response.data.message || "Ошибка добавления тега",
          "error",
        );
      } else {
        addToast("Ошибка добавления тега", "error");
      }
      console.error(error);
    }
  };

  const handleRemoveTag = async (productId, tag) => {
    try {
      await axios.put(
        "/api/admin/products/remove-tag",
        { productId, tag },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      addToast("Тег удален", "success");
      // Обновляем локально без перезагрузки
      setProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? { ...p, tags: (p.tags || []).filter((t) => t !== tag) }
            : p,
        ),
      );
      setFilteredProducts((prev) =>
        prev.map((p) =>
          p._id === productId
            ? { ...p, tags: (p.tags || []).filter((t) => t !== tag) }
            : p,
        ),
      );
    } catch (error) {
      addToast("Ошибка удаления тега", "error");
      console.error(error);
    }
  };

  const filteredTagsForDropdown = (productId, currentTags) => {
    return allTags.filter(
      (tag) =>
        !currentTags.includes(tag) &&
        tag.toLowerCase().includes(tagSearchQuery.toLowerCase()),
    );
  };

  const handleCreateGlobalTag = async () => {
    if (!newTagName.trim()) {
      addToast("Введите название тега", "error");
      return;
    }
    try {
      await axios.post(
        "/api/admin/products/tags",
        { name: newTagName.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      addToast("Тег создан", "success");
      setAllTags((prev) => [...prev, newTagName.trim()]);
      setNewTagName("");
    } catch (error) {
      if (error.response?.status === 400) {
        addToast(
          error.response.data.message || "Ошибка создания тега",
          "error",
        );
      } else {
        addToast("Ошибка создания тега", "error");
      }
      console.error(error);
    }
  };

  const handleDeleteTag = async (tagName) => {
    try {
      await axios.delete("/api/admin/products/tags", {
        data: { name: tagName },
        headers: { Authorization: `Bearer ${token}` },
      });
      addToast("Тег удален", "success");
      setAllTags((prev) => prev.filter((t) => t !== tagName));
      // Удаляем тег из всех продуктов локально
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          tags: (p.tags || []).filter((t) => t !== tagName),
        })),
      );
      setFilteredProducts((prev) =>
        prev.map((p) => ({
          ...p,
          tags: (p.tags || []).filter((t) => t !== tagName),
        })),
      );
      setContextMenuTag(null);
    } catch (error) {
      addToast("Ошибка удаления тега", "error");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="tags-tab">
      <div className="tags-overview">
        <h3>Все теги</h3>
        {allTags.length === 0 ? (
          <p className="no-tags">Теги отсутствуют</p>
        ) : (
          <div className="all-tags-list">
            {allTags.map((tag, index) => (
              <span
                key={index}
                className="global-tag"
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuTag(contextMenuTag === tag ? null : tag);
                }}
              >
                {tag}
                {contextMenuTag === tag && (
                  <div
                    className="tag-context-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="context-menu-item delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTag(tag);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="create-tag-form">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateGlobalTag();
            }}
            placeholder="Новый тег..."
            className="new-tag-input"
          />
          <button
            type="button"
            className="add-tag-btn"
            onClick={handleCreateGlobalTag}
          >
            Создать
          </button>
        </div>
      </div>

      <div className="search-group">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск чая по названию..."
          className="search-input"
        />
      </div>

      <div className="products-tags-list">
        <h3>
          <span>{searchQuery.trim() ? "Результаты поиска" : "Все товары"}</span>
          <span className="count">{filteredProducts.length}</span>
        </h3>
        {filteredProducts.length === 0 ? (
          <p className="no-products">Товары не найдены</p>
        ) : (
          filteredProducts.map((product) => (
            <ProductTagItem
              key={product._id}
              product={product}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              allTags={allTags}
              tagSearchQuery={tagSearchQuery}
              setTagSearchQuery={setTagSearchQuery}
              showTagDropdown={showTagDropdown}
              setShowTagDropdown={setShowTagDropdown}
              activeProductId={activeProductId}
              setActiveProductId={setActiveProductId}
              filteredTagsForDropdown={filteredTagsForDropdown}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ProductTagItem = ({
  product,
  onAddTag,
  onRemoveTag,
  allTags,
  tagSearchQuery,
  setTagSearchQuery,
  showTagDropdown,
  setShowTagDropdown,
  activeProductId,
  setActiveProductId,
  filteredTagsForDropdown,
}) => {
  const isActive = activeProductId === product._id;

  const handleSelectTag = (tag) => {
    onAddTag(product._id, tag);
  };

  const handleInputFocus = () => {
    setActiveProductId(product._id);
    setShowTagDropdown(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowTagDropdown(false);
      setTagSearchQuery("");
    }, 200);
  };

  return (
    <div className="product-tag-item">
      <div className="product-info">
        <span className="product-name">{product.name}</span>
        <span className="product-remains">{product.remains}г</span>
      </div>
      <div className="product-tags">
        {product.tags && product.tags.length > 0 ? (
          product.tags.map((tag, index) => (
            <span key={index} className="tag">
              {tag}
              <button
                type="button"
                className="remove-tag-btn"
                onClick={() => onRemoveTag(product._id, tag)}
                title="Удалить тег"
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="no-tags">Нет тегов</span>
        )}
      </div>
      <div className="add-tag-form">
        <div className="tag-input-wrapper">
          <input
            type="text"
            value={isActive ? tagSearchQuery : ""}
            onChange={(e) => setTagSearchQuery(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Поиск тега..."
            className="new-tag-input"
          />
          {isActive && showTagDropdown && (
            <div className="tag-dropdown">
              {filteredTagsForDropdown(product._id, product.tags || []).length >
              0 ? (
                filteredTagsForDropdown(product._id, product.tags || []).map(
                  (tag, index) => (
                    <div
                      key={index}
                      className="tag-dropdown-item"
                      onClick={() => handleSelectTag(tag)}
                    >
                      {tag}
                    </div>
                  ),
                )
              ) : (
                <div className="tag-dropdown-empty">Нет доступных тегов</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagsTab;
