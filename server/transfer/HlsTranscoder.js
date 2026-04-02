"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");

let ffmpeg;
try {
  ffmpeg = require("fluent-ffmpeg");
  const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
} catch (_e) {
  ffmpeg = null;
}

const SEGMENT_DURATION = 2; // seconds per HLS segment (short for fast first-play)
const CACHE_BASE = path.join(os.tmpdir(), "joincloud-hls");
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

// Map<jobKey, JobState>
const activeJobs = new Map();

/**
 * JobState shape:
 * {
 *   filePath,
 *   probe: null | { duration, width, height },
 *   qualities: [{ name, scale, vbr, abr, ready, progress, error }],
 *   startedAt,
 *   error: null | string
 * }
 */

function getJobKey(shareId, filePath) {
  return crypto.createHash("md5").update(shareId + ":" + filePath).digest("hex");
}

function getCacheDir(jobKey, quality) {
  return path.join(CACHE_BASE, jobKey, quality);
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    if (!ffmpeg) return reject(new Error("ffmpeg not available"));
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = (metadata.streams || []).find((s) => s.codec_type === "video");
      resolve({
        duration: parseFloat(metadata.format.duration) || 0,
        width: videoStream ? (videoStream.width || 0) : 0,
        height: videoStream ? (videoStream.height || 0) : 0,
      });
    });
  });
}

function getQualityLevels(probe) {
  const h = probe.height || 0;
  const levels = [];
  // Always include 360p — with even lower bitrate for faster encoding
  levels.push({ name: "360p", scale: "640:360", vbr: "600k", abr: "96k", bandwidth: 696000 });
  if (h >= 480) {
    levels.push({ name: "480p", scale: "854:480", vbr: "1000k", abr: "128k", bandwidth: 1128000 });
  }
  if (h >= 720) {
    levels.push({ name: "720p", scale: "1280:720", vbr: "1800k", abr: "128k", bandwidth: 1928000 });
  }
  if (h >= 1080) {
    levels.push({ name: "1080p", scale: "1920:1080", vbr: "3500k", abr: "192k", bandwidth: 3692000 });
  }
  return levels;
}

function watchForPartialReady(cacheDir, q) {
  const MIN_SEGMENTS = 2; // 2 × 2s = 4s minimum buffer before HLS.js can start
  return new Promise((resolve) => {
    if (q.partialReady || q.ready) { resolve(); return; }
    let attempts = 0;
    const segName = "seg" + String(MIN_SEGMENTS - 1).padStart(4, "0") + ".ts";
    const check = async () => {
      if (q.partialReady || q.ready) { resolve(); return; }
      try {
        await fsp.access(path.join(cacheDir, segName));
        q.partialReady = true;
        console.log("[HLS] Partial ready:", q.name);
        resolve();
      } catch (_) {
        if (attempts++ < 150) setTimeout(check, 800); // poll every 800ms, max ~2min
        else resolve(); // give up
      }
    };
    check();
  });
}

