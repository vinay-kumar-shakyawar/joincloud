const crypto = require("crypto");

async function getDeviceUUID(userConfig, updateUserConfig) {
  if (userConfig.device_uuid) {
    return userConfig.device_uuid;
  }
  const deviceUUID = crypto.randomUUID();
  userConfig.device_uuid = deviceUUID;
  if (typeof updateUserConfig === "function") {
    await updateUserConfig(userConfig);
  }
  return deviceUUID;
}

module.exports = {
  getDeviceUUID,
};
