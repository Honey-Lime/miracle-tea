// СДЭК, API v2: https://api-docs.cdek.ru/
// Расчёт: тарифы «склад-склад» (ПВЗ) и «склад-дверь» (курьер).

const {
  DeliveryApiError,
  createTokenProvider,
  createTtlCache,
  days,
  envFlag,
  requestJson,
  rub,
} = require("./http");

const BASE_URL = envFlag(process.env.CDEK_TEST) ? "https://api.edu.cdek.ru/v2" : "https://api.cdek.ru/v2";
const TARIFF_TERMINAL = Number(process.env.CDEK_TARIFF_TERMINAL) || 136;
const TARIFF_DOOR = Number(process.env.CDEK_TARIFF_DOOR) || 137;

const cityCache = createTtlCache(24 * 60 * 60 * 1000);
const pointsCache = createTtlCache(30 * 60 * 1000);

const getToken = createTokenProvider(async () => {
  const result = await requestJson(`${BASE_URL}/oauth/token`, {
    method: "POST",
    form: {
      grant_type: "client_credentials",
      client_id: process.env.CDEK_CLIENT_ID,
      client_secret: process.env.CDEK_CLIENT_SECRET,
    },
  });

  return { accessToken: result.access_token, expiresIn: result.expires_in };
});

async function cdekRequest(path, options = {}) {
  const token = await getToken();
  return requestJson(`${BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}` },
  });
}

const stripCityType = (name = "") => String(name).replace(/^(г|пгт|п|с|д|рп|ст-ца|х)\.?\s+/i, "").trim();

// Код города СДЭК: сначала по ФИАС, затем по названию.
async function getCityCode({ fias, cityName }) {
  const cacheKey = fias || cityName;
  if (!cacheKey) return null;

  return cityCache.get(cacheKey, async () => {
    if (fias) {
      const byFias = await cdekRequest("/location/cities", { query: { fias_guid: fias, size: 1 } });
      if (byFias?.[0]?.code) return byFias[0].code;
    }

    if (cityName) {
      const byName = await cdekRequest("/location/cities", {
        query: { city: stripCityType(cityName), country_codes: "RU", size: 1 },
      });
      if (byName?.[0]?.code) return byName[0].code;
    }

    return null;
  });
}

async function calculateTariff(tariffCode, toLocation, pkg) {
  try {
    const result = await cdekRequest("/calculator/tariff", {
      method: "POST",
      body: {
        tariff_code: tariffCode,
        from_location: { code: Number(process.env.CDEK_FROM_CITY_CODE) },
        to_location: toLocation,
        packages: [pkg],
      },
    });

    if (result?.errors?.length) {
      return null;
    }

    return {
      price: rub(result.total_sum ?? result.delivery_sum),
      time: days(result.period_min, result.period_max),
    };
  } catch (error) {
    // 400 у калькулятора означает «тариф недоступен для направления».
    if (error instanceof DeliveryApiError && error.status === 400) {
      return null;
    }
    throw error;
  }
}

function formatPhones(phones) {
  return (phones || []).map((phone) => phone.number).filter(Boolean);
}

async function getPoints(cityCode, weightKg) {
  const points = await pointsCache.get(String(cityCode), () =>
    cdekRequest("/deliverypoints", { query: { city_code: cityCode, type: "ALL", is_handout: true } }),
  );

  return (points || []).filter((point) => !point.weight_max || point.weight_max >= weightKg);
}

const service = {
  key: "cdek",
  name: "СДЭК",
  logo: "/delivery/cdek.svg",

  isConfigured() {
    return Boolean(
      process.env.CDEK_CLIENT_ID && process.env.CDEK_CLIENT_SECRET && process.env.CDEK_FROM_CITY_CODE,
    );
  },

  async calculate({ fias, cityName, streetAddress, weightGrams, pkg }) {
    const cityCode = await getCityCode({ fias, cityName });
    if (!cityCode) {
      return {};
    }

    const cdekPackage = { weight: weightGrams, length: pkg.length, width: pkg.width, height: pkg.height };
    const doorLocation = streetAddress ? { code: cityCode, address: streetAddress } : { code: cityCode };

    const [door, terminal] = await Promise.all([
      calculateTariff(TARIFF_DOOR, doorLocation, cdekPackage),
      calculateTariff(TARIFF_TERMINAL, { code: cityCode }, cdekPackage),
    ]);

    if (!terminal) {
      return { door };
    }

    const points = await getPoints(cityCode, weightGrams / 1000);
    const terminals = points.map((point) => ({
      service: "cdek",
      code: point.code,
      address: point.location?.address_full || point.location?.address || point.name,
      lon: point.location?.longitude,
      lat: point.location?.latitude,
      image: this.logo,
      is_postamat: point.type === "POSTAMAT",
      price: terminal.price,
      time: terminal.time,
      payment: { methods: [] },
      workTime: point.work_time || "",
      phones: formatPhones(point.phones),
      note: point.address_comment || point.note || "",
    }));

    return { terminal: terminals.length ? terminal : null, door, terminals };
  },

  async createOrder({ deliveryData, orderData, companyData, pkg }) {
    const isTerminal = deliveryData.type === "terminal";
    const body = {
      type: 1,
      number: String(orderData.id),
      tariff_code: isTerminal ? TARIFF_TERMINAL : TARIFF_DOOR,
      comment: deliveryData.comment || "",
      sender: { name: companyData.senderName, company: companyData.senderCompany, phones: [{ number: companyData.senderPhone }] },
      recipient: { name: deliveryData.name, phones: [{ number: deliveryData.phone }] },
      packages: [
        {
          number: "1",
          weight: pkg.weightGrams,
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          items: orderData.places.map((place) => ({
            name: place.name || "Товар",
            ware_key: place.article || place.name || "item",
            payment: { value: 0 },
            cost: Number(place.price) || 0,
            weight: Math.max(1, Math.round((Number(place.weight) || 0) * 1000)),
            amount: place.count || 1,
          })),
        },
      ],
    };

    if (process.env.CDEK_SHIPMENT_POINT) {
      body.shipment_point = process.env.CDEK_SHIPMENT_POINT;
    } else {
      body.from_location = { code: Number(process.env.CDEK_FROM_CITY_CODE) };
    }

    if (isTerminal) {
      body.delivery_point = deliveryData.code;
    } else {
      const address = deliveryData.address || {};
      const cityCode = await getCityCode({ cityName: address.city });
      body.to_location = {
        ...(cityCode ? { code: cityCode } : {}),
        address: [address.value, deliveryData.room && `кв. ${deliveryData.room}`].filter(Boolean).join(", "),
        longitude: address.lon,
        latitude: address.lat,
      };
    }

    const result = await cdekRequest("/orders", { method: "POST", body });
    const request = result?.requests?.[0];

    if (request?.state === "INVALID") {
      throw new DeliveryApiError("СДЭК отклонил заказ", { body: request.errors });
    }

    return result?.entity?.uuid;
  },
};

module.exports = service;
