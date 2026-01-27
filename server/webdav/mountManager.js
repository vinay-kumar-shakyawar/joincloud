function createMountManager({ ownerServer, shareService, shareServerFactory, config, telemetry, logger }) {
  const shareCache = new Map();

  const { ownerBasePath, shareBasePath } = config.server;
  const shareDomain = (config.publicShareDomain || "").toLowerCase();

  function getShareServer(share) {
    if (!shareCache.has(share.shareId)) {
      const server = shareServerFactory({
        share,
        realm: config.auth.realm,
        telemetry,
        logger,
      });
      shareCache.set(share.shareId, server.webdavServer);
    }
    return shareCache.get(share.shareId);
  }

  function stripPrefix(pathname, prefix) {
    const stripped = pathname.slice(prefix.length);
    return stripped.length === 0 ? "/" : stripped;
  }

  function getShareIdFromHost(hostHeader) {
    if (!hostHeader || !shareDomain) return null;
    const host = hostHeader.split(":")[0].toLowerCase();
    if (!host.endsWith(shareDomain)) return null;
    const prefix = host.slice(0, host.length - shareDomain.length);
    if (!prefix.endsWith(".")) return null;
    const shareId = prefix.slice(0, -1);
    return shareId || null;
  }

  return function handleRequest(req, res) {
    const url = req.url || "/";
    const [pathname, search] = url.split("?");

    if (pathname === ownerBasePath || pathname.startsWith(`${ownerBasePath}/`)) {
      req.url = stripPrefix(pathname, ownerBasePath) + (search ? `?${search}` : "");
      ownerServer.webdavServer.executeRequest(req, res, "/");
      return;
    }

    const hostShareId = getShareIdFromHost(req.headers.host);
    // Deprecated: path-based access remains for localhost/LAN testing only.
    if (hostShareId || pathname === shareBasePath || pathname.startsWith(`${shareBasePath}/`)) {
      const rest = pathname.startsWith(shareBasePath)
        ? stripPrefix(pathname, shareBasePath)
        : pathname;
      const segments = rest.split("/").filter(Boolean);
      const shareId = hostShareId || segments[0];
      const cleanedSegments = hostShareId
        ? segments[0] === hostShareId
          ? segments.slice(1)
          : segments
        : segments.slice(1);

      if (!shareId) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const share = shareService.getShare(shareId);
      if (!share) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const shareServer = getShareServer(share);
      const sharePath = `/${cleanedSegments.join("/")}` || "/";
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
