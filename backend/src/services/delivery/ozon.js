// Ozon Доставка для бизнеса, Ozon Delivery API (https://docs.ozon.ru/api/ozon-delivery/).
// Вес — в граммах, габариты — в миллиметрах, суммы — строки в рублях.
//
// Схема работы:
// - отправления сдаются в пункт отгрузки по «методу доставки» (shipment_method_id),
//   который создаётся в кабинете Ozon Доставки;
// - список ПВЗ отдаётся целиком, без фильтра по месту, поэтому он кешируется
//   в памяти, а близкие к городу пункты отбираются по координатам;
// - стоимость и срок считает /v1/order/checkout. Он требует телефон получателя,
//   а при расчёте покупатель ещё не известен — для оценки берём телефон магазина.

const crypto = require("crypto");
const { DeliveryApiError, createTokenProvider, days, rub } = require("./http");

const AUTH_URL = "https://xapi.ozon.ru/oauth/token";
const BASE_URL = "https://api-delivery.ozon.ru";
const SCOPES = ["delivery-api.delivery", "delivery-api.delivery-point", "delivery-api.order", "delivery-api.posting"];

const REQUEST_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;
const POINTS_TTL_MS = 12 * 60 * 60 * 1000;
const POINTS_RADIUS_KM = 25;
const MAX_POINTS_ON_MAP = 300;
const INFO_BATCH = 1000;
const INFO_PARALLEL = 5;
const AVAILABILITY_BATCH = 100;
// Объявленная ценность для предварительного расчёта: сумма заказа виджету не известна.
const ESTIMATE_DECLARED_VALUE = 1000;

const env = (name, legacyName) => process.env[name] || (legacyName ? process.env[legacyName] : "") || "";
const clientId = () => env("OZON_DELIVERY_CLIENT_ID", "OZON_LOGISTICS_CLIENT_ID");
const clientSecret = () => env("OZON_DELIVERY_CLIENT_SECRET", "OZON_LOGISTICS_CLIENT_SECRET");
const shipmentMethodId = () => Number(env("OZON_DELIVERY_SHIPMENT_METHOD_ID"));
const estimatePhone = () => normalizePhone(env("OZON_DELIVERY_ESTIMATE_PHONE"));

// Ответ Ozon для диагностики: ошибки расчёта не прерывают показ других служб,
// поэтому без этой записи причина пропажи Ozon из вариантов доставки не видна.
function logOzonResponse(context, payload) {
  const text = JSON.stringify(payload ?? null) || "";
  console.warn(`[ozon] ${context}: ${text.slice(0, 1000)}`);
}

// Серверы Ozon защищены модулем testcookie: на запрос без нужной cookie они
// отвечают редиректом с Set-Cookie, и запрос надо повторить с тем же телом.
const cookieJar = new Map();

function rememberCookies(response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  setCookies.forEach((line) => {
    const [pair] = line.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookieJar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  });
}

