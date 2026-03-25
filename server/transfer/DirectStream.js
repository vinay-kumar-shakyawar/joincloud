"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
let mime = null;
try {
  // Optional in isolated test/runtime environments.
  mime = require("mime-types");
} catch (_) {
  mime = { lookup: () => "application/octet-stream" };
}
const path = require("path");

const DEFAULT_CONCURRENT_LIMIT = Number(process.env.JOINCLOUD_CONCURRENT_LIMIT_FREE || 3);
const DEFAULT_RATE_WINDOW_MS = Number(process.env.JOINCLOUD_RATE_WINDOW_MS || 60_000);
const DEFAULT_RATE_MAX = Number(process.env.JOINCLOUD_RATE_MAX || 60);

function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader) return null;
  const rangeValue = String(rangeHeader).trim();
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeValue);
  if (!match) return { error: "malformed_range" };
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return { error: "malformed_range" };
  let start = startRaw ? Number(startRaw) : null;
  let end = endRaw ? Number(endRaw) : null;
  if ((start != null && !Number.isInteger(start)) || (end != null && !Number.isInteger(end))) {
    return { error: "malformed_range" };
  }
  if (start == null && end != null) {
    const suffixLength = end;
    if (suffixLength <= 0) return { error: "malformed_range" };
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    if (start == null || start < 0) return { error: "malformed_range" };
    if (end == null || end >= fileSize) end = fileSize - 1;
  }
  if (start >= fileSize || end < start) return { error: "unsatisfiable_range" };
  return { start, end, size: end - start + 1 };
}

function streamFileWithRange(req, res, options) {
  const { filePath, fileName, mimeType, download, onData, onDone, onError } = options;
  const resolvedFileName = String(fileName || path.basename(filePath) || "download");
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_) {
    res.status(404).json({ error: "file_not_found" });
    return;
  }
  if (!stat.isFile()) {
    res.status(404).json({ error: "file_not_found" });
    return;
  }

  const contentType = mimeType || mime.lookup(resolvedFileName) || "application/octet-stream";
  const fileSize = stat.size;
  const parsedRange = parseRangeHeader(req.headers.range, fileSize);
  if (parsedRange?.error === "malformed_range") {
    res.status(400).json({ error: "malformed_range_header" });
    return;
  }
  if (parsedRange?.error === "unsatisfiable_range") {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
    res.json({ error: "range_not_satisfiable", fileSize });
    return;
  }

  const hasRange = Boolean(parsedRange);
  const start = hasRange ? parsedRange.start : 0;
  const end = hasRange ? parsedRange.end : fileSize - 1;
  const contentLength = hasRange ? parsedRange.size : fileSize;

  res.status(hasRange ? 206 : 200);
  if (hasRange) res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", String(contentLength));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    download
      ? `attachment; filename="${resolvedFileName}"; filename*=UTF-8''${encodeURIComponent(resolvedFileName)}`
      : `inline; filename="${resolvedFileName}"; filename*=UTF-8''${encodeURIComponent(resolvedFileName)}`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  if (String(req.method || "").toUpperCase() === "HEAD") {
    if (onDone) onDone(0, contentLength, fileSize, false);
    res.end();
    return;
  }

  let bytesSent = 0;
  let doneCalled = false;
  const emitDone = (aborted) => {
    if (doneCalled) return;
    doneCalled = true;
    if (onDone) onDone(bytesSent, contentLength, fileSize, aborted);
  };
  const readStream = fs.createReadStream(filePath, { start, end, highWaterMark: 2 * 1024 * 1024 });
  readStream.on("data", (chunk) => {
    bytesSent += chunk.length;
    if (onData) onData(bytesSent, contentLength, fileSize);
  });
  readStream.on("error", (error) => {
    if (onError) onError(error);
    if (!res.headersSent) res.status(500).json({ error: "stream_failed" });
    else res.destroy(error);
  });
  res.on("close", () => {
    if (!readStream.destroyed) readStream.destroy();
    emitDone(true);
  });
  res.on("finish", () => {
    emitDone(false);
  });
  readStream.pipe(res);
}

