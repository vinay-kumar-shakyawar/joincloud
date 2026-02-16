const fs = require("fs");
const path = require("path");

function createLogger(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, "server.log");
  const buffer = [];
  const maxEntries = 200;
  const maxLogBytes = 5 * 1024 * 1024;
  const maxLogLines = 5000;
  let pruneInProgress = false;

  function pruneLogIfNeeded() {
    if (pruneInProgress) return;
    try {
      const stats = fs.statSync(logPath);
      if (stats.size <= maxLogBytes) return;
    } catch (_error) {
      return;
    }
    pruneInProgress = true;
    try {
      const content = fs.readFileSync(logPath, "utf8");
      const lines = content.split("\n").filter(Boolean);
      const keep = lines.slice(-maxLogLines).join("\n");
      fs.writeFileSync(logPath, `${keep}\n`);
    } catch (_error) {
      // ignore prune errors
    } finally {
      pruneInProgress = false;
    }
  }

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
    pruneLogIfNeeded();
    const logLine = `[joincloud-server] ${message}${meta ? ` ${JSON.stringify(meta)}` : ""}`;
    if (level === "error") {
      console.error(logLine);
    } else {
      console.log(logLine);
    }
  }

  return {
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
    getBuffer: () => buffer.slice(),
  };
}

module.exports = {
  createLogger,
};
