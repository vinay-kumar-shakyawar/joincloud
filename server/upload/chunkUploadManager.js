"use strict";

const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const { v4: uuidv4 } = require("uuid");

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

function registerChunkUploadRoutes(app, config) {
  const ownerRoot = config.storage.ownerRoot || process.cwd();
  const tmpDir = path.join(ownerRoot, ".uploads-tmp");
  ensureUploadsTmpDir(tmpDir);

  setInterval(cleanupStale, CLEANUP_INTERVAL_MS);

  app.post("/api/v2/upload/init", async (req, res) => {
    const { fileName, totalSize, totalChunks, targetPath, mimeType } = req.body || {};
    if (!fileName || totalSize == null) {
      res.status(400).json({ error: "fileName and totalSize required" });
      return;
    }
    const uploadId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const tempPath = path.join(tmpDir, `${uploadId}.part`);
    const safeTarget = (targetPath || "/").replace(/\.\./g, "").trim() || "/";
    const totalSizeNum = Number(totalSize);
    const totalChunksNum = Number(totalChunks) || Math.ceil(totalSizeNum / CHUNK_SIZE);
    sessions.set(uploadId, {
      uploadId,
      fileName: String(fileName),
      totalSize: totalSizeNum,
      totalChunks: totalChunksNum,
      targetPath: safeTarget,
      mimeType: mimeType || null,
      tempPath,
      uploadedChunks: [],
      createdAt: Date.now(),
      expiresAt,
    });
    try {
      const fd = await fs.open(tempPath, "w");
      if (totalSizeNum > 0) await fd.truncate(totalSizeNum);
      await fd.close();
    } catch (e) {
      sessions.delete(uploadId);
      res.status(500).json({ error: "could not create temp file" });
      return;
    }
    res.json({
      uploadId,
      chunkSize: CHUNK_SIZE,
      uploadedChunks: [],
      expiresAt,
    });
  });

  app.put("/api/v2/upload/chunk", async (req, res) => {
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
  });

  app.post("/api/v2/upload/complete", async (req, res) => {
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
    const resolvedDir = path.resolve(ownerRoot, session.targetPath.replace(/^\/+/, "").replace(/\.\./g, ""));
    if (!resolvedDir.startsWith(path.resolve(ownerRoot))) {
      res.status(400).json({ error: "invalid target path" });
      return;
    }
    await fs.mkdir(path.dirname(resolvedDir), { recursive: true }).catch(() => {});
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
  });

  app.get("/api/v2/upload/status/:uploadId", (req, res) => {
    const { uploadId } = req.params;
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
      totalChunks,
      uploadedChunks: [...uploadedChunks],
      percentComplete: Math.round(percentComplete * 10) / 10,
      expiresAt: session.expiresAt,
    });
  });
}

module.exports = { registerChunkUploadRoutes };
