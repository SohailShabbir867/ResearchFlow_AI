const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const User = require("../models/User");
const Chat = require("../models/Chat");
const QueryLog = require("../models/QueryLog");
const AppSettings = require("../models/AppSettings");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const { escapeRegex } = require("../utils/escapeRegex");

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware, requireRole("admin"));

const PYTHON_URL = () => process.env.PYTHON_RAG_URL || "http://localhost:8000";
const getPythonHeaders = () => {
  const key = process.env.PYTHON_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "";
  return key ? { "X-Internal-Key": key } : {};
};

// ─── Multer: memory storage for file uploads ───────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".txt", ".docx"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .pdf, .txt, and .docx files are allowed."));
    }
  },
});

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      queriesToday,
      queriesAnswered,
      queriesRefused,
      recentLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      QueryLog.countDocuments({ createdAt: { $gte: todayStart } }),
      QueryLog.countDocuments({ createdAt: { $gte: todayStart }, status: "answered" }),
      QueryLog.countDocuments({ createdAt: { $gte: todayStart }, status: "refused" }),
      QueryLog.find({}, "timing.totalMs").sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    // Average response time
    const validLogs = recentLogs.filter(l => l.timing && l.timing.totalMs > 0);
    const avgResponseMs = validLogs.length
      ? Math.round(validLogs.reduce((sum, l) => sum + l.timing.totalMs, 0) / validLogs.length)
      : 0;

    // Get doc stats from Python (graceful fallback)
    let totalDocs = 0;
    let totalChunks = 0;
    try {
      const pyHealth = await axios.get(`${PYTHON_URL()}/health`, { timeout: 5000, headers: getPythonHeaders() });
      totalChunks = pyHealth.data?.collection?.points_count || pyHealth.data?.chunks || 0;
      const pyDocs = await axios.get(`${PYTHON_URL()}/documents`, { timeout: 5000, headers: getPythonHeaders() });
      totalDocs = Array.isArray(pyDocs.data?.documents) ? pyDocs.data.documents.length : 0;
    } catch {
      // Python service may be down — return zeros
    }

    return res.json({
      totalUsers,
      activeUsers,
      pendingUsers: totalUsers - activeUsers,
      totalDocs,
      totalChunks,
      queriesToday,
      queriesAnswered,
      queriesRefused,
      avgResponseMs,
    });
  } catch (err) {
    console.error("Admin stats error:", err.message);
    return res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
      ];
    }
    if (role && role !== "all") filter.role = role;
    if (status && status !== "all") filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("Admin users error:", err.message);
    return res.status(500).json({ error: "Failed to fetch users." });
  }
});

// ─── POST /api/admin/users ─────────────────────────────────────────────────────
router.post("/users", async (req, res) => {
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
      status: "active",        // admin-created users are immediately active
      isEmailVerified: true,  // admin vouches for the email
    });

    await newUser.save();

    return res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      specialty: newUser.specialty,
      status: newUser.status,
      queryCount: newUser.queryCount,
      createdAt: newUser.createdAt,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use." });
    }
    console.error("Admin create user error:", err.message);
    return res.status(500).json({ error: "Failed to create user." });
  }
});

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────
router.patch("/users/:id", async (req, res) => {
  try {
    const { name, role, specialty, status } = req.body;
    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (role !== undefined) {
      updateFields.role = role;
      if (role === "admin") updateFields.canUploadDocuments = true;
    }
    if (specialty !== undefined) updateFields.specialty = specialty;
    if (status !== undefined) updateFields.status = status;

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, select: "-password" }
    );

    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Admin update user error:", err.message);
    return res.status(500).json({ error: "Failed to update user." });
  }
});

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Delete user + all their data in parallel
    await Promise.all([
      User.deleteOne({ _id: req.params.id }),
      Chat.deleteMany({ userId: req.params.id }),
      QueryLog.deleteMany({ userId: req.params.id }),
    ]);

    return res.json({ message: "User and all data deleted.", id: req.params.id });
  } catch (err) {
    console.error("Admin delete user error:", err.message);
    return res.status(500).json({ error: "Failed to delete user." });
  }
});

