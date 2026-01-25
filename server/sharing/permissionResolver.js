const PERMISSIONS = new Set(["read-only", "read-write"]);

function normalizePermission(input, fallback) {
  if (PERMISSIONS.has(input)) {
    return input;
  }
  return fallback || "read-only";
}

function resolveRights(permission) {
  if (permission === "read-write") {
    return ["canRead", "canWrite"];
  }
  return ["canRead"];
}

module.exports = {
  normalizePermission,
  resolveRights,
};
