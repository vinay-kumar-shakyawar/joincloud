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
  onLicenseUpdated: (callback) => {
    console.log("[preload] onLicenseUpdated callback registered");
    ipcRenderer.on("license-updated", () => {
      console.log("[preload] license-updated firing callback");
      if (typeof callback === "function") callback();
    });
  },
});
