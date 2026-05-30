const endpoint = "/api/client-errors";

function buildPayload(error, source, extra = {}) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  return {
    message: normalizedError.message,
    stack: normalizedError.stack,
    source,
    url: window.location.href,
    ...extra,
  };
}

export function reportClientError(error, source = "client", extra = {}) {
  const payload = buildPayload(error, source, extra);
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (reportError) {
    console.error("Не удалось отправить ошибку на сервер", reportError);
  }
}

export function initClientErrorReporting() {
  window.addEventListener("error", (event) => {
    reportClientError(event.error || event.message, "window.error", {
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason || "Unhandled promise rejection", "unhandledrejection");
  });
}
