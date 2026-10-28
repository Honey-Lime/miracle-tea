// Общие помощники для запросов к API служб доставки.

const REQUEST_TIMEOUT_MS = 15000;
const NETWORK_RETRY_DELAYS_MS = [500, 2000];
// Соединение не установилось — запрос до сервера не дошёл, повтор безопасен даже для POST.
const CONNECT_ERRORS = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT"]);

class DeliveryApiError extends Error {
  constructor(message, { status, body, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "DeliveryApiError";
    this.status = status;
    this.body = body;
  }
}

// fetch с повтором при сетевом сбое. Голое «fetch failed» прячет причину в error.cause —
// поднимаем её в текст ошибки, чтобы в логе было видно, что и где упало.
async function fetchWithRetry(target, init) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(target, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const timedOut = error.name === "TimeoutError";
      const code = timedOut ? "таймаут" : error.cause?.code || error.cause?.message || error.message;
      const retryable = !timedOut && (init.method === "GET" || CONNECT_ERRORS.has(error.cause?.code));

      if (!retryable || attempt >= NETWORK_RETRY_DELAYS_MS.length) {
        throw new DeliveryApiError(`${init.method} ${target.host}${target.pathname}: ошибка сети (${code})`, {
          cause: error,
        });
      }

      console.warn(`${init.method} ${target.host}${target.pathname}: ошибка сети (${code}), повтор`);
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAYS_MS[attempt]));
    }
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
  };

  if (form) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetchWithRetry(target, init);
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
