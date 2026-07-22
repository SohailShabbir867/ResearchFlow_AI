const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

// ─── Helper: sign JWT ──────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "24h" });
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
// Public — anyone can attempt login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Please contact an administrator." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Update lastActive
    user.lastActive = Date.now();
    await user.save();

    const token = signToken(user._id);

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        status: user.status,
        queryCount: user.queryCount,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Server error during login." });
  }
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────
// Admin only — admins create new user accounts
router.post("/register", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "A user with that email already exists." });
    }

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || "viewer",
      specialty: specialty || "",
    });

    await newUser.save();

    return res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      specialty: newUser.specialty,
      status: newUser.status,
      createdAt: newUser.createdAt,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use." });
    }
    console.error("Register error:", err.message);
    return res.status(500).json({ error: "Server error during registration." });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
// Protected — return current user info
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      specialty: user.specialty,
      status: user.status,
      queryCount: user.queryCount,
      lastActive: user.lastActive,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Get me error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
// Protected — client removes token; we just confirm
router.post("/logout", authMiddleware, (req, res) => {
  return res.json({ message: "Logged out successfully." });
});

module.exports = router;
