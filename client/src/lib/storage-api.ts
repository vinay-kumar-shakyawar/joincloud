/**
 * Storage API Abstraction Layer
 * 
 * This module provides a unified API for filesystem operations that works in both:
 * 1. Electron (via IPC to main main-IPC) - LOCAL-FIRST
 * 2. Browser/Dev (via fetch to Express server) - DEVELOPMENT ONLY
 * 
 * In production Electron builds, all operations use IPC for direct filesystem access.
 */

// Type definitions
export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  virtualPath: string;
  parentPath: string;
  size: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  totalSize: number;
  fileCount: number;
  folderCount: number;
  usedPercentage: number;
}

export interface CreateFolderParams {
  name: string;
  parentPath?: string;
}

export interface UploadFilesParams {
  files: Array<{
    name: string;
    data: string; // base64
    type: string;
  }>;
  parentPath?: string;
}

export interface RenameFileParams {
  fileId: string;
  newName: string;
}

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         window.electronAPI.storage;
};

// ============================================================================
// STORAGE API - AUTO-SELECTS ELECTRON IPC OR HTTP FALLBACK
// ============================================================================

export const StorageAPI = {
  /**
   * Get all files and folders
   */
  async getFiles(): Promise<FileItem[]> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for getFiles');
      return window.electronAPI.storage.getFiles();
    } else {
      console.log('[storage-api] Using HTTP fetch for getFiles');
      const res = await fetch('/api/files', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Create a new folder
   */
  async createFolder(params: CreateFolderParams): Promise<{ success: boolean; folder: FileItem }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for createFolder:', params.name);
      return window.electronAPI.storage.createFolder(params);
    } else {
      console.log('[storage-api] Using HTTP fetch for createFolder:', params.name);
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Upload files
   */
  async uploadFiles(files: File[], parentPath: string = '/'): Promise<{ success: boolean; files: FileItem[] }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for uploadFiles:', files.length, 'files');
      
      // Convert File objects to base64
      const fileDataPromises = files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        return {
          name: file.name,
          data: base64,
          type: file.type,
        };
      });
      
      const fileData = await Promise.all(fileDataPromises);
      
      return window.electronAPI.storage.uploadFiles({
        files: fileData,
        parentPath,
      });
    } else {
      console.log('[storage-api] Using HTTP fetch for uploadFiles:', files.length, 'files');
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('parentPath', parentPath);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Delete a file or folder
   */
  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for deleteFile:', fileId);
      return window.electronAPI.storage.deleteFile(fileId);
    } else {
      console.log('[storage-api] Using HTTP fetch for deleteFile:', fileId);
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Rename a file or folder
   */
  async renameFile(params: RenameFileParams): Promise<{ success: boolean; file: FileItem }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for renameFile:', params.fileId, 'to', params.newName);
      return window.electronAPI.storage.renameFile(params);
    } else {
      console.log('[storage-api] Using HTTP fetch for renameFile:', params.fileId);
      const res = await fetch(`/api/files/${params.fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: params.newName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for getStats');
      return window.electronAPI.storage.getStats();
    } else {
      console.log('[storage-api] Using HTTP fetch for getStats');
      const res = await fetch('/api/storage', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },

  /**
   * Get file path (Electron only - for opening files)
   */
  async getFilePath(fileId: string): Promise<string> {
    if (isElectron()) {
      return window.electronAPI.storage.getFilePath(fileId);
    } else {
      throw new Error('getFilePath is only available in Electron');
    }
  },

  /**
   * Get base storage path (Electron only - for display)
   */
  async getBasePath(): Promise<string> {
    if (isElectron()) {
      return window.electronAPI.storage.getBasePath();
    } else {
      return '~/AREVEI'; // Dev server default
    }
  },

  /**
   * Open file with default system application
   */
  async openFile(fileId: string): Promise<{ success: boolean }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for openFile:', fileId);
      return window.electronAPI.storage.openFile(fileId);
    } else {
      throw new Error('openFile is only available in Electron');
    }
  },

  /**
   * Show file/folder in Finder/Explorer
   */
  async showInFinder(fileId: string): Promise<{ success: boolean }> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for showInFinder:', fileId);
      return window.electronAPI.storage.showInFinder(fileId);
    } else {
      throw new Error('showInFinder is only available in Electron');
    }
  },

  /**
   * Refresh file list (re-scan filesystem)
   */
  async refreshFiles(): Promise<FileItem[]> {
    if (isElectron()) {
      console.log('[storage-api] Using Electron IPC for refreshFiles');
      return window.electronAPI.storage.refreshFiles();
    } else {
      // In dev, just re-fetch from API
      const res = await fetch('/api/files', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
  },
};
