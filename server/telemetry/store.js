const fs = require("fs");
const path = require("path");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createFallbackStore(dbPath) {
  const fallbackPath = `${dbPath}.json`;
  ensureDir(fallbackPath);

  let state = { daily_metrics: {} };
  try {
    if (fs.existsSync(fallbackPath)) {
      const raw = fs.readFileSync(fallbackPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.daily_metrics) {
        state = parsed;
      }
    }
  } catch (_error) {
    state = { daily_metrics: {} };
  }

  function persist() {
    try {
      fs.writeFileSync(fallbackPath, JSON.stringify(state, null, 2));
    } catch (_error) {
      // best effort fallback store
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureRow(date) {
    if (!state.daily_metrics[date]) {
      state.daily_metrics[date] = {
        date,
        uptime_seconds: 0,
        files_uploaded: 0,
        files_downloaded: 0,
        bytes_uploaded: 0,
        bytes_downloaded: 0,
        shares_created: 0,
        public_shares: 0,
        lan_shares: 0,
      };
    }
    return state.daily_metrics[date];
  }

  function increment(date, updates) {
    const row = ensureRow(date);
    Object.keys(updates || {}).forEach((key) => {
      row[key] = Number(row[key] || 0) + Number(updates[key] || 0);
    });
    persist();
  }

  function trackEvent(name, meta) {
    const date = todayKey();
    if (name === "file_uploaded") {
      increment(date, {
        files_uploaded: meta?.count || 0,
        bytes_uploaded: meta?.bytes || 0,
      });
      return;
    }
    if (name === "file_downloaded") {
      increment(date, {
        files_downloaded: 1,
        bytes_downloaded: meta?.bytes || 0,
      });
      return;
    }
    if (name === "share_created") {
      increment(date, {
        shares_created: 1,
        public_shares: meta?.scope === "public" ? 1 : 0,
        lan_shares: meta?.scope === "local" ? 1 : 0,
      });
    }
  }

  function addUptime(seconds) {
    if (!seconds || seconds <= 0) return;
    increment(todayKey(), { uptime_seconds: seconds });
  }

  function getDailyMetric(date) {
    const key = date || todayKey();
    return Promise.resolve(state.daily_metrics[key] || null);
  }

  function listDailyMetrics(sinceDate) {
    const rows = Object.values(state.daily_metrics || {}).sort((a, b) => a.date.localeCompare(b.date));
    if (!sinceDate) return Promise.resolve(rows);
    return Promise.resolve(rows.filter((row) => row.date >= sinceDate));
  }

  return {
    trackEvent,
    addUptime,
    listDailyMetrics,
    getDailyMetric,
  };
}

function createTelemetryStore(dbPath) {
  let sqlite3 = null;
  try {
    // Native sqlite binary may be unavailable in cross-platform packaged builds.
    sqlite3 = require("sqlite3").verbose();
  } catch (_error) {
    return createFallbackStore(dbPath);
  }

  ensureDir(dbPath);
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(
      "CREATE TABLE IF NOT EXISTS daily_metrics (date TEXT PRIMARY KEY, uptime_seconds INTEGER, files_uploaded INTEGER, files_downloaded INTEGER, bytes_uploaded INTEGER, bytes_downloaded INTEGER, shares_created INTEGER, public_shares INTEGER, lan_shares INTEGER)"
    );
  });

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureRow(date) {
    db.run(
      "INSERT OR IGNORE INTO daily_metrics (date, uptime_seconds, files_uploaded, files_downloaded, bytes_uploaded, bytes_downloaded, shares_created, public_shares, lan_shares) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0)",
      [date]
    );
  }

  function increment(date, updates) {
    ensureRow(date);
    const fields = Object.keys(updates);
    const setClause = fields.map((f) => `${f} = ${f} + ?`).join(", ");
    const values = fields.map((f) => updates[f]);
    db.run(
      `UPDATE daily_metrics SET ${setClause} WHERE date = ?`,
      [...values, date]
    );
  }

  function trackEvent(name, meta) {
    const date = todayKey();
    if (name === "file_uploaded") {
      increment(date, {
        files_uploaded: meta?.count || 0,
        bytes_uploaded: meta?.bytes || 0,
      });
      return;
    }
    if (name === "file_downloaded") {
      increment(date, {
        files_downloaded: 1,
        bytes_downloaded: meta?.bytes || 0,
      });
      return;
    }
    if (name === "share_created") {
      increment(date, {
        shares_created: 1,
        public_shares: meta?.scope === "public" ? 1 : 0,
        lan_shares: meta?.scope === "local" ? 1 : 0,
      });
      return;
    }
  }

  function addUptime(seconds) {
    if (!seconds || seconds <= 0) return;
    increment(todayKey(), { uptime_seconds: seconds });
  }

  function getDailyMetric(date) {
    return new Promise((resolve, reject) => {
      const key = date || todayKey();
      db.get(
        "SELECT * FROM daily_metrics WHERE date = ?",
        [key],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  function listDailyMetrics(sinceDate) {
    return new Promise((resolve, reject) => {
      const query = sinceDate
        ? "SELECT * FROM daily_metrics WHERE date >= ? ORDER BY date ASC"
        : "SELECT * FROM daily_metrics ORDER BY date ASC";
      const params = sinceDate ? [sinceDate] : [];
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  return {
    trackEvent,
    addUptime,
    listDailyMetrics,
    getDailyMetric,
  };
}

module.exports = {
  createTelemetryStore,
};
