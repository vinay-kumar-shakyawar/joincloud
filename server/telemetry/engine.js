const https = require("https");
const http = require("http");
const { URL } = require("url");

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;
const AGGREGATE_INTERVAL_MS = 10 * 60 * 1000;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;

function postJson(targetUrl, payload) {
  return new Promise((resolve) => {
    try {
      const url = new URL(targetUrl);
      const client = url.protocol === "https:" ? https : http;
      const data = JSON.stringify(payload);
      const req = client.request(
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
    } catch (error) {
      resolve(false);
    }
  });
}

function createBackoffState() {
  return {
    failures: 0,
  };
}

function nextBackoffMs(state) {
  const attempt = Math.min(state.failures, 10);
  const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, attempt));
  return delay;
}

function createTelemetryEngine({
  adminBaseUrl,
  deviceUUID,
  appVersion,
  userConfig,
  updateUserConfig,
  telemetryCounters,
  getBackendHealthy,
  logger,
}) {
  let heartbeatTimer = null;
  let aggregateTimer = null;
  let installTimer = null;
  const installBackoff = createBackoffState();
  const heartbeatBackoff = createBackoffState();
  const aggregateBackoff = createBackoffState();

  function buildUrl(pathname) {
    if (!adminBaseUrl) return null;
    return `${adminBaseUrl.replace(/\/$/, "")}${pathname}`;
  }

  async function registerInstall() {
    if (!adminBaseUrl) return true;
    if (userConfig.install_registered) return true;
    const payload = {
      deviceUUID,
      appVersion,
      platform: "macOS",
      arch: process.arch,
      installType: "dmg",
      firstLaunchAt: userConfig.first_launch_at,
    };
    const ok = await postJson(buildUrl("/install/register"), payload);
    if (ok) {
      userConfig.install_registered = true;
      await updateUserConfig(userConfig);
    }
    return ok;
  }

  async function sendHeartbeat() {
    if (!adminBaseUrl) return true;
    const payload = {
      deviceUUID,
      uptimeSeconds: Math.floor(process.uptime()),
      backendHealthy: typeof getBackendHealthy === "function" ? !!getBackendHealthy() : true,
      appVersion,
    };
    return postJson(buildUrl("/heartbeat"), payload);
  }

  async function sendAggregate() {
    if (!adminBaseUrl) return true;
    const metrics = telemetryCounters.snapshot();
    const payload = {
      deviceUUID,
      ...metrics,
    };
    const ok = await postJson(buildUrl("/telemetry/aggregate"), payload);
    if (ok) {
      telemetryCounters.reset();
    }
    return ok;
  }

  function scheduleInstall(delayMs) {
    installTimer = setTimeout(async () => {
      const ok = await registerInstall();
      if (ok) {
        installBackoff.failures = 0;
        return;
      }
      installBackoff.failures += 1;
      const nextDelay = nextBackoffMs(installBackoff);
      if (logger) logger.error("telemetry install failed");
      scheduleInstall(nextDelay);
    }, delayMs);
  }

  function scheduleHeartbeat(delayMs) {
    heartbeatTimer = setTimeout(async () => {
      const ok = await sendHeartbeat();
      if (ok) {
        heartbeatBackoff.failures = 0;
        scheduleHeartbeat(HEARTBEAT_INTERVAL_MS);
        return;
      }
      heartbeatBackoff.failures += 1;
      const nextDelay = nextBackoffMs(heartbeatBackoff);
      if (logger) logger.error("telemetry heartbeat failed");
      scheduleHeartbeat(nextDelay);
    }, delayMs);
  }

  function scheduleAggregate(delayMs) {
    aggregateTimer = setTimeout(async () => {
      const ok = await sendAggregate();
      if (ok) {
        aggregateBackoff.failures = 0;
        scheduleAggregate(AGGREGATE_INTERVAL_MS);
        return;
      }
      aggregateBackoff.failures += 1;
      const nextDelay = nextBackoffMs(aggregateBackoff);
      if (logger) logger.error("telemetry aggregate failed");
      scheduleAggregate(nextDelay);
    }, delayMs);
  }

  function start() {
    scheduleInstall(2000);
    scheduleHeartbeat(2000);
    scheduleAggregate(AGGREGATE_INTERVAL_MS);
  }

  function flush() {
    sendAggregate().catch(() => {});
  }

  function stop() {
    if (installTimer) clearTimeout(installTimer);
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    if (aggregateTimer) clearTimeout(aggregateTimer);
    installTimer = null;
    heartbeatTimer = null;
    aggregateTimer = null;
  }

  return {
    start,
    stop,
    flush,
  };
}

module.exports = {
  createTelemetryEngine,
};
