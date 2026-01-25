const path = require("path");
const fs = require("fs/promises");

async function resolveRealPath(targetPath) {
  return fs.realpath(targetPath);
}

function ensureWithinRoot(rootReal, targetReal) {
  const normalizedRoot = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  if (targetReal !== rootReal && !targetReal.startsWith(normalizedRoot)) {
    throw new Error("Target path escapes owner root");
  }
}

async function validateShareTarget(ownerRoot, targetPath) {
  const ownerReal = await resolveRealPath(ownerRoot);
  const targetReal = await resolveRealPath(targetPath);
  ensureWithinRoot(ownerReal, targetReal);
  return targetReal;
}

function resolveOwnerPath(ownerRoot, requestedPath) {
  const safePath = requestedPath ? `.${requestedPath}` : ".";
  const resolved = path.resolve(ownerRoot, safePath);
  const normalizedRoot = ownerRoot.endsWith(path.sep) ? ownerRoot : `${ownerRoot}${path.sep}`;
  if (resolved !== ownerRoot && !resolved.startsWith(normalizedRoot)) {
    throw new Error("Requested path escapes owner root");
  }
  return resolved;
}

module.exports = {
  validateShareTarget,
  resolveOwnerPath,
};
