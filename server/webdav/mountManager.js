function createMountManager({ ownerServer, shareService, shareServerFactory, config, telemetry }) {
  const shareCache = new Map();

  const { ownerBasePath, shareBasePath } = config.server;

  function getShareServer(share) {
    if (!shareCache.has(share.shareId)) {
      const server = shareServerFactory({ share, realm: config.auth.realm, telemetry });
      shareCache.set(share.shareId, server.webdavServer);
    }
    return shareCache.get(share.shareId);
  }

  function stripPrefix(pathname, prefix) {
    const stripped = pathname.slice(prefix.length);
    return stripped.length === 0 ? "/" : stripped;
  }

  return function handleRequest(req, res) {
    const url = req.url || "/";
    const [pathname, search] = url.split("?");

    if (pathname === ownerBasePath || pathname.startsWith(`${ownerBasePath}/`)) {
      req.url = stripPrefix(pathname, ownerBasePath) + (search ? `?${search}` : "");
      ownerServer.webdavServer.executeRequest(req, res, "/");
      return;
    }

    if (pathname === shareBasePath || pathname.startsWith(`${shareBasePath}/`)) {
      const rest = stripPrefix(pathname, shareBasePath);
      const [token, ...segments] = rest.split("/").filter(Boolean);

      if (!token) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const share = shareService.getShare(token);
      if (!share) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const shareServer = getShareServer(share);
      const sharePath = `/${segments.join("/")}` || "/";
      req.url = sharePath + (search ? `?${search}` : "");
      shareServer.executeRequest(req, res, "/");
      return;
    }

    res.statusCode = 404;
    res.end();
  };
}

module.exports = {
  createMountManager,
};
