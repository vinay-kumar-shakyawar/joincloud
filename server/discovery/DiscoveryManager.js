"use strict";

const os = require("os");
const crypto = require("crypto");
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

const PEER_OFFLINE_TTL_MS = 15 * 1000;

function getRfc1918Priority(addr) {
  if (!addr || typeof addr !== "string") return 999;
  for (const { prefix, priority } of RFC1918_PREFIXES) {
    if (addr.startsWith(prefix)) return priority;
  }
  return 999;
}

function pickBestIp(ips) {
  if (!ips || !Array.isArray(ips) || ips.length === 0) return null;
  const candidates = ips
    .filter((ip) => ip && ip !== "127.0.0.1" && ip !== "::1")
    .map((ip) => ({ address: ip, priority: getRfc1918Priority(ip) }));
  if (candidates.length === 0) return ips[0];
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].address;
}

function shortDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== "string") return "unknown";
  const clean = deviceId.replace(/^jc_|^dev_/i, "").replace(/[^a-zA-Z0-9]/g, "");
  return clean.slice(0, 8).toLowerCase() || "unknown";
}

function createDiscoveryManager({ bonjour, hostId, displayName: initialDisplayName, port, appVersion, logger }) {
  const emitter = new EventEmitter();
  const peerRegistry = new Map();
  let advertiseService = null;
  let browser = null;
  let offlineCheckInterval = null;
  let displayName = initialDisplayName || "Join";

  const mdnsHostShort = `join-${shortDeviceId(hostId)}`;
  const mdnsHostname = `${mdnsHostShort}.local`;
  const role = "host";

  function emitPeers() {
    const peers = Array.from(peerRegistry.values()).filter((p) => p.deviceId !== hostId);
    emitter.emit("peers", peers);
  }

  function markOffline() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of peerRegistry.entries()) {
      if (id === hostId) continue;
      const lastSeen = peer.lastSeenAt || 0;
      if (now - lastSeen > PEER_OFFLINE_TTL_MS && peer.status !== "offline") {
        peer.status = "offline";
        changed = true;
      }
    }
    if (changed) emitPeers();
  }

  function upsertPeer(entry) {
    const { deviceId, displayName: name, ips, hostname, port: peerPort, source = "mdns" } = entry;
    if (!deviceId) return;
    const existing = peerRegistry.get(deviceId);
    const bestIp = pickBestIp(ips);
    const peer = {
      deviceId,
      displayName: name || "Unknown",
      ips: ips || [],
      bestIp: bestIp || (existing && existing.bestIp) || null,
      hostname: hostname || (existing && existing.hostname) || null,
      port: peerPort ?? port,
      lastSeenAt: Date.now(),
      status: "online",
      source: source || (existing && existing.source) || "mdns",
    };
    peerRegistry.set(deviceId, peer);
    emitPeers();
  }

  function startAdvertise() {
    if (advertiseService) return;
    try {
      advertiseService = bonjour.publish({
        name: displayName,
        type: "joincloud",
        protocol: "tcp",
        port,
        host: mdnsHostname,
        txt: {
          deviceId: hostId,
          version: appVersion || "1.0",
          role,
          display_name: displayName,
        },
      });
      logger?.info("discovery advertise started", { hostname: mdnsHostname, displayName });
    } catch (err) {
      logger?.error("discovery advertise failed", { error: err?.message });
      emitter.emit("advertiseError", err);
    }
  }

  function stopAdvertise() {
    if (advertiseService) {
      try {
        advertiseService.stop();
      } catch (_) {}
      advertiseService = null;
      logger?.info("discovery advertise stopped");
    }
  }

  function restartAdvertise(newDisplayName) {
    stopAdvertise();
    if (newDisplayName !== undefined) {
      displayName = newDisplayName;
    }
    startAdvertise();
  }

  function startBrowse() {
    if (browser) return;
    browser = bonjour.find({ type: "joincloud" });

    browser.on("up", (service) => {
      const deviceId = service.txt?.deviceId;
      const name = service.txt?.display_name || service.name || "Unknown";
      if (!deviceId) return;
      const addrFromReferer = service.referer?.address ? [service.referer.address] : [];
      const addrFromA = (service.addresses || []).map(String).filter(Boolean);
      const ips = [...new Set([...addrFromReferer, ...addrFromA])].filter((a) => a && !a.endsWith(".local"));
      const hostname = service.host ? (service.host.endsWith(".local") ? service.host : `${service.host}.local`) : null;
      upsertPeer({
        deviceId,
        displayName: name,
        ips: ips.length ? ips : (service.addresses || []).map(String),
        hostname,
        port: service.port,
        source: "mdns",
      });
    });

    browser.on("down", (service) => {
      const deviceId = service.txt?.deviceId;
      if (deviceId && deviceId !== hostId) {
        const peer = peerRegistry.get(deviceId);
        if (peer) {
          peer.status = "offline";
          peer.lastSeenAt = Date.now();
          emitPeers();
        }
      }
    });

    offlineCheckInterval = setInterval(markOffline, 5000);
    logger?.info("discovery browse started");
  }

  function stopBrowse() {
    if (offlineCheckInterval) {
      clearInterval(offlineCheckInterval);
      offlineCheckInterval = null;
    }
    if (browser) {
      try {
        browser.stop();
      } catch (_) {}
      browser = null;
    }
    peerRegistry.clear();
    emitPeers();
    logger?.info("discovery browse stopped");
  }

  function addManualPeer({ deviceId, displayName: name, ip, port: peerPort }) {
    if (!deviceId || !ip) return null;
    upsertPeer({
      deviceId,
      displayName: name || "Manual",
      ips: [ip],
      hostname: null,
      port: peerPort || port,
      source: "manual",
    });
    return peerRegistry.get(deviceId);
  }

  return {
    getHostname: () => mdnsHostname,
    getPeers: () => Array.from(peerRegistry.values()).filter((p) => p.deviceId !== hostId),
    getPeer: (deviceId) => peerRegistry.get(deviceId),
    startAdvertise,
    stopAdvertise,
    restartAdvertise,
    startBrowse,
    stopBrowse,
    addManualPeer,
    upsertPeer,
    on: (ev, fn) => emitter.on(ev, fn),
    off: (ev, fn) => emitter.off(ev, fn),
  };
}

module.exports = {
  createDiscoveryManager,
  shortDeviceId,
  pickBestIp,
};
