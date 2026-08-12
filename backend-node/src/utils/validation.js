/**
 * Shared validation utilities for user input formatting.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check if the given string is a valid email address format.
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Check if the given password satisfies minimum security rules (>= 8 chars).
 */
function isValidPassword(password) {
  if (!password || typeof password !== "string") return false;
  return password.length >= 8;
}

module.exports = {
  isValidEmail,
  isValidPassword,
};
