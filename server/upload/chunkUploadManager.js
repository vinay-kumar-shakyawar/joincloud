"use strict";

const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const crypto = require("crypto");
const { resolveOwnerPath } = require("../security/pathGuard");

function toPosixPath(input) {
  const s = String(input || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
  if (!s || s === "/") return "/";
  return s.startsWith("/") ? s : `/${s}`;
}

function assertChunkTargetAllowed(access, posixTarget) {
  if (!access || access.role === "host" || access.is_admin) return;
  const rel = access.device_folder_rel;
  if (!rel) return;
  const norm = toPosixPath(posixTarget);
  const prefix = toPosixPath(rel);
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  if (norm !== prefix && norm !== p.slice(0, -1) && !norm.startsWith(p)) {
    const err = new Error("target_outside_device_folder");
    err.code = "TARGET_DENIED";
    throw err;
  }
}

const CHUNK_SIZE = 2 * 1024 * 1024;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const sessions = new Map();

function ensureUploadsTmpDir(dir) {
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

function cleanupStale() {
  const now = Date.now();
  for (const [uploadId, s] of sessions.entries()) {
    if (now - (s.createdAt || 0) > SESSION_TTL_MS) {
      sessions.delete(uploadId);
      if (s.tempPath) {
        fs.unlink(s.tempPath).catch(() => {});
      }
    }
  }
}

function verifyChunkHmac(transferId, chunkIndex, chunkBuf, hmacSig, rawKeyBuf) {
  const message = Buffer.from(`${transferId}:${chunkIndex}`);
  const combined = Buffer.concat([message, chunkBuf]);
  const hmac = crypto.createHmac("sha256", rawKeyBuf).update(combined).digest("base64");
  return hmac === hmacSig;
}

function registerChunkUploadRoutes(app, config, options = {}) {
  const ownerRoot = config.storage.ownerRoot || process.cwd();
  const tmpDir = path.join(ownerRoot, ".uploads-tmp");
  const keyStore = options.keyStore || null;
  const decryptMetadata = options.decryptMetadata || null;
  const detectTransferMode = options.detectTransferMode || null;
  const isValidHostSessionToken = options.isValidHostSessionToken || (() => false);
  const getAccess = typeof options.getAccess === "function" ? options.getAccess : () => null;
  ensureUploadsTmpDir(tmpDir);

  setInterval(cleanupStale, CLEANUP_INTERVAL_MS);

  const initPaths = ["/api/v2/upload/init", "/transfer/init"];
  initPaths.forEach((routePath) => app.post(routePath, async (req, res) => {
    const access = getAccess(req);
    if (!access || access.can_upload === false) {
      res.status(403).json({ error: "upload_denied", message: "Session required to upload to host storage." });
      return;
    }
    const transferMode = detectTransferMode
      ? detectTransferMode(req, {
          hasDevice: (deviceId) => Boolean(keyStore?.hasDevice?.(deviceId)),
          isValidHostToken: isValidHostSessionToken,
        })
      : "CHUNKED";
    if (transferMode !== "CHUNKED") {
      res.status(400).json({ error: "invalid_transfer_mode_for_chunked_upload" });
      return;
    }

    const body = req.body || {};
    let fileName = body.fileName;
    let totalSize = body.totalSize;
    const totalChunks = body.totalChunks;
    const targetPath = body.targetPath;
    let mimeType = body.mimeType;
    let pairedDeviceId = body.pairedDeviceId ? String(body.pairedDeviceId) : null;
    if (pairedDeviceId && decryptMetadata) {
      const rawKey = keyStore?.getKey?.(pairedDeviceId);
      if (!rawKey) {
        res.status(401).json({ error: "paired_device_key_not_found" });
        return;
      }
      try {
        const meta = decryptMetadata(body, rawKey);
        fileName = meta.fileName;
        totalSize = meta.fileSize;
        mimeType = meta.mimeType || mimeType;
        if (meta.targetPath != null) {
          targetPath = meta.targetPath;
        }
      } catch (_) {
        res.status(401).json({ error: "Metadata auth failed" });
        return;
      }
    }
    if (!fileName || totalSize == null) {
      res.status(400).json({ error: "fileName and totalSize required" });
      return;
    }
    const uploadId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const tempPath = path.join(tmpDir, `${uploadId}.part`);
    const safeTarget = (targetPath || "/").replace(/\.\./g, "").trim() || "/";
    const posixTarget = toPosixPath(safeTarget);
    try {
      assertChunkTargetAllowed(access, posixTarget);
    } catch (e) {
      if (e && e.code === "TARGET_DENIED") {
        res.status(403).json({ error: "target_outside_device_folder" });
        return;
      }
      throw e;
    }
    let resolvedTargetDir;
    try {
      resolvedTargetDir = resolveOwnerPath(ownerRoot, posixTarget);
    } catch (_e) {
      res.status(400).json({ error: "invalid target path" });
      return;
    }
    const totalSizeNum = Number(totalSize);
    const totalChunksNum = Number(totalChunks) || Math.ceil(totalSizeNum / CHUNK_SIZE);
    sessions.set(uploadId, {
      uploadId,
      fileName: String(fileName),
      totalSize: totalSizeNum,
      totalChunks: totalChunksNum,
      targetPath: posixTarget,
      resolvedTargetDir,
      mimeType: mimeType || null,
      pairedDeviceId,
      tempPath,
      uploadedChunks: [],
      createdAt: Date.now(),
      expiresAt,
    });
    try {
      const fd = await fs.open(tempPath, "w");
      await fd.close();
    } catch (e) {
      sessions.delete(uploadId);
      res.status(500).json({ error: "could not create temp file" });
      return;
    }
    // Do not pre-truncate to full size: a sparse/zero-filled file of length totalSize made
    // getExistingChunksForSession() treat every chunk offset as "already received", so clients
    // skipped all PUT /transfer/chunk writes and previews showed empty files.
    const alreadyReceived = [];
    sessions.get(uploadId).uploadedChunks = [];
    res.json({
      uploadId,
      transferId: uploadId,
      chunkSize: CHUNK_SIZE,
      totalChunks: totalChunksNum,
      uploadedChunks: alreadyReceived,
      alreadyReceived,
      expiresAt,
    });
  }));

  const chunkPaths = ["/api/v2/upload/chunk", "/transfer/chunk"];
  chunkPaths.forEach((routePath) => app.put(routePath, async (req, res) => {
    const access = getAccess(req);
    if (!access || access.can_upload === false) {
      res.status(403).json({ error: "upload_denied" });
      return;
    }
    const uploadId = req.headers["x-upload-id"];
    const chunkIndex = parseInt(req.headers["x-chunk-index"], 10);
    if (!uploadId || isNaN(chunkIndex) || chunkIndex < 0) {
      res.status(400).json({ error: "X-Upload-Id and X-Chunk-Index required" });
      return;
    }
    const session = sessions.get(uploadId);
    if (!session) {
      res.status(404).json({ error: "upload session not found" });
      return;
    }
    const chunks = session.uploadedChunks;
    if (chunks.includes(chunkIndex)) {
      res.json({ uploadId, chunkIndex, received: 0, uploadedChunks: [...chunks] });
      return;
    }
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const data = Buffer.concat(buffers);
    const transferId = String(req.headers["x-transfer-id"] || uploadId);
    const hmacSig = req.headers["x-chunk-hmac"];
    if (session.pairedDeviceId && keyStore?.getKey && hmacSig) {
      const key = keyStore.getKey(session.pairedDeviceId);
      if (!key || !verifyChunkHmac(transferId, chunkIndex, data, String(hmacSig), key)) {
        res.status(401).json({ error: "chunk_hmac_verification_failed" });
        return;
      }
    }
    try {
      const fd = await fs.open(session.tempPath, "r+");
      const offset = chunkIndex * CHUNK_SIZE;
      await fd.write(data, 0, data.length, offset);
      await fd.close();
    } catch (e) {
      res.status(500).json({ error: "write failed" });
      return;
    }
    chunks.push(chunkIndex);
    chunks.sort((a, b) => a - b);
    res.json({ uploadId, chunkIndex, received: data.length, uploadedChunks: [...chunks] });
  }));

  const completePaths = ["/api/v2/upload/complete", "/transfer/complete"];
  completePaths.forEach((routePath) => app.post(routePath, async (req, res) => {
    const access = getAccess(req);
    if (!access || access.can_upload === false) {
      res.status(403).json({ error: "upload_denied" });
      return;
    }
    const { uploadId, fileName } = req.body || {};
    if (!uploadId || !fileName) {
      res.status(400).json({ error: "uploadId and fileName required" });
      return;
    }
    const session = sessions.get(uploadId);
    if (!session) {
      res.status(404).json({ error: "upload session not found" });
      return;
    }
    if (session.fileName !== fileName) {
      res.status(400).json({ error: "fileName mismatch" });
      return;
    }
    const expectedChunks = session.totalChunks;
    const received = session.uploadedChunks.length;
    if (received !== expectedChunks) {
      res.status(400).json({
        error: "incomplete",
        uploadedChunks: session.uploadedChunks.length,
        totalChunks: expectedChunks,
      });
      return;
    }
    const posixTarget = toPosixPath(session.targetPath || "/");
    try {
      assertChunkTargetAllowed(access, posixTarget);
    } catch (e) {
      if (e && e.code === "TARGET_DENIED") {
        res.status(403).json({ error: "target_outside_device_folder" });
        return;
      }
      throw e;
    }
    let resolvedDir = session.resolvedTargetDir;
    try {
      if (!resolvedDir) {
        resolvedDir = resolveOwnerPath(ownerRoot, posixTarget);
      }
    } catch (_e) {
      res.status(400).json({ error: "invalid target path" });
      return;
    }
    await fs.mkdir(resolvedDir, { recursive: true }).catch(() => {});
    const finalPath = path.join(resolvedDir, path.basename(fileName));
    try {
      await fs.rename(session.tempPath, finalPath);
    } catch (e) {
      try {
        await fs.copyFile(session.tempPath, finalPath);
        await fs.unlink(session.tempPath);
      } catch (e2) {
        res.status(500).json({ error: "move failed" });
        return;
      }
    }
    sessions.delete(uploadId);
    const relPath = path.relative(ownerRoot, finalPath);
    const pathSlash = "/" + relPath.split(path.sep).join("/");
    res.json({
      success: true,
      path: pathSlash,
      size: session.totalSize,
    });
  }));

  const statusPaths = ["/api/v2/upload/status/:uploadId", "/transfer/status/:uploadId", "/transfer/status/:transferId"];
  statusPaths.forEach((routePath) => app.get(routePath, (req, res) => {
    const access = getAccess(req);
    if (!access || access.can_upload === false) {
      res.status(403).json({ error: "upload_denied" });
      return;
    }
    const uploadId = req.params.uploadId || req.params.transferId;
    const session = sessions.get(uploadId);
    if (!session) {
      res.status(404).json({ error: "upload session not found" });
      return;
    }
    const totalChunks = session.totalChunks;
    const uploadedChunks = session.uploadedChunks;
    const percentComplete = totalChunks ? (uploadedChunks.length / totalChunks) * 100 : 0;
    res.json({
      uploadId,
      transferId: uploadId,
      totalChunks,
      uploadedChunks: [...uploadedChunks],
      receivedChunks: [...uploadedChunks],
      percentComplete: Math.round(percentComplete * 10) / 10,
      expiresAt: session.expiresAt,
    });
  }));

  app.get("/api/v1/transfer/active", (req, res) => {
    const access = getAccess(req);
    if (!access || access.can_upload === false) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const transfers = [];
    for (const [id, s] of sessions.entries()) {
      const totalChunks = s.totalChunks;
      const uploadedChunks = s.uploadedChunks;
      const chunksReceived = uploadedChunks.length;
      const percentComplete = totalChunks ? (chunksReceived / totalChunks) * 100 : 0;
      transfers.push({
        transferId: id,
        fileName: s.fileName,
        totalBytes: s.totalSize,
        totalChunks,
        chunksReceived,
        percentComplete: Math.round(percentComplete * 10) / 10,
      });
    }
    res.json({ transfers });
  });
}

module.exports = { registerChunkUploadRoutes };
