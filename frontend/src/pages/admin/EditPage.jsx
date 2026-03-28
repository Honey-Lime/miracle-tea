import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AddTeaTab from "./AddTeaTab";
import SupplyTab from "./SupplyTab";
import TagsTab from "./TagsTab";
import ProductsTab from "./ProductsTab";

const EditPage = () => {
  const [activeTab, setActiveTab] = useState("add");

  return (
    <div className="ep-edit-page">
      <h1>Редактирование</h1>
      <div className="ep-tabs">
        <button
          className={`ep-tab ${activeTab === "add" ? "active" : ""}`}
          onClick={() => setActiveTab("add")}
        >
          Добавить чай
        </button>
        <button
          className={`ep-tab ${activeTab === "supply" ? "active" : ""}`}
          onClick={() => setActiveTab("supply")}
        >
          Поставка
        </button>
        <button
          className={`ep-tab ${activeTab === "tags" ? "active" : ""}`}
          onClick={() => setActiveTab("tags")}
        >
          Теги
        </button>
        <button
          className={`ep-tab ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          Товары
        </button>
      </div>
      <div className="ep-tab-content">
        {activeTab === "add" && <AddTeaTab />}
        {activeTab === "supply" && <SupplyTab />}
        {activeTab === "tags" && <TagsTab />}
        {activeTab === "products" && <ProductsTab />}
      </div>
    </div>
  );
};

export default EditPage;
