/**
 * Escape special regex characters in a string to prevent ReDoS and regex injection.
 * Escapes: . * + ? ^ $ { } ( ) | [ ] \
 */
function escapeRegex(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
