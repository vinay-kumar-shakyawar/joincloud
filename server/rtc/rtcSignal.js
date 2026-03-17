"use strict";

const path = require("path");
const fs = require("fs");
const stream = require("stream");
const { WebSocketServer } = require("ws");

const UDP_BROADCAST_PORT = 47842;
const RTC_SIGNAL_PATH = "/rtc/signal";

let nodeDataChannel;
try {
  nodeDataChannel = require("node-datachannel");
  if (nodeDataChannel && nodeDataChannel.initLogger) {
    nodeDataChannel.initLogger("Warn");
  }
} catch (e) {
  nodeDataChannel = null;
}

function attachRTCSignaling(httpServer, options = {}) {
  const { config, logger, accessControl } = options;
  const ownerRoot = (config && config.storage && config.storage.ownerRoot) || process.cwd();

  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map();

  function toPosixPath(p) {
    return p.split(path.sep).join("/");
  }

  function resolveTargetPath(targetPath) {
    if (!targetPath || typeof targetPath !== "string") return null;
    const normalized = toPosixPath(targetPath).replace(/^\/+/, "").replace(/\.\./g, "");
    const full = path.join(ownerRoot, normalized);
    if (!full.startsWith(path.resolve(ownerRoot))) return null;
    return full;
  }

  httpServer.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    const pathname = url.split("?")[0];
    if (pathname !== RTC_SIGNAL_PATH) return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    let sessionId = null;
    let role = null;
    let hostPeer = null;
    let browserWs = null;

    function sendToClient(obj) {
      try {
        if (ws.readyState === 1) ws.send(JSON.stringify(obj));
      } catch (e) {
        logger?.warn?.("rtc signal send failed", { error: e?.message });
      }
    }

    ws.on("message", (data) => {
      let msg;
      try {
        msg = typeof data === "string" ? JSON.parse(data) : JSON.parse(data.toString());
      } catch (_) {
        return;
      }
      const { type, sdp, candidate, sessionId: sid } = msg;

      if (type === "join") {
        sessionId = msg.sessionId || sid;
        role = msg.role || "browser";

        if (role === "browser" && accessControl) {
          const fingerprint = String(msg.fingerprint || "").trim();
          const token = String(msg.sessionToken || "").trim();
          accessControl
            .validateSession({ token, fingerprint })
            .then((result) => {
              if (!result?.authorized) {
                sendToClient({ type: "error", message: "approval_required" });
                try {
                  ws.close();
                } catch (_) {}
                return;
              }
              sessions.set(sessionId, { ws, role, sessionId });
              sendToClient({ type: "ready", sessionId });
              if (nodeDataChannel) {
                hostPeer = createHostPeer(
                  sessionId,
                  ws,
                  ownerRoot,
                  logger,
                  (answer, candidates) => {
                    sendToClient({ type: "answer", sessionId, sdp: answer });
                    (candidates || []).forEach((c) =>
                      sendToClient({
                        type: "ice-candidate",
                        sessionId,
                        candidate: c,
                      })
                    );
                  }
                );
              }
            })
            .catch((err) => {
              logger?.warn?.("rtc access validation failed", {
                error: err?.message,
              });
              sendToClient({ type: "error", message: "approval_required" });
              try {
                ws.close();
              } catch (_) {}
            });
        } else {
          sessions.set(sessionId, { ws, role, sessionId });
          sendToClient({ type: "ready", sessionId });
          if (role === "browser" && nodeDataChannel) {
            hostPeer = createHostPeer(
              sessionId,
              ws,
              ownerRoot,
              logger,
              (answer, candidates) => {
                sendToClient({ type: "answer", sessionId, sdp: answer });
                (candidates || []).forEach((c) =>
                  sendToClient({ type: "ice-candidate", sessionId, candidate: c })
                );
              }
            );
          }
        }
        return;
      }

      if (type === "offer" && sessionId && hostPeer && nodeDataChannel) {
        if (!sessions.has(sessionId)) {
          return;
        }
        try {
          const desc = msg.sdp;
          const sdpStr =
            desc && typeof desc === "object" && typeof desc.sdp === "string"
              ? desc.sdp
              : typeof desc === "string"
              ? desc
              : "";
          const offerType =
            desc && typeof desc === "object" && typeof desc.type === "string"
              ? desc.type
              : "offer";
          hostPeer.setRemoteDescription(sdpStr, offerType);
        } catch (e) {
          logger?.warn?.("rtc setRemoteDescription failed", { error: e?.message });
        }
        return;
      }

      if (type === "ice-candidate" && sessionId && hostPeer && nodeDataChannel) {
        if (!sessions.has(sessionId)) {
          return;
        }
        try {
          const c = msg.candidate;
          const candStr =
            c && typeof c === "object" && typeof c.candidate === "string"
              ? c.candidate
              : typeof c === "string"
              ? c
              : "";
          const mid =
            c && typeof c === "object" && typeof c.sdpMid === "string"
              ? c.sdpMid
              : "";
          if (candStr) {
            hostPeer.addRemoteCandidate(candStr, mid);
          }
        } catch (_) {}
        return;
      }

      const other = sessions.get(sessionId);
      if (other && other.ws && other.ws !== ws && other.ws.readyState === 1) {
        try {
          other.ws.send(JSON.stringify(msg));
        } catch (_) {}
      }
    });

    ws.on("close", () => {
      if (sessionId) sessions.delete(sessionId);
      if (hostPeer && typeof hostPeer.close === "function") {
        try {
          hostPeer.close();
        } catch (_) {}
      }
    });
  });

  function createHostPeer(sessionId, browserWsRef, ownerRootPath, log, onAnswer) {
    const PeerConnection = nodeDataChannel && nodeDataChannel.PeerConnection;
    if (!PeerConnection) return null;

    const collectedCandidates = [];
    let answerSdp = null;

    const peer = new PeerConnection(`host-${sessionId}`, { iceServers: [] });
    log?.info?.("rtc host peer created", { sessionId });

    peer.onLocalDescription((sdp, type) => {
      if (type === "answer") answerSdp = sdp;
      if (onAnswer) onAnswer(sdp, type === "answer" ? collectedCandidates : null);
    });

    peer.onLocalCandidate((candidate, mid) => {
      collectedCandidates.push({ candidate, sdpMid: mid });
    });

    peer.onDataChannel((dc) => {
      const label = dc.getLabel?.() || dc.label || "";
      if (label !== "file-transfer") return;

      let meta = null;
      let writeStream = null;
      let targetPath = null;
      let totalReceived = 0;
      let firstChunkLogged = false;
      let pendingChunkIndex = null;
      let pendingChunkLength = null;
      const PASS_HWM = 2 * 1024 * 1024;
      const passThrough = new stream.PassThrough({ highWaterMark: PASS_HWM });

      function sendAck(index, received) {
        try {
          dc.sendMessage(JSON.stringify({ type: "ack", index, received }));
        } catch (_) {}
      }

      function sendDone(name, finalPath) {
        try {
          dc.sendMessage(JSON.stringify({ type: "done", name, path: finalPath }));
        } catch (_) {}
      }

      dc.onMessage((msg) => {
        if (typeof msg === "string") {
          try {
            const obj = JSON.parse(msg);
            if (obj.type === "file-meta") {
              meta = obj;
              targetPath = resolveTargetPath((obj.targetPath || "/").trim() || "/");
              if (!targetPath) {
                log?.warn?.("rtc file-meta invalid targetPath", { targetPath: obj.targetPath });
                return;
              }
              const dir = path.dirname(path.join(targetPath, obj.name || "file"));
              try {
                fs.mkdirSync(dir, { recursive: true });
              } catch (_) {}
              writeStream = fs.createWriteStream(path.join(targetPath, obj.name || "file"), {
                highWaterMark: 256 * 1024,
              });
              writeStream.on("error", (err) => log?.error?.("rtc write error", { error: err.message }));
              passThrough.pipe(writeStream);
              log?.info?.("rtc datachannel file-transfer opened", {
                sessionId,
                name: obj.name,
                size: obj.size,
                totalChunks: obj.totalChunks,
              });
              return;
            }
            if (obj.type === "chunk" && typeof obj.index === "number") {
              pendingChunkIndex = obj.index;
              pendingChunkLength = typeof obj.length === "number" ? obj.length : null;
              return;
            }
          } catch (_) {}
          return;
        }

        if (Buffer.isBuffer(msg) && meta && writeStream) {
          passThrough.write(msg, (err) => {
            if (err) log?.warn?.("rtc passThrough write error", { error: err?.message });
          });
          totalReceived += msg.length;
          if (!firstChunkLogged) {
            log?.info?.("rtc first chunk received", {
              sessionId,
              name: meta?.name,
              index: pendingChunkIndex,
              bytes: msg.length,
            });
            firstChunkLogged = true;
          }
          const index = pendingChunkIndex !== null ? pendingChunkIndex : Math.floor(totalReceived / (pendingChunkLength || msg.length)) - 1;
          sendAck(index, msg.length);
          pendingChunkIndex = null;
          pendingChunkLength = null;
          return;
        }
      });

      dc.onClosed(() => {
        if (writeStream && !writeStream.destroyed) {
          passThrough.end();
          writeStream.on("finish", () => {
            const rel = meta && targetPath ? path.relative(ownerRootPath, path.join(targetPath, meta.name || "file")) : "";
            const finalPath = toPosixPath(rel).replace(/^\/+/, "") ? `/${toPosixPath(rel)}` : "/";
            sendDone(meta?.name || "file", finalPath);
            log?.info?.("rtc file receive complete", {
              sessionId,
              name: meta?.name,
              bytes: totalReceived,
              path: finalPath,
            });
          });
        }
      });
    });

    return peer;
  }

  if (logger) logger.info("rtc signaling attached", { path: RTC_SIGNAL_PATH });
  return { wss, sessions };
}

module.exports = { attachRTCSignaling };
