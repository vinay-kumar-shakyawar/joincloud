const fs = require("fs/promises");
const path = require("path");

const DEFAULT_COUNTERS = {
  filesUploadedCount: 0,
  sharesCreatedCount: 0,
  publicSharesCount: 0,
  lanSharesCount: 0,
  totalDataUploadedSize: 0,
  errorCount: 0,
  crashCount: 0,
};

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function createTelemetryCounters(storagePath, logger) {
  let state = { ...DEFAULT_COUNTERS };
  let writeTimer = null;

  async function load() {
    try {
      await ensureDir(storagePath);
      const raw = await fs.readFile(storagePath, "utf8");
      const parsed = JSON.parse(raw);
      state = { ...DEFAULT_COUNTERS, ...parsed };
    } catch (error) {
      await persist();
    }
  }

  async function persist() {
    await ensureDir(storagePath);
    await fs.writeFile(storagePath, JSON.stringify(state, null, 2));
  }

  function schedulePersist() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      persist().catch(() => {
        if (logger) logger.error("telemetry counters save failed");
      });
    }, 250);
  }

  function increment(patch) {
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (typeof state[key] !== "number") return;
      const delta = Number(value) || 0;
      state[key] += delta;
    });
    schedulePersist();
  }

  function reset() {
    state = { ...DEFAULT_COUNTERS };
    schedulePersist();
  }

  function snapshot() {
    return { ...state };
  }

  return {
    load,
    increment,
    reset,
    snapshot,
  };
}

module.exports = {
  createTelemetryCounters,
};
