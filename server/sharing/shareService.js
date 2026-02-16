const path = require("path");
const fs = require("fs/promises");
const { generateShareId } = require("./tokenGenerator");
const { normalizePermission } = require("./permissionResolver");
const { validateShareTarget } = require("../security/pathGuard");

class ShareService {
  constructor({ ownerRoot, defaultPermission, defaultTtlMs, storagePath, logger, telemetry }) {
    this.ownerRoot = ownerRoot;
    this.defaultPermission = defaultPermission;
    this.defaultTtlMs = defaultTtlMs;
    this.storagePath = storagePath;
    this.logger = logger;
    this.telemetry = telemetry;
    this.shares = new Map();
  }

  async init() {
    await this.loadFromDisk();
  }

  async loadFromDisk() {
    if (!this.storagePath) return;
    try {
      const raw = await fs.readFile(this.storagePath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const share of data) {
          if (share && share.shareId) {
            if (!share.targetType && share.targetPath) {
              try {
                const stats = await fs.stat(share.targetPath);
                share.targetType = stats.isDirectory() ? "folder" : "file";
              } catch (_error) {
                share.targetType = "file";
              }
            }
            this.shares.set(share.shareId, share);
          }
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async saveToDisk() {
    if (!this.storagePath) return;
    const payload = JSON.stringify(Array.from(this.shares.values()), null, 2);
    const tmpPath = `${this.storagePath}.tmp`;
    await fs.writeFile(tmpPath, payload, "utf8");
    await fs.rename(tmpPath, this.storagePath);
  }

  async createShare({ targetPath, permission, expiryTime, ttlMs, scope }) {
    if (!targetPath) {
      throw new Error("targetPath is required");
    }

    const resolvedTarget = path.resolve(targetPath);
    const validatedTarget = await validateShareTarget(this.ownerRoot, resolvedTarget);

    const stat = await fs.stat(validatedTarget);
    if (!stat.isDirectory() && !stat.isFile()) {
      throw new Error("targetPath must be a file or directory");
    }

    const shareId = generateShareId();
    const createdAt = new Date();
    const expiresAt = expiryTime
      ? new Date(expiryTime)
      : new Date(createdAt.getTime() + (ttlMs || this.defaultTtlMs));

    const share = {
      shareId,
      targetPath: validatedTarget,
      targetType: stat.isDirectory() ? "folder" : "file",
      permission: normalizePermission(permission, this.defaultPermission),
      scope: scope || "local",
      expiryTime: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
      revoked: false,
    };

    this.shares.set(shareId, share);
    await this.saveToDisk();
    if (this.logger) {
      this.logger.info("share created", {
        shareId,
        scope: share.scope,
        permission: share.permission,
      });
    }
    if (this.telemetry) {
      this.telemetry.trackEvent("share_created", {
        share_id: shareId,
        scope: share.scope,
        permission: share.permission,
      });
    }
    return share;
  }

  async revokeShare(shareId) {
    const share = this.shares.get(shareId);
    if (!share) {
      return false;
    }
    share.revoked = true;
    this.shares.set(shareId, share);
    await this.saveToDisk();
    if (this.logger) {
      this.logger.info("share revoked", { shareId });
    }
    if (this.telemetry) {
      this.telemetry.trackEvent("share_revoked", { share_id: shareId });
    }
    return true;
  }

  getShare(shareId) {
    const share = this.shares.get(shareId);
    if (!share) {
      return null;
    }
    if (share.revoked) {
      return null;
    }
    if (new Date(share.expiryTime).getTime() <= Date.now()) {
      share.revoked = true;
      this.shares.set(shareId, share);
      this.saveToDisk().catch(() => {});
      return null;
    }
    return share;
  }

  getShareRecord(shareId) {
    return this.shares.get(shareId) || null;
  }

  expireShares() {
    const now = Date.now();
    for (const share of this.shares.values()) {
      if (!share.revoked && new Date(share.expiryTime).getTime() <= now) {
        share.revoked = true;
        this.shares.set(share.shareId, share);
      }
    }
    this.saveToDisk().catch(() => {});
  }

  listShares() {
    const results = [];
    const now = Date.now();
    for (const share of this.shares.values()) {
      const expired = new Date(share.expiryTime).getTime() <= now;
      const status = share.revoked ? "revoked" : expired ? "expired" : "active";
      results.push({ ...share, status });
    }
    return results;
  }

  async revokeMany(shareIds) {
    let revokedCount = 0;
    for (const shareId of shareIds || []) {
      const share = this.shares.get(shareId);
      if (!share || share.revoked) continue;
      share.revoked = true;
      this.shares.set(shareId, share);
      revokedCount += 1;
    }
    if (revokedCount > 0) {
      await this.saveToDisk();
    }
    return revokedCount;
  }

  async revokeAll() {
    let revokedCount = 0;
    for (const share of this.shares.values()) {
      if (share.revoked) continue;
      share.revoked = true;
      this.shares.set(share.shareId, share);
      revokedCount += 1;
    }
    if (revokedCount > 0) {
      await this.saveToDisk();
    }
    return revokedCount;
  }
}

module.exports = {
  ShareService,
};
