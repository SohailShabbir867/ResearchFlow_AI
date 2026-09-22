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

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.";

/**
 * Check if the given password satisfies minimum security rules:
 * >= 8 chars, at least one uppercase letter, one digit, and one symbol.
 * Kept in sync with the requirements checklist shown on the reset-password UI
 * (frontend/src/pages/ResetPassword.jsx), which previously only displayed these
 * rules cosmetically without the backend enforcing them.
 */
function isValidPassword(password) {
  if (!password || typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

module.exports = {
  isValidEmail,
  isValidPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
};
