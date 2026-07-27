require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const researchRoutes = require("./routes/research");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cybersec";

// ─── MongoDB connection with retry ────────────────────────────────────────────
let retries = 0;
const MAX_RETRIES = 5;

async function connectDB() {
  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("✅ Connected to MongoDB successfully!");
      return;
    } catch (err) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries}/${MAX_RETRIES} failed: ${err.message}`);
      if (retries < MAX_RETRIES) {
        console.log(`   Retrying in 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  console.error("❌ Could not connect to MongoDB after maximum retries. Exiting.");
  process.exit(1);
}

connectDB();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    }
  },
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Rate Limiting (100 requests per 15 minutes per IP) ───────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again after 15 minutes." },
});

app.use("/api", limiter);

// ─── Request Logging (dev only) ───────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/admin", adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cyberSecAI-node",
    version: "4.0.0",
    port: PORT,
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 50MB." });
  }

  // CORS errors
  if (err.message && err.message.startsWith("CORS")) {
    return res.status(403).json({ error: err.message });
  }

  return res.status(500).json({ error: "Internal server error." });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Node server running on http://localhost:${PORT}`);
  console.log(`📡 Python RAG service expected at ${process.env.PYTHON_RAG_URL || "http://localhost:8000"}`);
  console.log(`🌐 Frontend expected at ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}\n`);
});

module.exports = app;