const cookieHeader = () => [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");

async function ozonFetch(url, { headers = {}, body } = {}) {
  let target = url;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(target, {
      method: "POST",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
        ...headers,
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    rememberCookies(response);

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      target = new URL(location, target).toString();
      continue;
    }

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    if (!response.ok) {
      throw new DeliveryApiError(`POST ${new URL(target).pathname} → ${response.status}`, {
        status: response.status,
        body: json,
      });
    }

    return json;
  }

  throw new DeliveryApiError(`POST ${new URL(url).pathname}: слишком много редиректов`);
}

const getToken = createTokenProvider(async () => {
  try {
    const result = await ozonFetch(AUTH_URL, {
      body: {
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: "client_credentials",
        scope: SCOPES,
      },
    });
    return { accessToken: result.access_token, expiresIn: result.expires_in };
  } catch (error) {
    logOzonResponse(`авторизация ${error.status || error.message}`, error.body);
    throw error;
  }
});

async function ozonRequest(path, body, headers = {}) {
  const token = await getToken();
  return ozonFetch(`${BASE_URL}${path}`, { body, headers: { Authorization: `Bearer ${token}`, ...headers } });
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length === 11 ? `+${digits}` : "";
}

const money = (value) => ({ amount: (Math.round((Number(value) || 0) * 100) / 100).toFixed(2), currency_code: "RUB" });

const ozonDimensions = (pkg) => ({
  weight_g: pkg.weightGrams,
  length_mm: pkg.length * 10,
  width_mm: pkg.width * 10,
  height_mm: pkg.height * 10,
});

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function formatSchedule(schedule) {
  const period = schedule?.[0]?.periods?.[0];
  if (!period) return "";
  return `${String(period.from_local).slice(0, 5)}–${String(period.to_local).slice(0, 5)}`;
}

// Все активные ПВЗ, куда возит наш метод доставки: id из /delivery-point/list,
// адреса и координаты — из /delivery-point/info. Загрузка долгая, поэтому
// одновременные расчёты ждут один общий запрос, а не запускают свои.
let pointsCache = { value: null, expiresAt: 0, pending: null };

function getAllPoints() {
  if (pointsCache.value && pointsCache.expiresAt > Date.now()) {
    return Promise.resolve(pointsCache.value);
  }

  if (!pointsCache.pending) {
    pointsCache.pending = loadAllPoints()
      .then((points) => {
        pointsCache = { value: points, expiresAt: Date.now() + POINTS_TTL_MS, pending: null };
        return points;
      })
      .catch((error) => {
        pointsCache.pending = null;
        throw error;
      });
  }

  return pointsCache.pending;
}

async function loadAllPoints() {
  const methodId = shipmentMethodId();
  const ids = [];
  let cursor;

  do {
    const page = await ozonRequest("/v1/delivery-point/list", {
      pagination: { limit: INFO_BATCH, ...(cursor ? { cursor } : {}) },
    });
    (page?.delivery_points || []).forEach((point) => {
      const methods = [].concat(point.shipment_method_ids || []);
      if (methods.includes(methodId)) ids.push(point.delivery_point_id);
    });
    cursor = page?.next_cursor || null;
  } while (cursor);

  const points = [];
  const batches = chunk(ids, INFO_BATCH);
  for (const group of chunk(batches, INFO_PARALLEL)) {
    const responses = await Promise.all(
      group.map((batch) => ozonRequest("/v1/delivery-point/info", { delivery_point_ids: batch })),
    );
    responses.forEach((info) => {
      (info?.delivery_points || []).forEach((point) => {
        const lat = Number(point.coordinates?.latitude);
        const lon = Number(point.coordinates?.longitude);
        if (point.is_active && Number.isFinite(lat) && Number.isFinite(lon)) {
          points.push({
            delivery_point_id: point.delivery_point_id,
            name: point.name,
            type: point.type,
            full_address: point.full_address,
            schedule: point.schedule?.slice(0, 1),
            lat,
            lon,
          });
        }
      });
    });
  }

  if (!points.length) {
    logOzonResponse(`нет пунктов выдачи для метода доставки ${methodId}`, { ids: ids.length });
  }

  return points;
}

async function getNearbyPoints(lat, lon) {
  const points = await getAllPoints();
  return points
    .map((point) => ({ point, distance: distanceKm(lat, lon, point.lat, point.lon) }))
    .filter((item) => item.distance <= POINTS_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_POINTS_ON_MAP)
    .map((item) => item.point);
}

// Пункты, которые примут посылку с такими габаритами.
async function filterAvailablePoints(points, pkg) {
  const available = new Set();

  for (const batch of chunk(points, AVAILABILITY_BATCH)) {
    const result = await ozonRequest("/v1/delivery-point/check-availability", {
      delivery_point_ids: batch.map((point) => point.delivery_point_id),
      shipment_method_id: shipmentMethodId(),
      postings: [{ request_id: 1, declared_value: money(ESTIMATE_DECLARED_VALUE), dimensions: ozonDimensions(pkg) }],
    });
    (result?.results || []).forEach((item) => {
      if (!item.error) available.add(item.delivery_point_id);
    });
  }

  return points.filter((point) => available.has(point.delivery_point_id));
}

// Предварительная стоимость и срок для одного варианта доставки (ПВЗ или курьер).
async function checkout(delivery, pkg, context) {
  try {
    const result = await ozonRequest("/v1/order/checkout", {
      recipient: { phone_number: estimatePhone() },
      postings: [
        {
          request_id: 1,
          shipment_method_id: shipmentMethodId(),
          declared_value: money(ESTIMATE_DECLARED_VALUE),
          dimensions: ozonDimensions(pkg),
        },
      ],
      delivery,
    });

    const [item] = result?.results || [];
    if (!item?.posting) {
      logOzonResponse(`нет расчёта (${context})`, item?.error || result);
      return null;
    }

    const daysCount = item.posting.estimated_delivery_days;
    return { price: rub(item.posting.estimated_delivery_cost?.amount), time: days(daysCount, daysCount) };
  } catch (error) {
    logOzonResponse(`ошибка расчёта ${error.status || error.message} (${context})`, error.body);
    if (error instanceof DeliveryApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
      return null;
    }
    throw error;
  }
}

async function calculateTerminals(lat, lon, pkg, cityName) {
  const nearby = await getNearbyPoints(lat, lon);
  if (!nearby.length) {
    logOzonResponse(`нет пунктов выдачи рядом с «${cityName}»`, { lat, lon });
    return { terminal: null, terminals: [] };
  }

  const available = await filterAvailablePoints(nearby, pkg);
  if (!available.length) {
    logOzonResponse(`пункты рядом с «${cityName}» не принимают посылку`, { nearby: nearby.length });
    return { terminal: null, terminals: [] };
  }

  // Цена в пределах города одинаковая — считаем по ближайшему пункту.
  const terminal = await checkout(
    { delivery_point: { delivery_point_id: available[0].delivery_point_id } },
    pkg,
    `ПВЗ, ${cityName}`,
  );
  if (!terminal) {
    return { terminal: null, terminals: [] };
  }

  const terminals = available.map((point) => ({
    service: "ozon",
    code: point.delivery_point_id,
    address: point.full_address || point.name,
    lon: point.lon,
    lat: point.lat,
    image: service.logo,
    is_postamat: point.type === "postamat",
    price: terminal.price,
    time: terminal.time,
    payment: { methods: [] },
    workTime: formatSchedule(point.schedule),
    phones: [],
    note: point.name || "",
  }));

  return { terminal, terminals };
}

const service = {
  key: "ozon",
  name: "Ozon Доставка",
  logo: "/delivery/ozon.svg",

  isConfigured() {
    return Boolean(clientId() && clientSecret() && shipmentMethodId() && estimatePhone());
  },

  async calculate({ cityName, streetAddress, lat, lon, pkg }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      logOzonResponse(`нет координат для «${streetAddress || cityName}»`, null);
      return {};
    }

    // При пересчёте курьерской доставки по точному адресу ПВЗ не нужны.
    if (streetAddress) {
      const door = await checkout({ courier: { coordinates: { latitude: lat, longitude: lon } } }, pkg, `курьер, ${streetAddress}`);
      return { door };
    }

    const [door, { terminal, terminals }] = await Promise.all([
      checkout({ courier: { coordinates: { latitude: lat, longitude: lon } } }, pkg, `курьер, ${cityName}`),
      calculateTerminals(lat, lon, pkg, cityName),
    ]);

    return { door, terminal, terminals };
  },

  async createOrder({ deliveryData, orderData, pkg }) {
    const isTerminal = deliveryData.type === "terminal";
    const address = deliveryData.address || {};
    const phone = normalizePhone(deliveryData.phone);

    if (!phone) {
      throw new DeliveryApiError("Ozon: некорректный телефон получателя");
    }

    let delivery;
    if (isTerminal) {
      delivery = { delivery_point: { delivery_point_id: Number(deliveryData.code) } };
    } else {
      const lat = Number(address.lat);
      const lon = Number(address.lon);
      if (!address.zip || !address.city || !address.street || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new DeliveryApiError("Ozon: для курьерской доставки не хватает индекса, города, улицы или координат адреса");
      }

      delivery = {
        courier: {
          coordinates: { latitude: lat, longitude: lon },
          zip_code: String(address.zip),
          country: "Россия",
          region: address.region || address.city,
          city: address.city,
          street: address.street,
          house_number: address.house || undefined,
          apartment: deliveryData.room || undefined,
        },
      };
    }

    const itemsTotal = orderData.places.reduce((sum, place) => sum + (Number(place.price) || 0) * (place.count || 1), 0);
    const description = orderData.places.map((place) => place.name).filter(Boolean).join(", ").slice(0, 200) || "Чай";

    // Ключ идемпотентности из номера заказа: повторная отправка не создаст дубль.
    const idempotencyKey = crypto
      .createHash("md5")
      .update(`miracle-tea-${orderData.id}`)
      .digest("hex")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

    let result;
    try {
      result = await ozonRequest(
        "/v1/order/create",
        {
          order_external_id: String(orderData.id),
          recipient: { phone_number: phone, full_name: deliveryData.name || undefined },
          delivery,
          postings: [
            {
              request_id: 1,
              posting_external_id: `${orderData.id}-1`,
              shipment_method_id: shipmentMethodId(),
              description,
              declared_value: money(itemsTotal),
              dimensions: ozonDimensions(pkg),
            },
          ],
        },
        { "Idempotency-Key": idempotencyKey },
      );
    } catch (error) {
      logOzonResponse(`ошибка создания заказа ${error.status || error.message}`, error.body);
      throw error;
    }

    const postingNumber = result?.postings?.[0]?.posting_number;

    // Подтверждаем сборку, чтобы отправление перешло в ready_for_shipping и
    // для него можно было получить этикетку. Ozon при этом проверяет баланс.
    if (postingNumber) {
      try {
        await ozonRequest("/v1/posting/approve", { posting_number: postingNumber });
      } catch (error) {
        logOzonResponse(`не удалось подтвердить отправление ${postingNumber}`, error.body || error.message);
      }
    }

    return postingNumber || result?.order_number;
  },
};

module.exports = service;
