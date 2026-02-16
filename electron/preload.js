const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("joincloud", {
  openStorageFolder: () => ipcRenderer.invoke("joincloud-open-storage"),
  selectFiles: () => ipcRenderer.invoke("joincloud-select-files"),
  quitApp: () => ipcRenderer.invoke("joincloud-quit-app"),
});
