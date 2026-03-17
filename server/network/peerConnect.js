"use strict";

const { WebSocketServer } = require("ws");

const PEER_CONNECT_PATH = "/peer/connect";

const connectedPeers = new Map();
let peerConnectEmitter = null;

function getConnectedPeers() {
  return connectedPeers;
}

function attachPeerConnect(httpServer, discoveryManager, options = {}) {
  const { logger, hostId: serverHostIdOpt, hostName: serverHostNameOpt } = options;
  const emitter = options.emitter || new (require("events").EventEmitter)();
  peerConnectEmitter = emitter;
  const serverHostId = serverHostIdOpt || "host";
  const serverHostName = serverHostNameOpt || "JoinCloud";

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    const pathname = url.split("?")[0];
    if (pathname !== PEER_CONNECT_PATH) return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const clientIp = request.socket.remoteAddress || request.headers["x-forwarded-for"] || "";
    const normalizedIp = clientIp.replace(/^::ffff:/, "");

    let hostId = null;
    let hostName = null;

    function isPeerDiscovered() {
      if (!discoveryManager || !discoveryManager.getPeers) return false;
      const peers = discoveryManager.getPeers();
      const byIp = peers.find((p) => p.bestIp === normalizedIp || (p.ips && p.ips.includes(normalizedIp)));
      if (byIp) return true;
      return peers.some((p) => p.deviceId === hostId);
    }

    ws.on("message", (data) => {
      let msg;
      try {
        msg = typeof data === "string" ? JSON.parse(data) : JSON.parse(data.toString());
      } catch (_) {
        return;
      }
      const { type } = msg;

      if (type === "hello") {
        hostId = msg.hostId || null;
        hostName = msg.hostName || msg.displayName || "Unknown";
        const version = msg.version;
        const httpPort = msg.httpPort;

        if (!hostId) {
          ws.send(JSON.stringify({ type: "error", message: "hostId required" }));
          return;
        }

        const ack = { type: "hello-ack", hostId: serverHostId, hostName: serverHostName };
        ws.send(JSON.stringify(ack));

        connectedPeers.set(hostId, {
          ws,
          hostId,
          hostName,
          ip: normalizedIp,
          connectedAt: Date.now(),
        });

        emitter.emit("peer-connected", { hostId, hostName, ip: normalizedIp });
        logger?.info?.("peer connected", { hostId, hostName, ip: normalizedIp });
        return;
      }

      const peer = connectedPeers.get(hostId);
      if (peer && peer.ws === ws) {
        emitter.emit("peer-message", { hostId, message: msg });
      }
    });

    ws.on("close", () => {
      if (hostId) {
        connectedPeers.delete(hostId);
        emitter.emit("peer-disconnected", { hostId, hostName, ip: normalizedIp });
        logger?.info?.("peer disconnected", { hostId });
      }
    });
  });

  if (logger) logger.info("peer connect attached", { path: PEER_CONNECT_PATH });
  return { wss, connectedPeers: getConnectedPeers, emitter };
}

module.exports = { attachPeerConnect, getConnectedPeers };
