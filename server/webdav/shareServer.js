const { v2 } = require("webdav-server");
const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");
const { resolveRights } = require("../sharing/permissionResolver");

function createShareServer({ share, realm, telemetry, runtimeTelemetry, usageAggregation, logger }) {
  const userManager = new v2.SimpleUserManager();
  const privilegeManager = new v2.SimplePathPrivilegeManager();

  // Shares are token-gated; allow the default user to access only the share root.
  userManager.getDefaultUser((defaultUser) => {
    const rights = resolveRights(share.permission);
    privilegeManager.setRights(defaultUser, "/", rights);
  });

  const webdavServer = new v2.WebDAVServer({
    requireAuthentification: false,
    httpAuthentication: new v2.HTTPBasicAuthentication(userManager, realm),
    privilegeManager,
    rootFileSystem: new v2.PhysicalFileSystem(share.targetPath),
  });

  webdavServer.beforeRequest(async (ctx, callback) => {
    const method = ctx.request.method || "";
    if (method === "GET" || method === "HEAD") {
      const resourcePath = ctx.requested.path.toString();
      const filename = path.basename(resourcePath) || path.basename(share.targetPath);
      if (filename) {
        const contentType =
          mime.lookup(filename) || "application/octet-stream";
        ctx.response.setHeader("Content-Type", contentType);
        const safeName = filename.replace(/"/g, "");
        const encodedName = encodeURIComponent(filename);
        ctx.response.setHeader(
          "Content-Disposition",
          `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`
        );
        if (logger) {
          logger.info("download requested", {
            share_id: share.shareId,
            name: filename,
          });
        }
      }
      if (telemetry) {
        let bytes = 0;
        try {
          const fullPath = path.join(share.targetPath, resourcePath);
          const stats = await fs.stat(fullPath);
          bytes = stats.size || 0;
        } catch (error) {
          bytes = 0;
        }
        telemetry.trackEvent("file_downloaded", {
          share_id: share.shareId,
          bytes,
        });
        if (runtimeTelemetry && typeof runtimeTelemetry.increment === "function") {
          runtimeTelemetry.increment("bytes_downloaded", bytes);
        }
        if (usageAggregation && typeof usageAggregation.recordTransferActivity === "function") {
          usageAggregation.recordTransferActivity();
        }
      }
    }
    callback();
  });

  return {
    webdavServer,
  };
}

module.exports = {
  createShareServer,
};
