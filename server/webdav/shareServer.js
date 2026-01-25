const { v2 } = require("webdav-server");
const path = require("path");
const mime = require("mime-types");
const { resolveRights } = require("../sharing/permissionResolver");

function createShareServer({ share, realm }) {
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

  webdavServer.beforeRequest((ctx, callback) => {
    const method = ctx.request.method || "";
    if (method === "GET" || method === "HEAD") {
      const resourcePath = ctx.requested.path.toString();
      const filename = path.basename(resourcePath);
      if (filename) {
        const contentType =
          mime.lookup(filename) || "application/octet-stream";
        ctx.response.setHeader("Content-Type", contentType);
        ctx.response.setHeader(
          "Content-Disposition",
          `inline; filename="${filename}"`
        );
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
