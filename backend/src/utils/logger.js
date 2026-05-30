const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "../../..");
const logDir = path.join(projectRoot, "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "app.log");
const errorLogFile = path.join(logDir, "errors.log");

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `"[unserializable: ${error.message}]"`;
  }
}

function appendLine(filePath, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(filePath, logMessage, "utf8");
}

function logToFile(message) {
  appendLine(logFile, message);
}

function logDBOperation(operation, collection, query, result) {
  const message = `DB ${operation} on ${collection}: ${safeJson(query)} -> ${safeJson(result)}`;
  logToFile(message);
  console.log(message);
}

function logHTTPRequest(method, url, status, responseTime, meta = {}) {
  const message = `HTTP ${method} ${url} ${status} ${responseTime}ms ${safeJson(meta)}`;
  logToFile(message);
  if (status >= 500) {
    console.error(message);
  } else {
    console.log(message);
  }
}

function getRequestMeta(req) {
  if (!req) {
    return {};
  }

  return {
    user: req.userId || req.body?.userId || "guest",
    ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get?.("user-agent"),
  };
}

function logError(error, context = "", req = null, extra = {}) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const meta = { ...getRequestMeta(req), ...extra };
  const message = `ERROR ${context}: ${normalizedError.message} ${safeJson(meta)}\nStack: ${normalizedError.stack}`;
  logToFile(message);
  appendLine(errorLogFile, message);
  console.error(message);
}

function logClientError(payload = {}, req = null) {
  const message = `CLIENT_ERROR ${payload.message || "Unknown client error"} ${safeJson({
    ...getRequestMeta(req),
    source: payload.source,
    stack: payload.stack,
    componentStack: payload.componentStack,
    url: payload.url,
    line: payload.line,
    column: payload.column,
  })}`;
  logToFile(message);
  appendLine(errorLogFile, message);
  console.error(message);
}

function getLogFilePath(type = "app") {
  return type === "errors" ? errorLogFile : logFile;
}

module.exports = {
  logToFile,
  logDBOperation,
  logHTTPRequest,
  logError,
  logClientError,
  getLogFilePath,
};
