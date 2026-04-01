const https = require("https");
const http = require("http");
const { URL } = require("url");
const electron = require("electron");
const { filterVersions } = require("./filterVersions");
const semver = require("semver");
const fs = require("fs");
const path = require("path");

function getVersionsUrl() {
  const envUrl = process.env.JOINCLOUD_VERSIONS_URL;
  if (envUrl && String(envUrl).trim()) return String(envUrl).trim();

  // If the backend has fetched control-plane config, it persists updates.versions_url here.
  try {
    const { app } = electron;
    const userData = app.getPath("userData");
    const cfgPath = path.join(userData, "JoinCloud", "system", "update_config.json");
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf8");
      const parsed = JSON.parse(raw);
      const u = parsed && typeof parsed.versions_url === "string" ? parsed.versions_url.trim() : "";
      if (u) return u;
    }
  } catch (_) {}

  return "https://raw.githubusercontent.com/joincloud/joincloud/main/releases/versions.json";
}

function fetchVersionsFromUrl(urlString) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      reject(new Error("Invalid versions URL"));
      return;
    }
    const transport = url.protocol === "http:" ? http : https;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "http:" ? 80 : 443),
      path: url.pathname + url.search,
      method: "GET",
      headers: { "User-Agent": "JoinCloud-updater" },
    };
    const req = transport.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchVersionsFromUrl(new URL(res.headers.location, urlString).href).then(resolve).catch(reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`versions.json HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (d) => {
        raw += d;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          resolve(parsed);
        } catch (err) {
          reject(new Error("Invalid versions.json"));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchVersionsArray() {
  const data = await fetchVersionsFromUrl(getVersionsUrl());
  if (!Array.isArray(data)) {
    throw new Error("versions.json must be an array");
  }
  return data;
}

function registerVersionCatalogHandlers() {
  const { ipcMain, app } = electron;

  ipcMain.handle("versions:fetch", async () => {
    return fetchVersionsArray();
  });

  ipcMain.handle("versions:buckets", async () => {
    const all = await fetchVersionsArray();
    const valid = all.filter((e) => e && semver.valid(e.version));
    const sorted = valid.sort((a, b) => semver.rcompare(a.version, b.version));
    // versions.json may contain duplicate entries; dedupe by version for stable UI buckets
    const seen = new Set();
    const deduped = [];
    for (const v of sorted) {
      const raw = v && typeof v.version === "string" ? v.version : "";
      const ver = semver.valid(raw);
      if (!ver) continue;
      if (seen.has(ver)) continue;
      seen.add(ver);
      deduped.push({ ...v, version: ver });
    }
    const currentVersion = app.getVersion();
    return filterVersions(deduped, currentVersion);
  });
}

registerVersionCatalogHandlers();

module.exports = {
  registerVersionCatalogHandlers,
  getVersionsUrl,
  fetchVersionsArray,
};
