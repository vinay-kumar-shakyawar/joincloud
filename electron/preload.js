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
