const fs = require("fs");
const path = require("path");

function createLogger(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, "server.log");
  const buffer = [];
  const maxEntries = 200;

  function write(level, message, meta) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta: meta || null,
    };
    buffer.push(payload);
    if (buffer.length > maxEntries) {
      buffer.shift();
    }
    const line = `${JSON.stringify(payload)}\n`;
    fs.appendFileSync(logPath, line);
  }

  return {
    info: (message, meta) => write("info", message, meta),
    error: (message, meta) => write("error", message, meta),
    getBuffer: () => buffer.slice(),
  };
}

module.exports = {
  createLogger,
};
