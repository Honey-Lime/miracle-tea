// Единая точка работы со службами доставки.
// Ответы расчёта приводятся к формату, который ожидает виджет доставки на клиенте:
// { data: { terminal, door, terminals } }, где terminal/door — { price, time }.

const Setting = require("../../models/Setting");
const cdek = require("./cdek");
const yandex = require("./yandex");
const ozon = require("./ozon");

const SERVICES = { cdek, yandex, ozon };
const DELIVERY_SERVICES_SETTING = "deliveryServices";

// Упаковка по умолчанию: коробка 15×10 см, высота растёт на 6 см на каждые 100 г чая.
const PACKAGE_LENGTH_CM = 15;
const PACKAGE_WIDTH_CM = 10;
const PACKAGE_LAYER_CM = 6;
const MIN_WEIGHT_GRAMS = 100;

function buildPackage(weightGrams, height) {
  const grams = Math.max(MIN_WEIGHT_GRAMS, Math.round(Number(weightGrams) || 0));
  return {
    weightGrams: grams,
    length: PACKAGE_LENGTH_CM,
    width: PACKAGE_WIDTH_CM,
    height: Math.max(PACKAGE_LAYER_CM, Number(height) || PACKAGE_LAYER_CM * Math.ceil(grams / 100)),
  };
}

// Сохранённые в админке флаги. Службу без флага считаем включённой.
async function getEnabledFlags() {
  const setting = await Setting.findById(DELIVERY_SERVICES_SETTING);
  return setting?.value && typeof setting.value === "object" ? setting.value : {};
}

async function getServicesSettings() {
  const flags = await getEnabledFlags();
  return Object.values(SERVICES).map((service) => ({
    key: service.key,
    name: service.name,
    enabled: flags[service.key] !== false,
    configured: service.isConfigured(),
  }));
}

async function setServicesSettings(input = {}) {
  const flags = await getEnabledFlags();
  const next = { ...flags };

  Object.keys(SERVICES).forEach((key) => {
    if (typeof input[key] === "boolean") {
      next[key] = input[key];
    }
  });

  await Setting.findByIdAndUpdate(
    DELIVERY_SERVICES_SETTING,
    { value: next },
    { upsert: true, new: true, runValidators: true },
  );

  return getServicesSettings();
}

// Службы, которые видит покупатель: включены в админке и имеют ключи на сервере.
async function getAvailableServices() {
  const settings = await getServicesSettings();
  return settings.filter((item) => item.enabled && item.configured).map((item) => SERVICES[item.key]);
}

async function isServiceAvailable(key) {
  const available = await getAvailableServices();
  return available.some((service) => service.key === key);
}

async function getState() {
  const available = await getAvailableServices();
  const services = {};

  available.forEach((service) => {
    services[service.key] = { name: service.name, logo: service.logo };
  });

  return { data: { services } };
}

async function calculate(serviceKey, { to, address, weight, lat, lon, recalculation }) {
  const service = SERVICES[serviceKey];
  const pkg = buildPackage((Number(weight) || 0) * 1000);

  // При пересчёте курьерской доставки клиент присылает полный адрес, иначе — название города.
  const result = await service.calculate({
    fias: to,
    cityName: address,
    streetAddress: recalculation ? address : null,
    lat: lat === undefined || lat === null || lat === "" ? NaN : Number(lat),
    lon: lon === undefined || lon === null || lon === "" ? NaN : Number(lon),
    weightGrams: pkg.weightGrams,
    pkg,
  });

  const data = {};
  if (result.terminal) data.terminal = result.terminal;
  if (result.door) data.door = result.door;
  if (result.terminals?.length) data.terminals = result.terminals;

  return { data };
}

function parseDimensions(value) {
  const [length, width, height] = String(value || "")
    .split("*")
    .map((part) => Number(part));
  return { length, width, height };
}

async function createDeliveryOrder(deliveryData, orderData, companyData) {
  const service = SERVICES[deliveryData?.service];
  if (!service) {
    throw new Error(`Неизвестная служба доставки: ${deliveryData?.service}`);
  }

  if (!service.isConfigured()) {
    throw new Error(`Служба доставки ${service.name} не настроена на сервере`);
  }

  const dims = parseDimensions(orderData.dimensions);
  const pkg = {
    ...buildPackage((Number(orderData.total_weight) || 0) * 1000, dims.height),
    ...(dims.length ? { length: dims.length } : {}),
    ...(dims.width ? { width: dims.width } : {}),
  };

  const deliveryId = await service.createOrder({ deliveryData, orderData, companyData, pkg });
  if (!deliveryId) {
    throw new Error(`${service.name} не вернула номер заказа доставки`);
  }

  return String(deliveryId);
}

module.exports = {
  SERVICES,
  calculate,
  createDeliveryOrder,
  getServicesSettings,
  getState,
  isServiceAvailable,
  setServicesSettings,
};
