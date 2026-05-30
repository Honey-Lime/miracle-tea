import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initClientErrorReporting } from "./services/errorReporter";
import "./styles/index.css"; // Базовые стили + components.css (низкий приоритет)
import "./styles/components-imports.css"; // Стили компонентов (средний приоритет)
import "./styles/pages.css"; // Стили страниц (высокий приоритет)

initClientErrorReporting();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
