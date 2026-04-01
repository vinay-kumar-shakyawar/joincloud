const { contextBridge, ipcRenderer } = require("electron");

ipcRenderer.on("license-updated", () => {
  console.log("[preload] license-updated IPC received from main process");
});

contextBridge.exposeInMainWorld("joincloud", {
  openStorageFolder: () => ipcRenderer.invoke("joincloud-open-storage"),
  selectFiles: () => ipcRenderer.invoke("joincloud-select-files"),
  quitApp: () => ipcRenderer.invoke("joincloud-quit-app"),
  openAuthModal: (url) => ipcRenderer.invoke("joincloud-open-auth-modal", url),
  closeAuthModal: () => ipcRenderer.invoke("joincloud-close-auth-modal"),
  checkInternet: () => ipcRenderer.invoke("joincloud-check-internet"),
  onShareProgress: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("share-progress", handler);
    return () => {
      ipcRenderer.removeListener("share-progress", handler);
    };
  },
  onSystemResume: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = () => callback();
    ipcRenderer.on("system-resume", handler);
    return () => ipcRenderer.removeListener("system-resume", handler);
  },
  onSystemSuspend: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = () => callback();
    ipcRenderer.on("system-suspend", handler);
    return () => ipcRenderer.removeListener("system-suspend", handler);
  },
  onLicenseUpdated: (callback) => {
    console.log("[preload] onLicenseUpdated callback registered");
    ipcRenderer.on("license-updated", () => {
      console.log("[preload] license-updated firing callback");
      if (typeof callback === "function") callback();
    });
  },
});

// ─── Support real-time helpers (SSE-based, no Electron IPC needed) ──────────
// The React frontend connects directly to the embedded server's SSE endpoint.
// These constants are exposed so React components can reference the correct URL.
contextBridge.exposeInMainWorld("joincloudRealtime", {
  /** URL of the SSE stream for real-time support / plan events */
  sseUrl: "http://127.0.0.1:8787/api/sse/events",
  /** POST endpoint to send a support message */
  supportSendUrl: "http://127.0.0.1:8787/api/support/send",
  /** POST endpoint to report typing indicator */
  supportTypingUrl: "http://127.0.0.1:8787/api/support/typing",
});

contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: () => ipcRenderer.send("update:check"),
  downloadUpdate: () => ipcRenderer.send("update:download"),
  installUpdate: () => ipcRenderer.send("update:install"),
  getAppVersion: () => ipcRenderer.sendSync("get-app-version"),
  fetchVersions: () => ipcRenderer.invoke("versions:fetch"),
  getVersionBuckets: () => ipcRenderer.invoke("versions:buckets"),
  installVersion: (versionObj) => ipcRenderer.invoke("versions:install", versionObj),
  onUpdateAvailable: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },
  onDownloadProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
  onUpdateDownloaded: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:ready", handler);
    return () => ipcRenderer.removeListener("update:ready", handler);
  },
  onUpdateError: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update:error", handler);
    return () => ipcRenderer.removeListener("update:error", handler);
  },
  onUpdateNone: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = () => callback();
    ipcRenderer.on("update:none", handler);
    return () => ipcRenderer.removeListener("update:none", handler);
  },
  onVersionProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("version:progress", handler);
    return () => ipcRenderer.removeListener("version:progress", handler);
  },
});
