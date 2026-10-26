// Яндекс Доставка «в другой день», B2B Platform API:
// https://yandex.ru/support/delivery-profile/ru/api/other-day/
// Цены в запросах указываются в копейках, вес — в граммах, габариты — в сантиметрах.

const { DeliveryApiError, createTtlCache, days, envFlag, requestJson, rub } = require("./http");

const BASE_URL = envFlag(process.env.YANDEX_DELIVERY_TEST)
  ? "https://b2b.taxi.tst.yandex.net"
  : "https://b2b-authproxy.taxi.yandex.net";

// Окно поиска ПВЗ вокруг центра города, в градусах.
const SEARCH_RADIUS_LAT = 0.25;
const SEARCH_RADIUS_LON = 0.4;

const pointsCache = createTtlCache(30 * 60 * 1000);

function yandexRequest(path, body) {
  return requestJson(`${BASE_URL}/api/b2b/platform${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.YANDEX_DELIVERY_TOKEN}`, "Accept-Language": "ru" },
    body,
  });
}

const physicalDims = (pkg) => ({ weight_gross: pkg.weightGrams, dx: pkg.length, dy: pkg.width, dz: pkg.height });

const WEEKDAYS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const pad = (value) => String(value ?? 0).padStart(2, "0");

function formatSchedule(schedule) {
  return (schedule?.restrictions || [])
    .map((item) => {
      const dayList = (item.days || []).map((day) => WEEKDAYS[day]).filter(Boolean).join(", ");
      const from = `${pad(item.time_from?.hours)}:${pad(item.time_from?.minutes)}`;
      const to = `${pad(item.time_to?.hours)}:${pad(item.time_to?.minutes)}`;
      return `${dayList} ${from}–${to}`;
    })
    .join("; ");
}

async function getPoints(lat, lon) {
  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const result = await pointsCache.get(key, () =>
    yandexRequest("/pickup-points/list", {
      latitude: { from: lat - SEARCH_RADIUS_LAT, to: lat + SEARCH_RADIUS_LAT },
      longitude: { from: lon - SEARCH_RADIUS_LON, to: lon + SEARCH_RADIUS_LON },
      payment_method: "already_paid",
    }),
  );

  return result?.points || [];
}

async function calculatePrice(destination, tariff, pkg) {
  try {
    const result = await yandexRequest("/pricing-calculator", {
      source: { platform_station_id: process.env.YANDEX_DELIVERY_STATION_ID },
      destination,
      tariff,
      total_weight: pkg.weightGrams,
      total_assessed_price: 0,
      client_price: 0,
      payment_method: "already_paid",
      places: [{ physical_dims: physicalDims(pkg) }],
    });

    const price = parseFloat(String(result?.pricing_total || "").replace(",", "."));
    if (!Number.isFinite(price)) {
      return null;
    }

    return { price: rub(price), time: days(result.delivery_days, result.delivery_days) };
  } catch (error) {
    // Направление не обслуживается — вариант просто не показываем.
    if (error instanceof DeliveryApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
      return null;
    }
    throw error;
  }
}

const service = {
  key: "yandex",
  name: "Яндекс Доставка",
  logo: "/delivery/yandex.svg",

  isConfigured() {
    return Boolean(process.env.YANDEX_DELIVERY_TOKEN && process.env.YANDEX_DELIVERY_STATION_ID);
  },

  async calculate({ cityName, streetAddress, lat, lon, pkg }) {
    const doorAddress = streetAddress || cityName;
    const door = doorAddress ? await calculatePrice({ address: doorAddress }, "time_interval", pkg) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { door };
    }

    const points = await getPoints(lat, lon);
    if (!points.length) {
      return { door };
    }

    const terminal = await calculatePrice({ platform_station_id: points[0].id }, "self_pickup", pkg);
    if (!terminal) {
      return { door };
    }

    const terminals = points.map((point) => ({
      service: "yandex",
      code: point.id,
      address: point.address?.full_address || point.name,
      lon: point.position?.longitude,
      lat: point.position?.latitude,
      image: this.logo,
      is_postamat: point.type === "terminal",
      price: terminal.price,
      time: terminal.time,
      payment: { methods: [] },
      workTime: formatSchedule(point.schedule),
      phones: point.contact?.phone ? [point.contact.phone] : [],
      note: point.instruction || "",
    }));

    return { terminal, door, terminals };
  },

  async createOrder({ deliveryData, orderData, pkg }) {
    const isTerminal = deliveryData.type === "terminal";
    const barcode = `${orderData.id}-1`;
    const address = deliveryData.address || {};

    const destination = isTerminal
      ? { type: "platform_station", platform_station: { platform_id: deliveryData.code } }
      : {
          type: "custom_location",
          custom_location: {
            latitude: address.lat,
            longitude: address.lon,
            details: { full_address: address.value, room: deliveryData.room || undefined },
          },
        };

    const created = await yandexRequest("/offers/create", {
      info: { operator_request_id: String(orderData.id), comment: deliveryData.comment || "" },
      source: { platform_station: { platform_id: process.env.YANDEX_DELIVERY_STATION_ID } },
      destination,
      items: orderData.places.map((place) => {
        const priceKopecks = Math.round((Number(place.price) || 0) * 100);
        return {
          count: place.count || 1,
          name: place.name || "Товар",
          article: place.article || "",
          billing_details: { unit_price: priceKopecks, assessed_unit_price: priceKopecks },
          place_barcode: barcode,
        };
      }),
      places: [{ physical_dims: physicalDims(pkg), barcode }],
      billing_info: { payment_method: "already_paid" },
      recipient_info: { first_name: deliveryData.name, phone: deliveryData.phone },
      last_mile_policy: isTerminal ? "self_pickup" : "time_interval",
    });

    const offerId = created?.offers?.[0]?.offer_id;
    if (!offerId) {
      throw new DeliveryApiError("Яндекс Доставка не вернула предложений", { body: created });
    }

    const confirmed = await yandexRequest("/offers/confirm", { offer_id: offerId });
    return confirmed?.request_id;
  },
};

module.exports = service;
