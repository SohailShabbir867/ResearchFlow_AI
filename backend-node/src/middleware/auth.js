const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Auth middleware — validates JWT Bearer token.
 * Attaches decoded user document to req.user.
 */
module.exports = async function authMiddleware(req, res, next) {
  try {
    let token;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided. Please log in." });
    }

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

    // Throttle lastActive updates to max once per 5 minutes to avoid DB write spam
    if (!user.lastActive || (Date.now() - new Date(user.lastActive).getTime() > 5 * 60 * 1000)) {
      User.findByIdAndUpdate(decoded.id, { lastActive: Date.now() }).catch(() => {});
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(500).json({ error: "Authentication error." });
  }
};
