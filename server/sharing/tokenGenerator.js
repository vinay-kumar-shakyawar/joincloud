const crypto = require("crypto");

function generateShareId() {
  return crypto.randomBytes(24).toString("hex");
}

module.exports = {
  generateShareId,
};
