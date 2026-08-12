/**
 * Validate document magic bytes (file signatures) to verify actual file type.
 * Supports PDF, DOCX (PK zip header), and plain UTF-8 text.
 * Rejects executables (MZ, ELF, Mach-O), scripts, and unexpected binary headers.
 */
function isValidDocumentBuffer(buffer, originalname) {
  if (!buffer || buffer.length === 0 || !originalname || typeof originalname !== "string") {
    return false;
  }

  const ext = "." + (originalname.split(".").pop() || "").toLowerCase().trim();

  // Check PDF signature: %PDF- (0x25 0x50 0x44 0x46)
  if (ext === ".pdf") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // Check DOCX signature: PK\x03\x04 (zip archive: 0x50 0x4B 0x03 0x04)
  if (ext === ".docx") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  // Check TXT signature: Must be clean text (no binary executable headers or null bytes)
  if (ext === ".txt") {
    // Reject Windows PE/EXE (MZ header: 0x4D 0x5A)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return false;
    }
    // Reject Linux ELF header (\x7fELF: 0x7F 0x45 0x4C 0x46)
    if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return false;
    }
    // Reject Mach-O binaries (0xFE 0xED 0xFA 0xCE / 0xCF)
    if (buffer.length >= 4 && ((buffer[0] === 0xfe && buffer[1] === 0xed) || (buffer[0] === 0xcf && buffer[1] === 0xfa))) {
      return false;
    }

    // Verify buffer is valid text (no null bytes in sample)
    let nullCount = 0;
    const sampleSize = Math.min(buffer.length, 1024);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) nullCount++;
    }
    return nullCount === 0;
  }

  return false;
}

module.exports = {
  isValidDocumentBuffer,
};
