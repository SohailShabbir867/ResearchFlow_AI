const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const researchRoutes = require("./routes/research");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: "http://localhost:5173",  // Vite dev server
  credentials: true
}));
app.use(express.json());

// Log every request in dev
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// Routes
app.use("/api/research", researchRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "medresearch-node", port: PORT });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Node server running on http://localhost:${PORT}`);
  console.log(`Python RAG service expected at ${process.env.PYTHON_RAG_URL}`);
});
