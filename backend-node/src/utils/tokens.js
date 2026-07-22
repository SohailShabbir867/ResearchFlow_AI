const crypto = require("crypto");

/**
 * Generate a secure random hex token of given byte length.
 * Default 32 bytes = 64 hex chars.
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Return expiry date N hours from now.
 */
function expiresInHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Check whether a stored token matches the given raw token and has not expired.
 */
function isTokenValid(storedToken, storedExpiry, rawToken) {
  if (!storedToken || !storedExpiry) return false;
  if (storedToken !== rawToken) return false;
  if (new Date(storedExpiry) < new Date()) return false;
  return true;
}

module.exports = { generateToken, expiresInHours, isTokenValid };
