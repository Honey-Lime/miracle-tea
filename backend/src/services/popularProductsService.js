const mongoose = require("mongoose");
const Setting = require("../models/Setting");
const Product = require("../models/Product");

const POPULAR_PRODUCTS_SETTING = "popularProductIds";
const MAX_POPULAR_PRODUCTS = 8;

const normalizePopularProductIds = (value) => {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  return [...new Set(ids)].slice(0, MAX_POPULAR_PRODUCTS);
};

const getPopularProductIds = async () => {
  const setting = await Setting.findById(POPULAR_PRODUCTS_SETTING);
  return normalizePopularProductIds(setting?.value);
};

const setPopularProductIds = async (value) => {
  const requested = normalizePopularProductIds(value);
  const existing = await Product.find({ _id: { $in: requested } }).select("_id");
  const existingIds = new Set(existing.map((product) => String(product._id)));
  const ids = requested.filter((id) => existingIds.has(id));

  await Setting.findByIdAndUpdate(
    POPULAR_PRODUCTS_SETTING,
    { value: ids },
    { upsert: true, new: true, runValidators: true },
  );
  return ids;
};

// Товары для блока «Популярное» в заданном порядке; удалённые и закончившиеся пропускаются
const getPopularProducts = async () => {
  const ids = await getPopularProductIds();
  if (ids.length === 0) return [];

  const products = await Product.find({ _id: { $in: ids }, remains: { $gt: 0 } }).select("-sku");
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

module.exports = {
  MAX_POPULAR_PRODUCTS,
  getPopularProductIds,
  getPopularProducts,
  setPopularProductIds,
};
