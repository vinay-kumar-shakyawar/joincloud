/**
 * Resumable chunked upload to JoinCloud server (/transfer/init, PUT /transfer/chunk, /transfer/complete).
 * Matches server CHUNK_SIZE in chunkUploadManager.js (2 MiB).
 */

const SERVER_CHUNK_SIZE = 2 * 1024 * 1024;

export interface ChunkUploadProgress {
  percent: number;
  bytesSent: number;
  totalBytes: number;
  chunkIndex: number;
  totalChunks: number;
  speedBps: number;
  etaSeconds: number;
}

export interface ChunkUploadOptions {
  baseUrl?: string;
  credentials?: RequestCredentials;
  onProgress?: (p: ChunkUploadProgress) => void;
  /** Called when waiting after pause; throw or return false to cancel */
  signal?: AbortSignal;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class ChunkUploadController {
  private paused = false;
  private cancelled = false;
  private abortController: AbortController | null = null;

  pause() {
    this.paused = true;
    try {
      this.abortController?.abort();
    } catch {
      /* ignore */
    }
  }

  resume() {
    this.paused = false;
  }

  cancel() {
    this.cancelled = true;
    this.paused = false;
    try {
      this.abortController?.abort();
    } catch {
      /* ignore */
    }
  }

  isCancelled() {
    return this.cancelled;
  }

  isPaused() {
    return this.paused;
  }

  private async waitWhilePaused() {
    while (this.paused && !this.cancelled) {
      await sleep(50);
    }
  }

  /**
   * Upload a single file with chunking. targetPath is owner-relative (e.g. "/" or "folder/sub").
   */
  async upload(
    file: File,
    targetPath: string,
    options: ChunkUploadOptions = {}
  ): Promise<{ path: string; size: number }> {
    const base = (options.baseUrl ?? "").replace(/\/$/, "");
    const creds = options.credentials ?? "include";
    const onProgress = options.onProgress;

    if (options.signal?.aborted) {
      throw new Error("Upload aborted");
    }

    const safeTarget = targetPath.replace(/\.\./g, "").trim() || "/";
    const totalSize = file.size;
    const totalChunks = totalSize === 0 ? 0 : Math.ceil(totalSize / SERVER_CHUNK_SIZE);

    const initRes = await fetch(`${base}/transfer/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: creds,
      body: JSON.stringify({
        fileName: file.name,
        totalSize,
        totalChunks,
        targetPath: safeTarget,
        mimeType: file.type || undefined,
      }),
      signal: options.signal,
    });

    if (!initRes.ok) {
      const t = await initRes.text();
      throw new Error(t || `Init failed (${initRes.status})`);
    }

    const init = await initRes.json();
    const uploadId = init.uploadId || init.transferId;
    if (!uploadId) {
      throw new Error("No upload id from server");
    }

    const chunkSize = Number(init.chunkSize) || SERVER_CHUNK_SIZE;
    const serverTotalChunks = Number(init.totalChunks) || totalChunks;
    let uploaded = new Set<number>((init.uploadedChunks || init.alreadyReceived || []) as number[]);

    const refreshStatus = async () => {
      const st = await fetch(`${base}/transfer/status/${uploadId}`, { credentials: creds });
      if (!st.ok) return;
      const j = await st.json();
      const list = (j.uploadedChunks || j.receivedChunks || []) as number[];
      uploaded = new Set(list);
    };

    let bytesSent = uploaded.size * chunkSize;
    bytesSent = Math.min(bytesSent, totalSize);
    const startedAt = Date.now();
    let lastTick = startedAt;
    let lastBytes = bytesSent;

    const emitProgress = (chunkIndex: number, doneBytes: number) => {
      const now = Date.now();
      const dt = Math.max((now - lastTick) / 1000, 0.001);
      const db = doneBytes - lastBytes;
      lastTick = now;
      lastBytes = doneBytes;
      const speedBps = db / dt;
      const remaining = Math.max(0, totalSize - doneBytes);
      const etaSeconds = speedBps > 0 ? remaining / speedBps : 0;
      const percent = totalSize > 0 ? Math.min(100, (doneBytes / totalSize) * 100) : 100;
      onProgress?.({
        percent,
        bytesSent: doneBytes,
        totalBytes: totalSize,
        chunkIndex,
        totalChunks: serverTotalChunks,
        speedBps,
        etaSeconds,
      });
    };

    emitProgress(0, bytesSent);

    for (let idx = 0; idx < serverTotalChunks; idx++) {
      if (this.cancelled || options.signal?.aborted) {
        throw new Error("Upload cancelled");
      }

      await this.waitWhilePaused();
      if (this.cancelled || options.signal?.aborted) {
        throw new Error("Upload cancelled");
      }
      await refreshStatus();

      if (uploaded.has(idx)) {
        const doneChunkEnd = Math.min((idx + 1) * chunkSize, totalSize);
        emitProgress(idx, doneChunkEnd);
        continue;
      }

      const start = idx * chunkSize;
      const end = Math.min(start + chunkSize, totalSize) - 1;
      const blob = file.slice(start, end + 1);

      let putRes: Response | undefined;
      let chunkSkipped = false;
      for (;;) {
        if (this.cancelled || options.signal?.aborted) {
          throw new Error("Upload cancelled");
        }
        this.abortController = new AbortController();
        try {
          putRes = await fetch(`${base}/transfer/chunk`, {
            method: "PUT",
            headers: {
              "X-Upload-Id": uploadId,
              "X-Chunk-Index": String(idx),
              "X-Transfer-Id": uploadId,
              "Content-Type": "application/octet-stream",
            },
            credentials: creds,
            body: blob,
            signal: this.abortController.signal,
          });
          break;
        } catch (e: unknown) {
          const name = e && typeof e === "object" && "name" in e ? (e as Error).name : "";
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
        const doneChunkEnd = Math.min((idx + 1) * chunkSize, totalSize);
        emitProgress(idx, doneChunkEnd);
        continue;
      }

      if (!putRes || !putRes.ok) {
        const t = await putRes.text();
        if (this.cancelled) throw new Error("Upload cancelled");
        throw new Error(t || `Chunk ${idx} failed (${putRes.status})`);
      }

      const chunkJson = await putRes.json();
      uploaded = new Set(chunkJson.uploadedChunks || []);

      const doneChunkEnd = Math.min((idx + 1) * chunkSize, totalSize);
      emitProgress(idx, doneChunkEnd);

      if (this.paused) {
        await this.waitWhilePaused();
      }
    }

    if (this.cancelled || options.signal?.aborted) {
      throw new Error("Upload cancelled");
    }

    const completeRes = await fetch(`${base}/transfer/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: creds,
      body: JSON.stringify({ uploadId, fileName: file.name }),
      signal: options.signal,
    });

    if (!completeRes.ok) {
      const t = await completeRes.text();
      throw new Error(t || `Complete failed (${completeRes.status})`);
    }

    const result = await completeRes.json();
    onProgress?.({
      percent: 100,
      bytesSent: totalSize,
      totalBytes: totalSize,
      chunkIndex: serverTotalChunks - 1,
      totalChunks: serverTotalChunks,
      speedBps: 0,
      etaSeconds: 0,
    });

    return { path: result.path || "/", size: result.size ?? totalSize };
  }
}
