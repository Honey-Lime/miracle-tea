import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const SupplyTab = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [allProducts, setAllProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Загрузка всех товаров при монтировании компонента
  useEffect(() => {
    const fetchProducts = async () => {
      setFetching(true);
      try {
        const response = await axios.get("/api/admin/products", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAllProducts(response.data);
        setFilteredProducts(response.data);
      } catch (error) {
        addToast("Ошибка при загрузке товаров", "error");
        console.error(error);
      } finally {
        setFetching(false);
      }
    };

    fetchProducts();
  }, [token, addToast]);

  // Динамическая фильтрация при изменении поискового запроса
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(allProducts);
      return;
    }

    const filtered = allProducts.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredProducts(filtered);
  }, [searchQuery, allProducts]);

  const handleAddStock = async () => {
    if (!selectedProduct || !quantity) {
      addToast("Выберите чай и укажите количество", "error");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        "/api/admin/products/stock",
        {
          productId: selectedProduct._id,
          quantity: Number(quantity),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      addToast(
        `Добавлено ${quantity}г чая "${selectedProduct.name}"`,
        "success",
      );
      setSelectedProduct(null);
      setQuantity("");
      setSearchQuery("");
    } catch (error) {
      addToast("Ошибка при добавлении поставки", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supply-tab">
      {selectedProduct && (
        <div className="add-stock-section">
          <h3>Добавление поставки</h3>
          <div className="selected-product">
            <strong>Выбран чай:</strong> {selectedProduct.name}
          </div>
          <div className="quantity-group">
            <label htmlFor="quantity">Количество добавляемых грамм</label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Введите количество"
              min="1"
              className="quantity-input"
            />
          </div>
          <button
            className="btn-add-stock"
            onClick={handleAddStock}
            disabled={loading || !quantity}
          >
            {loading ? "Добавление..." : "Добавить"}
          </button>
        </div>
      )}

      <div className="search-group">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск чая по названию..."
          className="search-input"
        />
      </div>

      {fetching ? (
        <div className="loading">Загрузка товаров...</div>
      ) : (
        <div className="search-results">
          <h3>
            <span>
              {searchQuery.trim() ? "Результаты поиска" : "Все товары"}
            </span>
            <span className="count">{filteredProducts.length}</span>
          </h3>
          {filteredProducts.length === 0 ? (
            <p className="no-results">Товары не найдены</p>
          ) : (
            <ul className="results-list">
              {filteredProducts.map((product) => (
                <li
                  key={product._id}
                  className={`result-item ${
                    selectedProduct?._id === product._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedProduct(product);
                    setQuantity("");
                  }}
                >
                  <span className="product-name">{product.name}</span>
                  <span className="product-info">
                    {product.remains}г | {product.price}₽
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplyTab;
