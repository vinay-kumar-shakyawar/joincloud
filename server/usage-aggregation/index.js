"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const PERSIST_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SEND_INTERVAL_MS = 24 * 60 * 60 * 1000;   // 24 hours
const IDLE_THRESHOLD_MS = 15 * 60 * 1000;       // 15 min no transfer = idle
const SEND_TIMEOUT_MS = 2000;
const PENDING_FILE = "usage-pending.json";

function getHostUuid(userDataPath) {
  if (!userDataPath) return null;
  try {
    const p = path.join(userDataPath, "JoinCloud", "system", "host_uuid");
    if (!fs.existsSync(p)) return null;
    const uuid = fs.readFileSync(p, "utf8").trim();
    return uuid.length >= 8 && uuid.length <= 128 ? uuid : null;
  } catch (_) {
    return null;
  }
}

function createUsageAggregation(opts) {
  const {
    userDataPath,
    adminHost,
    getTelemetryStore,
    getRuntimeTelemetry,
    getUptimeSeconds,
    logger,
  } = opts;

  let periodStart = null;
  let lastPersistAt = 0;
  let lastSendAt = 0;
  let lastTransferAt = 0;
  let sendTimer = null;
  let persistTimer = null;
  let pending = [];

  const pendingPath = userDataPath ? path.join(userDataPath, "JoinCloud", "system", PENDING_FILE) : null;

  function loadPending() {
    if (!pendingPath || !fs.existsSync(pendingPath)) return;
    try {
      const raw = fs.readFileSync(pendingPath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) pending = data;
    } catch (_) {
      pending = [];
    }
  }

  function savePending() {
    if (!pendingPath || pending.length === 0) return;
    try {
      const dir = path.dirname(pendingPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(pendingPath, JSON.stringify(pending), "utf8");
    } catch (_) {}
  }

  function clearPending() {
    pending = [];
    if (pendingPath && fs.existsSync(pendingPath)) {
      try { fs.unlinkSync(pendingPath); } catch (_) {}
    }
  }

  function getCurrentSnapshot() {
    const now = new Date();
    let uptimeSeconds = 0;
    let bytesUploaded = 0;
    let bytesDownloaded = 0;
    let totalShares = 0;
    let totalDevices = 0;
    const storageUsedBytes = 0;

    if (typeof getUptimeSeconds === "function") {
      uptimeSeconds = getUptimeSeconds();
    }
    const rt = typeof getRuntimeTelemetry === "function" ? getRuntimeTelemetry() : null;
    if (rt) {
      bytesUploaded = Number(rt.bytes_uploaded) || 0;
      bytesDownloaded = Number(rt.bytes_downloaded) || 0;
      totalShares = Number(rt.total_shares_created) || 0;
      totalDevices = Number(rt.devices_approved) || 0;
    }
    return {
      period_start: periodStart || now.toISOString().slice(0, 13) + ":00:00.000Z",
      period_end: now.toISOString(),
      uptime_seconds: uptimeSeconds,
      storage_used_bytes: storageUsedBytes,
      bytes_uploaded: bytesUploaded,
      bytes_downloaded: bytesDownloaded,
      total_shares: totalShares,
      total_devices: totalDevices,
    };
  }

  function startPeriod() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const h = String(Math.floor(now.getUTCHours() / 6) * 6).padStart(2, "0");
    periodStart = `${y}-${m}-${d}T${h}:00:00.000Z`;
  }

  function flushPeriod() {
    const hostUuid = getHostUuid(userDataPath);
    if (!hostUuid) return;
    const snap = getCurrentSnapshot();
    snap.period_start = periodStart || snap.period_start;
    pending.push(snap);
    savePending();
    startPeriod();
    lastPersistAt = Date.now();
  }

  function isIdle() {
    return Date.now() - lastTransferAt >= IDLE_THRESHOLD_MS;
  }

  function recordTransferActivity() {
    lastTransferAt = Date.now();
  }

  function postReport(hostUuid, aggregates) {
    return new Promise((resolve) => {
      if (!adminHost || !hostUuid || !aggregates.length) {
        resolve(false);
        return;
      }
      const baseUrl = adminHost.indexOf("://") === -1 ? `https://${adminHost}` : adminHost;
      const u = new URL("/api/v1/usage/report", baseUrl);
      const isHttps = u.protocol === "https:";
      const lib = isHttps ? https : require("http");
      const body = JSON.stringify({ host_uuid: hostUuid, aggregates });
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (isHttps ? 443 : 80),
          path: u.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: SEND_TIMEOUT_MS,
        },
        (res) => {
          res.resume();
          resolve(res.statusCode >= 200 && res.statusCode < 300);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.write(body);
      req.end();
    });
  }

  function sendPending() {
    const hostUuid = getHostUuid(userDataPath);
    if (!hostUuid || pending.length === 0) return Promise.resolve();
    const toSend = pending.slice();
    return postReport(hostUuid, toSend).then((ok) => {
      if (ok) {
        pending = pending.filter((p) => !toSend.includes(p));
        clearPending();
        pending = [];
        savePending();
        lastSendAt = Date.now();
        if (logger) logger.info("usage report sent", { count: toSend.length });
      }
    });
  }

  function tick() {
    const now = Date.now();
    if (now - lastPersistAt >= PERSIST_INTERVAL_MS) {
      flushPeriod();
    }
    if (!adminHost) return;
    const hostUuid = getHostUuid(userDataPath);
    if (!hostUuid) return;
    const shouldSend =
      pending.length > 0 &&
      (isIdle() || now - lastSendAt >= SEND_INTERVAL_MS);
    if (shouldSend) {
      sendPending().catch(() => {});
    }
  }

  function start() {
    loadPending();
    startPeriod();
    lastTransferAt = Date.now();
    lastPersistAt = Date.now();
    lastSendAt = Date.now();
    persistTimer = setInterval(tick, 5 * 60 * 1000);
    sendTimer = setInterval(tick, 5 * 60 * 1000);
  }

  function stop() {
    if (persistTimer) {
      clearInterval(persistTimer);
      persistTimer = null;
    }
    if (sendTimer) {
      clearInterval(sendTimer);
      sendTimer = null;
    }
    flushPeriod();
    return sendPending();
  }

  return {
    start,
    stop,
    recordTransferActivity,
    getCurrentSnapshot,
    flushPeriod,
    sendPending,
  };
}

module.exports = {
  createUsageAggregation,
  getHostUuid,
};
