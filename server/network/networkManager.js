"use strict";

const os = require("os");
const { EventEmitter } = require("events");

const RFC1918_PREFIXES = [
  { prefix: "10.", priority: 1 },
  { prefix: "172.16.", priority: 2 },
  { prefix: "172.17.", priority: 2 },
  { prefix: "172.18.", priority: 2 },
  { prefix: "172.19.", priority: 2 },
  { prefix: "172.20.", priority: 2 },
  { prefix: "172.21.", priority: 2 },
  { prefix: "172.22.", priority: 2 },
  { prefix: "172.23.", priority: 2 },
  { prefix: "172.24.", priority: 2 },
  { prefix: "172.25.", priority: 2 },
  { prefix: "172.26.", priority: 2 },
  { prefix: "172.27.", priority: 2 },
  { prefix: "172.28.", priority: 2 },
  { prefix: "172.29.", priority: 2 },
  { prefix: "172.30.", priority: 2 },
  { prefix: "172.31.", priority: 2 },
  { prefix: "192.168.", priority: 3 },
];

function getRfc1918Priority(addr) {
  if (!addr || typeof addr !== "string") return 999;
  for (const { prefix, priority } of RFC1918_PREFIXES) {
    if (addr.startsWith(prefix)) return priority;
  }
  return 999;
}

function getBestLanIp() {
  const candidates = [];
  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces || {})) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) {
        candidates.push({
          address: net.address,
          priority: getRfc1918Priority(net.address),
        });
      }
    }
  }
  if (candidates.length === 0) return "127.0.0.1";
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].address;
}

function getAllLanIps() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const list of Object.values(interfaces || {})) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length ? ips : ["127.0.0.1"];
}

function getNetworkEndpoints(displayName, port, shareBasePath = "/share") {
  const bestIp = getBestLanIp();
  const mdnsHost = (displayName || "Join").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") + ".local";
  return {
    mdnsUrl: `http://${mdnsHost}:${port}${shareBasePath}`,
    ipUrl: `http://${bestIp}:${port}${shareBasePath}`,
    bestLanIp: bestIp,
    mdnsHost,
    port,
  };
}

function createNetworkManager({ displayName, port, shareBasePath = "/share", pollIntervalMs = 5000, logger }) {
  const emitter = new EventEmitter();
  let lastIps = "";
  let lastBestIp = "";

  function snapshot() {
    const ips = getAllLanIps().sort().join(",");
    const best = getBestLanIp();
    return { ips, best };
  }

  function check() {
    const { ips, best } = snapshot();
    if (ips !== lastIps || best !== lastBestIp) {
      const changed = lastIps !== "";
      lastIps = ips;
      lastBestIp = best;
      const endpoints = getNetworkEndpoints(displayName, port, shareBasePath);
      emitter.emit("change", { endpoints, changed });
      if (changed && logger) {
        logger.info("network changed", { bestLanIp: best, ips: ips.split(",") });
      }
    }
  }

  const interval = setInterval(check, pollIntervalMs);
  check();

  return {
    getEndpoints: () => getNetworkEndpoints(displayName, port, shareBasePath),
    getBestLanIp,
    getAllLanIps,
    on: (ev, fn) => emitter.on(ev, fn),
    off: (ev, fn) => emitter.off(ev, fn),
    stop: () => clearInterval(interval),
  };
}

module.exports = {
  getBestLanIp,
  getAllLanIps,
  getNetworkEndpoints,
  createNetworkManager,
};
