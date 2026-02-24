const https = require("https");
const http = require("http");
const { URL } = require("url");

function postTelemetry(adminHost, payload) {
  return new Promise((resolve, reject) => {
    const base = adminHost.indexOf("://") === -1 ? `https://${adminHost}` : adminHost;
    const url = new URL("/api/v1/telemetry", base);
    const data = JSON.stringify(payload);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: 5000,
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.write(data);
    req.end();
  });
}

function createTelemetrySync({
  telemetryStore,
  userConfig,
  updateUserConfig,
  adminHost,
  appVersion,
  logger,
}) {
  let timer = null;

  async function runSync() {
    if (!adminHost) return;
    if (!userConfig.telemetry_enabled) return;
    const sinceDate = userConfig.telemetry_last_sync
      ? userConfig.telemetry_last_sync.slice(0, 10)
      : null;
    const rows = await telemetryStore.listDailyMetrics(sinceDate);
    if (!rows.length) return;

    const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : process.platform === "linux" ? "Linux" : process.platform;
    for (const row of rows) {
      const payload = {
        user_id: userConfig.user_id,
        date: row.date,
        app_version: appVersion,
        os: platform,
        uptime_seconds: row.uptime_seconds || 0,
        metrics: {
          files_uploaded: row.files_uploaded || 0,
          files_downloaded: row.files_downloaded || 0,
          bytes_uploaded: row.bytes_uploaded || 0,
          bytes_downloaded: row.bytes_downloaded || 0,
          shares_created: row.shares_created || 0,
          public_shares: row.public_shares || 0,
          lan_shares: row.lan_shares || 0,
        },
      };
      const ok = await postTelemetry(adminHost, payload);
      if (!ok) {
        if (logger) logger.error("telemetry sync failed", { date: row.date });
        return;
      }
    }
    userConfig.telemetry_last_sync = new Date().toISOString();
    await updateUserConfig(userConfig);
    if (logger) logger.info("telemetry sync completed");
  }

  function start() {
    if (timer) return;
    timer = setInterval(runSync, 24 * 60 * 60 * 1000);
    runSync().catch(() => {});
  }

  async function flush() {
    await runSync();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    flush,
  };
}

module.exports = {
  createTelemetrySync,
};