function createDirectStreamManager(options = {}) {
  const activeTokens = new Map();
  const activeTransfers = new Map();
  const rateState = new Map();
  const tokenTtlMs = Number(options.tokenTtlMs || 3_600_000);
  const concurrentLimit = Number(options.concurrentLimit || DEFAULT_CONCURRENT_LIMIT);
  const rateWindowMs = Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS);
  const rateMax = Number(options.rateMax || DEFAULT_RATE_MAX);
  const logger = options.logger;
  const onProgress = options.onProgress;

  function registerShareToken(filePath, fileName, mimeType, extra = {}) {
    const token = crypto.randomBytes(24).toString("hex");
    activeTokens.set(token, {
      filePath,
      fileName: fileName || path.basename(filePath),
      mimeType: mimeType || null,
      createdAt: Date.now(),
      expires: Date.now() + tokenTtlMs,
      shareId: extra.shareId || null,
      plan: extra.plan || "free",
    });
    return token;
  }

  function revokeToken(token) {
    activeTokens.delete(String(token || ""));
  }

  function cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, record] of activeTokens.entries()) {
      if (record.expires <= now) activeTokens.delete(token);
    }
  }

  function getConcurrentCount(key) {
    let count = 0;
    for (const transfer of activeTransfers.values()) {
      if (transfer.key === key) count += 1;
    }
    return count;
  }

  function checkRateLimit(key) {
    const now = Date.now();
    const state = rateState.get(key) || { count: 0, windowStart: now };
    if (now - state.windowStart > rateWindowMs) {
      state.count = 0;
      state.windowStart = now;
    }
    state.count += 1;
    rateState.set(key, state);
    return state.count <= rateMax;
  }

  async function handleDownload(req, res) {
    cleanupExpiredTokens();
    const token = String(req.params.token || "").trim();
    const record = activeTokens.get(token);
    if (!record) {
      res.status(410).json({ error: "link_expired" });
      return;
    }
    if (Date.now() > record.expires) {
      activeTokens.delete(token);
      res.status(410).json({ error: "link_expired" });
      return;
    }
    const key = record.shareId || token;
    if (!checkRateLimit(key)) {
      res.status(429).json({ error: "too_many_requests_for_share_link" });
      return;
    }
    const planLimit = record.plan === "pro" ? Number.POSITIVE_INFINITY : concurrentLimit;
    if (getConcurrentCount(key) >= planLimit) {
      res.status(429).json({ error: "too_many_concurrent_downloads", upgrade: record.plan !== "pro" });
      return;
    }
    try {
      const stats = await fsp.stat(record.filePath);
      if (!stats.isFile()) {
        res.status(404).json({ error: "file_not_found" });
        return;
      }
    } catch (_) {
      res.status(404).json({ error: "file_not_found" });
      return;
    }

    const transferId = `${token}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeTransfers.set(transferId, {
      key,
      token,
      startTime: Date.now(),
      bytesSent: 0,
      ip: req.ip,
    });

    streamFileWithRange(req, res, {
      filePath: record.filePath,
      fileName: record.fileName,
      mimeType: record.mimeType,
      download: req.query.download === "true",
      onData: (bytesSent, contentLength, totalBytes) => {
        const item = activeTransfers.get(transferId);
        if (item) item.bytesSent = bytesSent;
        if (onProgress) {
          const pct = totalBytes > 0 ? Math.round((bytesSent / totalBytes) * 100) : 0;
          onProgress({ token, transferId, pct, bytesSent, total: totalBytes, contentLength });
        }
      },
      onDone: () => {
        activeTransfers.delete(transferId);
      },
      onError: (error) => {
        activeTransfers.delete(transferId);
        if (logger) logger.error("direct stream error", { token, error: error?.message });
      },
    });
  }

  return {
    registerShareToken,
    revokeToken,
    handleDownload,
    getConcurrentCount,
    activeTransfers,
  };
}

module.exports = { createDirectStreamManager, streamFileWithRange, parseRangeHeader };