// ─── PATCH /api/admin/users/:id/upload-access ─────────────────────────────────
// Admin grants or revokes upload document access for a specific user
router.patch("/users/:id/upload-access", async (req, res) => {
  try {
    const { grant } = req.body; // boolean: true = grant, false = revoke
    if (typeof grant !== "boolean") {
      return res.status(400).json({ error: "'grant' must be a boolean (true/false)." });
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Admins always have upload access — don't allow revoking it
    if (user.role === "admin" && !grant) {
      return res.status(400).json({ error: "Cannot revoke upload access from an admin." });
    }

    user.canUploadDocuments   = grant;
    user.uploadAccessGrantedBy = grant ? req.user._id : null;
    await user.save();

    return res.json({
      message: grant
        ? `Upload access granted to ${user.name}.`
        : `Upload access revoked from ${user.name}.`,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error("Upload access update error:", err.message);
    return res.status(500).json({ error: "Failed to update upload access." });
  }
});



// ─── GET /api/admin/documents ─────────────────────────────────────────────────
router.get("/documents", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_URL()}/documents`, { timeout: 10000, headers: getPythonHeaders() });
    return res.json(response.data);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Python RAG service is unavailable." });
    }
    console.error("Admin documents error:", err.message);
    return res.status(500).json({ error: "Failed to fetch documents." });
  }
});

// ─── POST /api/admin/upload ────────────────────────────────────────────────────
// ADMIN ONLY — regular users cannot upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided." });
    }

    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Forward specialty tags if provided
    if (req.body.specialties) {
      form.append("specialties", req.body.specialties);
    }

    const response = await axios.post(`${PYTHON_URL()}/upload`, form, {
      headers: { ...form.getHeaders(), ...getPythonHeaders() },
      timeout: 300000, // 5 minutes for large files/embeddings
    });

    return res.json(response.data);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Python RAG service is unavailable." });
    }
    if (err.code === "ECONNABORTED") {
      return res.status(504).json({ error: "Upload timed out. File may be too large." });
    }
    console.error("Admin upload error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to upload document." });
  }
});

// ─── DELETE /api/admin/documents/:source ──────────────────────────────────────
router.delete("/documents/:source", async (req, res) => {
  try {
    const source = decodeURIComponent(req.params.source);
    const response = await axios.delete(`${PYTHON_URL()}/documents/${encodeURIComponent(source)}`, { timeout: 15000, headers: getPythonHeaders() });
    return res.json(response.data);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Python RAG service is unavailable." });
    }
    console.error("Admin delete document error:", err.message);
    return res.status(500).json({ error: "Failed to delete document." });
  }
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const { search, userId, status, from, to, page = 1, limit = 25, format } = req.query;

    const filter = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { question: { $regex: safeSearch, $options: "i" } },
        { answer: { $regex: safeSearch, $options: "i" } },
        { userName: { $regex: safeSearch, $options: "i" } },
      ];
    }
    if (userId) filter.userId = userId;
    if (status && status !== "all") filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      QueryLog.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      QueryLog.countDocuments(filter),
    ]);

    // CSV export
    if (format === "csv") {
      const header = "Timestamp,User,Question,Status,Sources,Response Time (ms)\n";
      const rows = logs.map(l => [
        `"${new Date(l.createdAt).toISOString()}"`,
        `"${l.userName || ""}"`,
        `"${(l.question || "").replace(/"/g, '""')}"`,
        `"${l.status}"`,
        `"${(l.sources || []).length}"`,
        `"${l.timing?.totalMs || 0}"`,
      ].join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=query_logs.csv");
      return res.send(header + rows);
    }

    return res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error("Admin logs error:", err.message);
    return res.status(500).json({ error: "Failed to fetch logs." });
  }
});

// ─── GET /api/admin/health ────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  const services = {};

  // MongoDB
  const mongoose = require("mongoose");
  services.mongodb = {
    status: mongoose.connection.readyState === 1 ? "online" : "offline",
    port: 27017,
  };

  // Python RAG
  try {
    const pyRes = await axios.get(`${PYTHON_URL()}/health`, { timeout: 5000, headers: getPythonHeaders() });
    services.pythonRag = {
      status: "online",
      port: 8000,
      data: pyRes.data,
    };
    // Extract Qdrant info if present
    if (pyRes.data?.qdrant) {
      services.qdrant = { status: "online", port: 6333, ...pyRes.data.qdrant };
    } else {
      services.qdrant = { status: "unknown", port: 6333 };
    }
  } catch {
    services.pythonRag = { status: "offline", port: 8000, error: "Connection refused" };
    services.qdrant = { status: "unknown", port: 6333 };
  }

  // Node itself
  services.nodeApi = { status: "online", port: process.env.PORT || 5000 };

  return res.json({ services, timestamp: new Date().toISOString() });
});

// ─── GET /api/admin/settings ──────────────────────────────────────────────────
router.get("/settings", async (req, res) => {
  try {
    const saved = await AppSettings.findOne({ key: "global" });
    const defaults = {
      guardrail:    { threshold: -2.0, minChunks: 2 },
      rateLimiting: { maxQueriesPerHour: 100, maxUploadsPerDay: 20 },
      llm:          { provider: "groq", model: "llama-3.3-70b-versatile", geminiModel: "gemini-mini", maxTokens: 1024, temperature: 0.2 },
    };
    const result = saved ? saved.data : defaults;

    // Merge any live Python overrides
    try {
      const pyRes = await axios.get(`${PYTHON_URL()}/settings`, { timeout: 5000, headers: getPythonHeaders() });
      if (pyRes.data) Object.assign(result, pyRes.data);
    } catch {
      // Python may be down — use DB values
    }

    return res.json(result);
  } catch (err) {
    console.error("Admin get settings error:", err.message);
    return res.status(500).json({ error: "Failed to fetch settings." });
  }
});

// ─── POST /api/admin/settings ─────────────────────────────────────────────────
router.post("/settings", async (req, res) => {
  try {
    const settings = req.body;

    // Persist to MongoDB (upsert — creates if first time, updates otherwise)
    await AppSettings.findOneAndUpdate(
      { key: "global" },
      { key: "global", data: settings, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Forward settings (guardrails + llm maxTokens) to Python
    try {
      await axios.post(`${PYTHON_URL()}/settings`, settings, { timeout: 5000, headers: getPythonHeaders() });
    } catch (err) {
      console.warn("Failed to sync settings to Python:", err.message);
    }

    return res.json({ success: true, message: "Settings saved successfully.", settings });
  } catch (err) {
    console.error("Admin save settings error:", err.message);
    return res.status(500).json({ error: "Failed to save settings." });
  }
});

module.exports = router;
