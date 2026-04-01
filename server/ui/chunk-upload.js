/**
 * Resumable chunked upload (POST /transfer/init, PUT /transfer/chunk, POST /transfer/complete).
 * Mirrors client/src/lib/chunk-upload.ts — 2 MiB chunks.
 */
(function (global) {
  "use strict";

  var SERVER_CHUNK_SIZE = 2 * 1024 * 1024;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function ChunkUploadController() {
    this.paused = false;
    this.cancelled = false;
    this.abortController = null;
  }

  ChunkUploadController.prototype.pause = function () {
    this.paused = true;
    try {
      if (this.abortController) this.abortController.abort();
    } catch (_e) {}
  };

  ChunkUploadController.prototype.resume = function () {
    this.paused = false;
  };

  ChunkUploadController.prototype.cancel = function () {
    this.cancelled = true;
    this.paused = false;
    try {
      if (this.abortController) this.abortController.abort();
    } catch (_e) {}
  };

  ChunkUploadController.prototype.isCancelled = function () {
    return this.cancelled;
  };

  ChunkUploadController.prototype.isPaused = function () {
    return this.paused;
  };

  ChunkUploadController.prototype.waitWhilePaused = async function () {
    while (this.paused && !this.cancelled) {
      await sleep(50);
    }
  };

  /**
   * @param {File} file
   * @param {string} targetPath owner-relative directory (e.g. "/" or "/folder")
   * @param {{ request?: function, onProgress?: function, signal?: AbortSignal }} options
   * request(url, init) must return Promise<Response> (e.g. apiFetch wrapper)
   */
  ChunkUploadController.prototype.upload = async function (file, targetPath, options) {
    options = options || {};
    var request = options.request || fetch.bind(global);
    var onProgress = options.onProgress;
    var outerSignal = options.signal;

    if (outerSignal && outerSignal.aborted) {
      throw new Error("Upload aborted");
    }

    var safeTarget = String(targetPath || "/").replace(/\.\./g, "").trim() || "/";
    var totalSize = file.size;
    var totalChunks = totalSize === 0 ? 0 : Math.ceil(totalSize / SERVER_CHUNK_SIZE);

    var initRes = await request("/transfer/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        totalSize: totalSize,
        totalChunks: totalChunks,
        targetPath: safeTarget,
        mimeType: file.type || undefined,
      }),
      signal: outerSignal,
    });

    if (!initRes.ok) {
      var t = await initRes.text();
      throw new Error(t || "Init failed (" + initRes.status + ")");
    }

    var init = await initRes.json();
    var uploadId = init.uploadId || init.transferId;
    if (!uploadId) {
      throw new Error("No upload id from server");
    }

    var chunkSize = Number(init.chunkSize) || SERVER_CHUNK_SIZE;
    var serverTotalChunks = Number(init.totalChunks) || totalChunks;
    var uploaded = new Set((init.uploadedChunks || init.alreadyReceived || []).map(Number));

    var refreshStatus = async function () {
      var st = await request("/transfer/status/" + encodeURIComponent(uploadId), { method: "GET" });
      if (!st.ok) return;
      var j = await st.json();
      var list = j.uploadedChunks || j.receivedChunks || [];
      uploaded = new Set(list.map(Number));
    };

    var bytesFromSet = uploaded.size * chunkSize;
    var bytesSent = Math.min(bytesFromSet, totalSize);
    var startedAt = Date.now();
    var lastTick = startedAt;
    var lastBytes = bytesSent;

    var emitProgress = function (chunkIndex, doneBytes) {
      var now = Date.now();
      var dt = Math.max((now - lastTick) / 1000, 0.001);
      var db = doneBytes - lastBytes;
      lastTick = now;
      lastBytes = doneBytes;
      var speedBps = db / dt;
      var remaining = Math.max(0, totalSize - doneBytes);
      var etaSeconds = speedBps > 0 ? remaining / speedBps : 0;
      var percent = totalSize > 0 ? Math.min(100, (doneBytes / totalSize) * 100) : 100;
      if (onProgress) {
        onProgress({
          percent: percent,
          bytesSent: doneBytes,
          totalBytes: totalSize,
          chunkIndex: chunkIndex,
          totalChunks: serverTotalChunks,
          speedBps: speedBps,
          etaSeconds: etaSeconds,
        });
      }
    };

    emitProgress(0, bytesSent);

    for (var idx = 0; idx < serverTotalChunks; idx++) {
      if (this.cancelled || (outerSignal && outerSignal.aborted)) {
        throw new Error("Upload cancelled");
      }

      await this.waitWhilePaused();
      if (this.cancelled || (outerSignal && outerSignal.aborted)) {
        throw new Error("Upload cancelled");
      }
      await refreshStatus();

      if (uploaded.has(idx)) {
        var doneSkip = Math.min((idx + 1) * chunkSize, totalSize);
        emitProgress(idx, doneSkip);
        continue;
      }

      var start = idx * chunkSize;
      var end = Math.min(start + chunkSize, totalSize) - 1;
      var blob = file.slice(start, end + 1);

      var putRes;
      var chunkSkipped = false;
      for (;;) {
        if (this.cancelled || (outerSignal && outerSignal.aborted)) {
          throw new Error("Upload cancelled");
        }
        this.abortController = new AbortController();
        try {
          putRes = await request("/transfer/chunk", {
            method: "PUT",
            headers: {
              "X-Upload-Id": uploadId,
              "X-Chunk-Index": String(idx),
              "X-Transfer-Id": uploadId,
              "Content-Type": "application/octet-stream",
            },
            body: blob,
            signal: this.abortController.signal,
          });
          break;
        } catch (e) {
          var name = e && e.name ? e.name : "";
          if (name === "AbortError" && this.paused && !this.cancelled) {
            await this.waitWhilePaused();
            await refreshStatus();
            if (uploaded.has(idx)) {
              chunkSkipped = true;
              break;
            }
            continue;
          }
          throw e;
        }
      }

      if (chunkSkipped) {
        var doneCh = Math.min((idx + 1) * chunkSize, totalSize);
        emitProgress(idx, doneCh);
        continue;
      }

      if (!putRes || !putRes.ok) {
        var errText = await putRes.text();
        if (this.cancelled) throw new Error("Upload cancelled");
        throw new Error(errText || "Chunk " + idx + " failed (" + putRes.status + ")");
      }

      var chunkJson = await putRes.json();
      uploaded = new Set(chunkJson.uploadedChunks || []);

      var doneChunkEnd = Math.min((idx + 1) * chunkSize, totalSize);
      emitProgress(idx, doneChunkEnd);

      if (this.paused) {
        await this.waitWhilePaused();
      }
    }

    if (this.cancelled || (outerSignal && outerSignal.aborted)) {
      throw new Error("Upload cancelled");
    }

    var completeRes = await request("/transfer/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: uploadId, fileName: file.name }),
      signal: outerSignal,
    });

    if (!completeRes.ok) {
      var ct = await completeRes.text();
      throw new Error(ct || "Complete failed (" + completeRes.status + ")");
    }

    var result = await completeRes.json();
    if (onProgress) {
      onProgress({
        percent: 100,
        bytesSent: totalSize,
        totalBytes: totalSize,
        chunkIndex: Math.max(0, serverTotalChunks - 1),
        totalChunks: serverTotalChunks,
        speedBps: 0,
        etaSeconds: 0,
      });
    }

    return { path: result.path || "/", size: result.size != null ? result.size : totalSize };
  };

  global.ChunkUploadController = ChunkUploadController;
})(typeof window !== "undefined" ? window : globalThis);
