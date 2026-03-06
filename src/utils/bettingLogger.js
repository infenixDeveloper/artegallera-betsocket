/**
 * Logger de procesos de apuestas: escribe en log.md (append) con timestamp.
 * Solo para flujo de apuestas (betsocket).
 */
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "..", "log.md");

function timestamp() {
  return new Date().toISOString();
}

function append(line) {
  try {
    const safeLine = line != null ? String(line) : "";
    const lineWithNewline = safeLine.endsWith("\n") ? safeLine : safeLine + "\n";
    fs.appendFileSync(LOG_FILE, `[${timestamp()}] ${lineWithNewline}`);
  } catch (err) {
    console.error("Error al escribir en log.md:", err.message);
  }
}

module.exports = {
  log: (message) => append(message),
  warn: (message) => append(`[WARN] ${message}`),
  error: (message) => append(`[ERROR] ${message}`),
};