function buildMasterPlaylist(jobKey, qualities) {
  const readyLevels = qualities.filter((q) => q.ready || q.partialReady);
  let m3u8 = "#EXTM3U\n#EXT-X-VERSION:3\n";
  readyLevels.forEach((q) => {
    m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${q.bandwidth},RESOLUTION=${q.scale.replace(":", "x")},NAME="${q.name}"\n`;
    m3u8 += `${q.name}/index.m3u8\n`;
  });
  return m3u8;
}

function transcodeQuality(filePath, quality, cacheDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const playlistPath = path.join(cacheDir, "index.m3u8");
    // Use forward slashes for ffmpeg compatibility
    const segmentPattern = path.join(cacheDir, "seg%04d.ts").replace(/\\/g, "/");

    const cmd = ffmpeg(filePath)
      .outputOptions([
        "-profile:v baseline",
        "-level 3.0",
        "-c:v libx264",
        "-c:a aac",
        "-b:v " + quality.vbr,
        "-maxrate " + quality.vbr,
        "-bufsize " + (parseInt(quality.vbr) * 2) + "k",
        "-b:a " + quality.abr,
        "-vf scale=" + quality.scale + ":force_original_aspect_ratio=decrease,pad=" + quality.scale + ":(ow-iw)/2:(oh-ih)/2",
        "-hls_time " + SEGMENT_DURATION,
        "-hls_list_size 0",
        "-hls_segment_filename " + segmentPattern,
        "-preset fast",  // Speed up encoding
        "-f hls",
      ])
      .output(playlistPath);

    let lastProgress = 0;
    cmd.on("progress", (progress) => {
      if (progress.percent) {
        quality.progress = Math.min(99, progress.percent);
        if (quality.progress - lastProgress > 5) {  // Log every 5%
          console.log(`[HLS] ${quality.name}: ${Math.round(quality.progress)}%`);
          lastProgress = quality.progress;
        }
      }
    });
    cmd.on("end", () => {
      quality.progress = 100;
      quality.ready = true;
      console.log("[HLS] Transcode finished:", quality.name);
      resolve(playlistPath);
    });
    cmd.on("error", (err) => {
      console.error("[HLS] ffmpeg error for", quality.name, ":", err.message);
      quality.error = err.message;
      reject(err);
    });
    cmd.on("stderr", (line) => {
      if (line && line.includes("error") && quality.error == null) {
        console.log("[HLS] ffmpeg stderr:", line);
      }
    });
    cmd.run();
  });
}

async function cleanOldCache() {
  try {
    await fsp.mkdir(CACHE_BASE, { recursive: true });
    const entries = await fsp.readdir(CACHE_BASE, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const stat = await fsp.stat(path.join(CACHE_BASE, entry.name));
        if (now - stat.mtimeMs > CACHE_MAX_AGE_MS) {
          await fsp.rm(path.join(CACHE_BASE, entry.name), { recursive: true, force: true });
        }
      } catch (_) {}
    }
  } catch (_) {}
}

// Kick off initial cleanup on load
cleanOldCache();

async function getOrStartJob(shareId, filePath) {
  if (!ffmpeg) {
    return { status: "unavailable", qualities: [], lowestReady: null, error: "ffmpeg not installed" };
  }
  const jobKey = getJobKey(shareId, filePath);

  if (activeJobs.has(jobKey)) {
    return getStatusFromJob(jobKey);
  }

  // Check if cache already exists (from a previous run)
  const jobState = {
    filePath,
    probe: null,
    qualities: [],
    startedAt: Date.now(),
    error: null,
  };
  activeJobs.set(jobKey, jobState);

  // Run probe + transcode asynchronously — return immediately with pending status
  (async () => {
    try {
      console.log("[HLS] Starting probe for", filePath);
      jobState.probe = await probeVideo(filePath);
      console.log("[HLS] Probe complete:", jobState.probe);
      const qualityLevels = getQualityLevels(jobState.probe);
      jobState.qualities = qualityLevels.map((q) => ({
        ...q,
        ready: false,
        progress: 0,
        error: null,
      }));

      // Check cache for each quality level before transcoding
      for (const q of jobState.qualities) {
        const cacheDir = getCacheDir(jobKey, q.name);
        const playlistPath = path.join(cacheDir, "index.m3u8");
        try {
          await fsp.access(playlistPath);
          console.log("[HLS] Cache hit for", q.name);
          q.ready = true;
          q.partialReady = true;
          q.progress = 100;
        } catch (_) {
          // Not cached — transcode now; run partial-ready watcher concurrently
          console.log("[HLS] Starting transcode for", q.name);
          const watcher = watchForPartialReady(cacheDir, q);
          try {
            await transcodeQuality(filePath, q, cacheDir);
            console.log("[HLS] Transcode complete for", q.name);
          } catch (err) {
            console.error("[HLS] Transcode failed for", q.name, err.message);
            q.error = err.message;
          }
          await watcher; // settle watcher (usually already resolved)
        }
      }
    } catch (err) {
      console.error("[HLS] Job error:", err.message);
      jobState.error = err.message;
    }
  })();

  return { status: "pending", qualities: [], lowestReady: null };
}

function getStatusFromJob(jobKey) {
  const job = activeJobs.get(jobKey);
  if (!job) return { status: "not_found", qualities: [], lowestReady: null };

  const qualitySummary = (job.qualities || []).map((q) => ({
    name: q.name,
    ready: q.ready,
    partialReady: q.partialReady || false,
    progress: q.progress || 0,
    error: q.error || null,
  }));

  const lowestPartialReady = (job.qualities || []).find((q) => q.partialReady || q.ready);
  const lowestReady = (job.qualities || []).find((q) => q.ready);
  const allReady = job.qualities.length > 0 && job.qualities.every((q) => q.ready || q.error);

  return {
    status: job.error ? "error" : allReady ? "ready" : "pending",
    qualities: qualitySummary,
    lowestPartialReady: lowestPartialReady ? lowestPartialReady.name : null,
    lowestReady: lowestReady ? lowestReady.name : null,
    error: job.error || null,
  };
}

function getStatus(shareId, filePath) {
  if (!ffmpeg) return { status: "unavailable", qualities: [], lowestReady: null };
  const jobKey = getJobKey(shareId, filePath);
  if (!activeJobs.has(jobKey)) return { status: "not_started", qualities: [], lowestReady: null };
  return getStatusFromJob(jobKey);
}

function getMasterPlaylist(shareId, filePath) {
  if (!ffmpeg) return null;
  const jobKey = getJobKey(shareId, filePath);
  const job = activeJobs.get(jobKey);
  if (!job) return null;
  return buildMasterPlaylist(jobKey, job.qualities || []);
}

function getQualityPlaylistPath(shareId, filePath, quality) {
  const jobKey = getJobKey(shareId, filePath);
  return path.join(getCacheDir(jobKey, quality), "index.m3u8");
}

function getSegmentPath(shareId, filePath, quality, segName) {
  const jobKey = getJobKey(shareId, filePath);
  return path.join(getCacheDir(jobKey, quality), segName);
}

function isAvailable() {
  return ffmpeg !== null;
}

module.exports = {
  getOrStartJob,
  getStatus,
  getMasterPlaylist,
  getQualityPlaylistPath,
  getSegmentPath,
  isAvailable,
};
