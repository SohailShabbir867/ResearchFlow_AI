const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Auth middleware — validates JWT Bearer token.
 * Attaches decoded user document to req.user.
 */
module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided. Please log in." });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
      return res.status(401).json({ error: "Invalid token. Please log in again." });
    }

    // Fetch fresh user from DB (ensures suspended users are blocked)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Contact an administrator." });
    }

    // Update lastActive (fire and forget)
    User.findByIdAndUpdate(decoded.id, { lastActive: Date.now() }).catch(() => {});

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(500).json({ error: "Authentication error." });
  }
};
