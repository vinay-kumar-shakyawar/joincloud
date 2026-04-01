const semver = require("semver");

/**
 * @param {Array<{ version: string, changelog?: string[] }>} allVersions - full list from versions.json, sorted newest first
 * @param {string} currentVersion - from app.getVersion()
 * @returns {{ newer: Array, current: Object, older: Array }}
 */
function filterVersions(allVersions, currentVersion) {
  const newer = [];
  const older = [];
  let current = null;

  for (const v of allVersions) {
    if (!v || typeof v.version !== "string") continue;
    const a = semver.valid(v.version);
    const b = semver.valid(currentVersion);
    if (!a || !b) continue;
    const cmp = semver.compare(a, b);
    if (cmp > 0) newer.push(v);
    else if (cmp === 0) current = v;
    else older.push(v);
  }

  return {
    newer,
    current: current ?? { version: currentVersion, changelog: ["Current install"] },
    older: older.slice(0, 3),
  };
}

module.exports = { filterVersions };
