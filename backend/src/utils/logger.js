const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "app.log");

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage, "utf8");
}

function logDBOperation(operation, collection, query, result) {
  const message = `DB ${operation} on ${collection}: ${JSON.stringify(query)} -> ${JSON.stringify(result)}`;
  logToFile(message);
  console.log(message);
}

function logHTTPRequest(method, url, status, responseTime) {
  const message = `HTTP ${method} ${url} ${status} ${responseTime}ms`;
  logToFile(message);
  console.log(message);
}

function logError(error, context = "") {
  const message = `ERROR ${context}: ${error.message}\nStack: ${error.stack}`;
  logToFile(message);
  console.error(message);
}

module.exports = {
  logToFile,
  logDBOperation,
  logHTTPRequest,
  logError,
};
