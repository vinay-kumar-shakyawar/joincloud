const fs = require("fs");
const path = require("path");

function createLogger(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, "server.log");

  function write(level, message, meta) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta: meta || null,
    };
    const line = `${JSON.stringify(payload)}\n`;
    fs.appendFileSync(logPath, line);
  }

  return {
    info: (message, meta) => write("info", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}

module.exports = {
  createLogger,
};
