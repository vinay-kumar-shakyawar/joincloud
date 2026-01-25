const { v2 } = require("webdav-server");

function createOwnerServer({ ownerRoot, realm, username, password }) {
  const userManager = new v2.SimpleUserManager();
  const ownerUser = userManager.addUser(username, password, false);

  const privilegeManager = new v2.SimplePathPrivilegeManager();
  // Owner must have full rights at root for Finder compatibility.
  privilegeManager.setRights(ownerUser, "/", ["all"]);

  const webdavServer = new v2.WebDAVServer({
    requireAuthentification: true,
    httpAuthentication: new v2.HTTPBasicAuthentication(userManager, realm),
    privilegeManager,
    rootFileSystem: new v2.PhysicalFileSystem(ownerRoot),
  });

  return {
    webdavServer,
  };
}

module.exports = {
  createOwnerServer,
};
