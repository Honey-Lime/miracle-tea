import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const StatisticsTab = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    if (!stats?.productStats) return;

    if (!searchQuery.trim()) {
      setFilteredProducts(stats.productStats);
      return;
    }

    const filtered = stats.productStats.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredProducts(filtered);
  }, [searchQuery, stats]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/admin/statistics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
      setFilteredProducts(response.data.productStats || []);
    } catch (error) {
      addToast("Ошибка загрузки статистики", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка статистики...</div>;
  }

  if (!stats) {
    return <div className="st-no-data">Нет данных для отображения</div>;
  }

  return (
    <div className="st-statistics-tab">
      <h3>Статистика</h3>

      {/* Общие показатели */}
      <div className="st-overview-block">
        <div className="st-overview-card">
          <span className="st-overview-label">Средний чек заказа</span>
          <span className="st-overview-value">
            {stats.averageOrderValue.toFixed(0)} ₽
          </span>
        </div>
        <div className="st-overview-card">
          <span className="st-overview-label">Всего заказов</span>
          <span className="st-overview-value">{stats.totalOrders}</span>
        </div>
        <div className="st-overview-card">
          <span className="st-overview-label">Общая сумма</span>
          <span className="st-overview-value">
            {stats.totalSum.toFixed(0)} ₽
          </span>
        </div>
      </div>

      {/* Статистика по чаям */}
      <div className="st-products-block">
        <div className="st-products-header">
          <h4>Статистика по чаям</h4>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию..."
            className="st-search-input"
          />
        </div>

        <div className="st-products-table">
          <div className="st-table-header">
            <span className="st-col-name">Название</span>
            <span className="st-col-grams">Всего грамм</span>
            <span className="st-col-orders">Заказов</span>
            <span className="st-col-avg">Ср. размер</span>
            <span className="st-col-samplers">Пробников</span>
          </div>

          {filteredProducts.length === 0 ? (
            <p className="st-no-products">Чаи не найдены</p>
          ) : (
            filteredProducts.map((product) => (
              <div key={product._id} className="st-product-row">
                <span className="st-col-name">{product.name}</span>
                <span className="st-col-grams">{product.totalGrams} г</span>
                <span className="st-col-orders">{product.orderCount}</span>
                <span className="st-col-avg">
                  {product.avgOrderSize.toFixed(1)} г
                </span>
                <span className="st-col-samplers">
                  {product.samplerCount / 10} шт
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
