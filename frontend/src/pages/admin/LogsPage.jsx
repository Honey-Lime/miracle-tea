import { useEffect, useState } from "react";
import api from "../../services/api";

const logTypes = [
  { value: "errors", label: "Ошибки пользователей" },
  { value: "app", label: "Все логи" },
];

const LogsPage = () => {
  const [type, setType] = useState("errors");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/admin/logs", { params: { type } });
        setContent(response.data.content || "");
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Не удалось загрузить логи");
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [type]);

  return (
    <section className="ap-logs-page">
      <div className="ap-logs-header">
        <h1>Логи</h1>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {logTypes.map((logType) => (
            <option key={logType.value} value={logType.value}>
              {logType.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Загрузка...</p>}
      {error && <p className="ap-logs-error">{error}</p>}
      {!loading && !error && (
        <pre className="ap-logs-content">
          {content || "Лог пока пуст"}
        </pre>
      )}
    </section>
  );
};

export default LogsPage;
