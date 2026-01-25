/**
 * Type definitions for Electron API exposed via contextBridge
 */

export interface ElectronStorageAPI {
  getBasePath: () => Promise<string>;
  getFiles: () => Promise<any[]>;
  createFolder: (params: { name: string; parentPath?: string }) => Promise<any>;
  uploadFiles: (params: { 
    files: Array<{ name: string; data: string; type: string }>; 
    parentPath?: string 
  }) => Promise<any>;
  deleteFile: (fileId: string) => Promise<any>;
  renameFile: (params: { fileId: string; newName: string }) => Promise<any>;
  getFilePath: (fileId: string) => Promise<string>;
  getStats: () => Promise<any>;
  openFile: (fileId: string) => Promise<{ success: boolean }>;
  showInFinder: (fileId: string) => Promise<{ success: boolean }>;
  refreshFiles: () => Promise<any[]>;
}

export interface ElectronAPI {
  storage: ElectronStorageAPI;
  
  // Legacy system file browser
  getSystemDirs: () => Promise<any>;
  readDirectory: (dirPath: string) => Promise<any>;
  selectFolder: () => Promise<string | null>;
  selectFile: () => Promise<string[] | null>;
  getFileInfo: (filePath: string) => Promise<any>;
  showInFolder: (filePath: string) => Promise<void>;
  copyPath: (filePath: string) => Promise<boolean>;
  
  // File sharing
  createShareLink: (filePath: string, expirationMinutes?: number) => Promise<any>;
  getSharedFiles: () => Promise<any[]>;
  revokeShare: (shareId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electron: {
      platform: string;
    };
    electronAPI: ElectronAPI;
  }
}

export {};
