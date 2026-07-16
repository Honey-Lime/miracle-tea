import { useEffect, useState } from "react";
import api from "../../services/api";

const logTypes = [
  { value: "errors", label: "Ошибки" },
  { value: "app", label: "Логи" },
];

const INITIAL_LOG_BYTES = 200000;
const LOG_BYTES_STEP = 200000;

const formatErrorLogs = (logContent) =>
  logContent
    .trim()
    .replace(/\n(?=\[\d{4}-\d{2}-\d{2}T)/g, "\n\n");

const LogsPage = () => {
  const [type, setType] = useState("errors");
  const [content, setContent] = useState("");
  const [maxBytes, setMaxBytes] = useState(INITIAL_LOG_BYTES);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/admin/logs", { params: { type, maxBytes } });
        const nextContent = response.data.content || "";
        setContent(formatErrorLogs(nextContent));
        setHasMore(Boolean(response.data.hasMore));
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Не удалось загрузить логи");
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [type, maxBytes]);

  const handleTypeChange = (nextType) => {
    setType(nextType);
    setMaxBytes(INITIAL_LOG_BYTES);
  };

  return (
    <section className="ap-logs-page">
      <div className="ap-logs-header">
        <h1>Логи</h1>
        <div className="ap-logs-tabs" role="tablist" aria-label="Тип логов">
          {logTypes.map((logType) => (
            <button
              key={logType.value}
              type="button"
              className={`ap-logs-tab${type === logType.value ? " active" : ""}`}
              role="tab"
              aria-selected={type === logType.value}
              onClick={() => handleTypeChange(logType.value)}
            >
              {logType.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p>Загрузка...</p>}
      {error && <p className="ap-logs-error">{error}</p>}
      {!loading && !error && (
        <pre className="ap-logs-content">
          {content || "Лог пока пуст"}
        </pre>
      )}
      {!loading && !error && hasMore && (
        <button
          className="ap-logs-more"
          type="button"
          onClick={() => setMaxBytes((current) => current + LOG_BYTES_STEP)}
        >
          Показать больше логов
        </button>
      )}
    </section>
  );
};

export default LogsPage;
