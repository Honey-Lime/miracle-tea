// Ozon Логистика (бывш. Ozon Rocket), principal-integration-api.
// Вес — в граммах, габариты — в миллиметрах, цены — в рублях.

const { DeliveryApiError, createTokenProvider, createTtlCache, days, envFlag, requestJson, rub } = require("./http");

const IS_TEST = envFlag(process.env.OZON_LOGISTICS_TEST);
const HOST = IS_TEST ? "https://api-stg.ozonru.me" : "https://xapi.ozon.ru";
const BASE_URL = `${HOST}/principal-integration-api`;
const SEARCH_RADIUS_KM = 50;

const pointsCache = createTtlCache(30 * 60 * 1000);

const getToken = createTokenProvider(async () => {
  const result = await requestJson(`${HOST}/principal-auth-api/connect/token`, {
    method: "POST",
    form: {
      grant_type: "client_credentials",
      client_id: process.env.OZON_LOGISTICS_CLIENT_ID,
      client_secret: process.env.OZON_LOGISTICS_CLIENT_SECRET,
    },
  });

  return { accessToken: result.access_token, expiresIn: result.expires_in };
});

async function ozonRequest(path, options = {}) {
  const token = await getToken();
  return requestJson(`${BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}` },
  });
}

const ozonDimensions = (pkg) => ({
  weight: pkg.weightGrams,
  length: pkg.length * 10,
  width: pkg.width * 10,
  height: pkg.height * 10,
});

const ozonPackages = (pkg) => [{ count: 1, dimensions: ozonDimensions(pkg), price: 0 }];

async function getVariants(address, deliveryTypes, pkg) {
  const result = await ozonRequest("/v1/delivery/variants/byaddress", {
    method: "POST",
    body: { deliveryTypes, address, radius: SEARCH_RADIUS_KM, packages: ozonPackages(pkg) },
  });

  if (!result?.data?.length) {
    logOzonResponse("нет пунктов выдачи", address, result);
  }

  return result?.data || [];
}

// Ответ Ozon для диагностики: пустой расчёт и 4xx ниже не считаются ошибкой,
// поэтому без этой записи причина пропажи Ozon из вариантов доставки не видна.
function logOzonResponse(context, address, payload) {
  const text = JSON.stringify(payload ?? null) || "";
  console.warn(`[ozon] ${context} для «${address}»: ${text.slice(0, 1000)}`);
}

async function getPrices(address, pkg) {
  try {
    const result = await ozonRequest("/v1/delivery/calculate/information", {
      method: "POST",
      body: {
        fromPlaceId: Number(process.env.OZON_LOGISTICS_FROM_PLACE_ID),
        destinationAddress: address,
        packages: ozonPackages(pkg),
      },
    });

    if (!result?.deliveryInfos?.length) {
      logOzonResponse("пустой расчёт", address, result);
    }

    const byType = {};
    (result?.deliveryInfos || []).forEach((info) => {
      byType[info.deliveryType] = { price: rub(info.price), time: days(info.deliveryTermInDays, info.deliveryTermInDays) };
    });
    return byType;
  } catch (error) {
    logOzonResponse(`ошибка расчёта ${error.status || error.message}`, address, error.body);
    if (error instanceof DeliveryApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
      return {};
    }
    throw error;
  }
}

const pad = (value) => String(value ?? 0).padStart(2, "0");

function formatWorkingHours(workingHours) {
  const first = workingHours?.[0]?.periods?.[0];
  if (!first) return "";
  return `${pad(first.min?.hours)}:${pad(first.min?.minutes)}–${pad(first.max?.hours)}:${pad(first.max?.minutes)}`;
}

const service = {
  key: "ozon",
  name: "Ozon Доставка",
  logo: "/delivery/ozon.svg",

  isConfigured() {
    return Boolean(
      process.env.OZON_LOGISTICS_CLIENT_ID &&
        process.env.OZON_LOGISTICS_CLIENT_SECRET &&
        process.env.OZON_LOGISTICS_FROM_PLACE_ID,
    );
  },

  async calculate({ cityName, streetAddress, pkg }) {
    const prices = await getPrices(streetAddress || cityName, pkg);
    const door = prices.Courier || null;
    const terminal = prices.PickPoint || prices.Postamat || null;
    if (!terminal) {
      return { door };
    }

    const variants = await pointsCache.get(cityName, () => getVariants(cityName, ["PickPoint", "Postamat"], pkg));
    const terminals = variants.map((variant) => {
      const isPostamat = variant.objectTypeName === "Постамат" || variant.deliveryType === "Postamat";
      const typePrice = (isPostamat ? prices.Postamat : prices.PickPoint) || terminal;
      return {
        service: "ozon",
        code: variant.id,
        address: variant.address || variant.name,
        lon: variant.long ?? variant.longitude,
        lat: variant.lat ?? variant.latitude,
        image: this.logo,
        is_postamat: isPostamat,
        price: typePrice.price,
        time: typePrice.time,
        payment: { methods: [] },
        workTime: formatWorkingHours(variant.workingHours),
        phones: variant.phone ? [variant.phone] : [],
        note: variant.howToGet || "",
      };
    });

    return { terminal: terminals.length ? terminal : null, door, terminals };
  },

  async createOrder({ deliveryData, orderData, pkg }) {
    const isTerminal = deliveryData.type === "terminal";
    const address = deliveryData.address || {};
    const fullAddress = [address.value, deliveryData.room && `кв. ${deliveryData.room}`].filter(Boolean).join(", ");

    let deliveryVariantId = deliveryData.code;
    if (!isTerminal) {
      const [courier] = await getVariants(address.value, ["Courier"], pkg);
      deliveryVariantId = courier?.id;
    }

    if (!deliveryVariantId) {
      throw new DeliveryApiError("Ozon: не найден вариант доставки для адреса");
    }

    const itemsTotal = orderData.places.reduce((sum, place) => sum + (Number(place.price) || 0) * (place.count || 1), 0);
    const person = { name: deliveryData.name, phone: deliveryData.phone, type: "NaturalPerson" };

    const result = await ozonRequest("/v1/order", {
      method: "POST",
      body: {
        orderNumber: String(orderData.id),
        buyer: person,
        recipient: person,
        firstMileTransfer: { type: "DropOff", fromPlaceId: String(process.env.OZON_LOGISTICS_FROM_PLACE_ID) },
        payment: {
          type: "FullPrepayment",
          prepaymentAmount: itemsTotal,
          recipientPaymentAmount: 0,
          deliveryPrice: 0,
        },
        deliveryInformation: { deliveryVariantId: String(deliveryVariantId), address: fullAddress },
        packages: [{ packageNumber: "1", dimensions: ozonDimensions(pkg) }],
        orderLines: orderData.places.map((place, index) => ({
          lineNumber: index + 1,
          articleNumber: place.article || String(index + 1),
          name: place.name || "Товар",
          sellingPrice: Number(place.price) || 0,
          estimatedPrice: Number(place.price) || 0,
          quantity: place.count || 1,
          resideInPackages: ["1"],
        })),
        comment: deliveryData.comment || "",
        allowPartialDelivery: false,
        allowUncovering: false,
      },
    });

    return result?.logisticOrderNumber || result?.id;
  },
};

module.exports = service;
