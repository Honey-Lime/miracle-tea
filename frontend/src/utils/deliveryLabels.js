// Названия служб доставки — те же, что отдаёт backend/src/services/delivery.
const SERVICE_NAMES = {
  cdek: "СДЭК",
  yandex: "Яндекс Доставка",
  ozon: "Ozon Доставка",
};

export const getDeliveryServiceLabel = (order) => {
  const service = order?.delivery?.details?.service || order?.delivery?.provider;
  return SERVICE_NAMES[service] || "";
};

export const getDeliveryMethodLabel = (order) => {
  const details = order?.delivery?.details || {};

  if (details.type === "door") return "Курьером до двери";
  if (details.type === "terminal") return details.isPostamat ? "Постамат" : "Пункт выдачи";

  return "";
};
