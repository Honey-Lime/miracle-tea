import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import EditProductModal from "./EditProductModal";

const ProductsTab = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/admin/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      addToast("Ошибка загрузки товаров", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setShowEditModal(true);
  };

  const handleProductUpdated = (updatedProduct) => {
    setProducts((prev) =>
      prev.map((p) => (p._id === updatedProduct._id ? updatedProduct : p)),
    );
    setShowEditModal(false);
    setEditingProduct(null);
    addToast("Товар обновлен", "success");
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!confirm(`Вы уверены, что хотите удалить товар "${productName}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts((prev) => prev.filter((p) => p._id !== productId));
      addToast("Товар удален", "success");
    } catch (error) {
      addToast("Ошибка удаления товара", "error");
      console.error(error);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="products-tab">
      <div className="pt-header">
        <h3>Все товары</h3>
        <div className="pt-search-group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск товаров..."
            className="pt-search-input"
          />
        </div>
      </div>

      <div className="pt-products-list">
        <div className="pt-products-header">
          <span className="pt-col-name">Название</span>
          <span className="pt-col-price">Цена</span>
          <span className="pt-col-remains">Остаток</span>
          <span className="pt-col-tags">Теги</span>
          <span className="pt-col-actions">Действия</span>
        </div>

        {filteredProducts.length === 0 ? (
          <p className="pt-no-products">Товары не найдены</p>
        ) : (
          filteredProducts.map((product) => (
            <div key={product._id} className="pt-product-item">
              <span className="pt-col-name">
                {product.name}
                {product.images && product.images.length > 0 && (
                  <span
                    className="pt-media-indicator"
                    title={`${product.images.length} медиафайлов`}
                  >
                    📷 {product.images.length}
                  </span>
                )}
              </span>
              <span className="pt-col-price">{product.price} ₽</span>
              <span className="pt-col-remains">{product.remains} г</span>
              <span className="pt-col-tags">
                {product.tags && product.tags.length > 0 ? (
                  <div className="pt-tags-wrapper">
                    {product.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="pt-tag">
                        {tag}
                      </span>
                    ))}
                    {product.tags.length > 3 && (
                      <span className="pt-tag-more">
                        +{product.tags.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="pt-no-tags">-</span>
                )}
              </span>
              <span className="pt-col-actions">
                <button
                  className="pt-btn-edit"
                  onClick={() => handleEditClick(product)}
                  title="Редактировать"
                >
                  ✏️
                </button>
                <button
                  className="pt-btn-delete"
                  onClick={() => handleDeleteProduct(product._id, product.name)}
                  title="Удалить"
                >
                  🗑️
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {showEditModal && editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => {
            setShowEditModal(false);
            setEditingProduct(null);
          }}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  );
};

export default ProductsTab;
