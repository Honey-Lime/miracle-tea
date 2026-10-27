// Общие помощники для запросов к API служб доставки.

const REQUEST_TIMEOUT_MS = 15000;

class DeliveryApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "DeliveryApiError";
    this.status = status;
    this.body = body;
  }
}

// JSON-запрос с таймаутом. Ошибочный HTTP-статус превращается в DeliveryApiError.
async function requestJson(url, { method = "GET", headers = {}, body, form, query } = {}) {
  const target = new URL(url);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, String(value));
    }
  });

  const init = {
    method,
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (form) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(target, init);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new DeliveryApiError(`${method} ${target.pathname} → ${response.status}`, {
      status: response.status,
      body: json,
    });
  }

  return json;
}

// Простой кеш в памяти процесса с временем жизни записи.
function createTtlCache(ttlMs) {
  const store = new Map();

  return {
    async get(key, loader) {
      const cached = store.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }

      const value = await loader();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
  };
}

// OAuth client_credentials: токен живёт в памяти сервера и обновляется заранее.
function createTokenProvider(fetchToken) {
  let token = null;
  let expiresAt = 0;
  let pending = null;

  async function getToken() {
    if (token && expiresAt - 60000 > Date.now()) {
      return token;
    }

    if (!pending) {
      pending = fetchToken()
        .then(({ accessToken, expiresIn }) => {
          token = accessToken;
          expiresAt = Date.now() + (Number(expiresIn) || 3600) * 1000;
          return token;
        })
        .finally(() => {
          pending = null;
        });
    }

    return pending;
  }

  // Сервер отверг токен (401) раньше срока — забыть его, чтобы следующий запрос взял новый.
  // Сбрасываем только отвергнутый токен: параллельный запрос мог уже получить свежий.
  getToken.reset = (rejectedToken) => {
    if (token === rejectedToken) {
      token = null;
      expiresAt = 0;
    }
  };

  return getToken;
}

const rub = (value) => ({ value: Math.ceil(Number(value) || 0), unit: "руб." });

function days(min, max) {
  const from = Number(min);
  const to = Number(max);

  if (!Number.isFinite(from) && !Number.isFinite(to)) {
    return { value: "уточняется", unit: "" };
  }

  if (!Number.isFinite(to) || from === to) {
    return { value: String(Number.isFinite(from) ? from : to), unit: "дн." };
  }

  return { value: `${Number.isFinite(from) ? from : to}-${to}`, unit: "дн." };
}

const envFlag = (value) => ["1", "true", "yes"].includes(String(value || "").toLowerCase());

module.exports = {
  DeliveryApiError,
  createTokenProvider,
  createTtlCache,
  days,
  envFlag,
  requestJson,
  rub,
};
