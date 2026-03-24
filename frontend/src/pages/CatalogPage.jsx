import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getProducts } from "../services/productService";
import "./CatalogPage.css";

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await getProducts();
        setProducts(response.data);
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleDetailsClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="catalog-page">
      <h1>Каталог чая</h1>
      <div className="products-grid">
        {products.map((product) => (
          <div key={product._id} className="product-card">
            <div className="product-image">
              {product.content && product.content[0] ? (
                <img
                  src={`/uploads/${product.content[0]}`}
                  alt={product.name}
                />
              ) : (
                <div className="no-image">Нет изображения</div>
              )}
            </div>
            <div className="product-info">
              <h3>{product.name}</h3>
              <p className="description">
                {product.description.substring(0, 100)}...
              </p>
              <div className="product-meta">
                <span className="price">
                  {((product.price / 100) * 10).toFixed(2)} ₽/10г
                </span>
                <span className="remains">Остаток: {product.remains} г</span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleDetailsClick(product._id)}
              >
                Подробнее
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CatalogPage;
