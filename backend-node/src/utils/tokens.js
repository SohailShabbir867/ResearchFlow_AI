const crypto = require("crypto");

/**
 * Generate a secure random hex token of given byte length.
 * Default 32 bytes = 64 hex chars.
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hash a raw token string using SHA-256 for secure database storage.
 */
function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Return expiry date N hours from now.
 */
function expiresInHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Check whether a stored SHA-256 token hash matches the given raw token and has not expired.
 */
function isTokenValid(storedToken, storedExpiry, rawToken) {
  if (!storedToken || !storedExpiry || !rawToken) return false;
  const hashedRaw = hashToken(rawToken);
  if (storedToken !== hashedRaw && storedToken !== rawToken) return false;
  if (new Date(storedExpiry) < new Date()) return false;
  return true;
}

module.exports = { generateToken, hashToken, expiresInHours, isTokenValid };
