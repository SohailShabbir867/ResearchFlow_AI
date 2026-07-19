const express = require("express");
const axios = require("axios");
const router = express.Router();

const PYTHON_RAG_URL = process.env.PYTHON_RAG_URL || "http://localhost:8000";

// POST /api/research/ask
// Body: { question: string }
// Returns: { answer: string, sources: string[] }
router.post("/ask", async (req, res) => {
  const { question } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  try {
    const response = await axios.post(
      `${PYTHON_RAG_URL}/query`,
      { question: question.trim(), top_k: 5 },
      { timeout: 120000 }  // 120s — VPS Ollama may have network latency
    );

    return res.json({
      answer: response.data.answer,
      sources: response.data.sources
    });

  } catch (err) {
    // Python service is down
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "RAG service is offline. Run: uvicorn src.api:app --port 8000"
      });
    }

    // Timeout
    if (err.code === "ECONNABORTED") {
      return res.status(504).json({
        error: "RAG service timed out. Check VPS Ollama connection and OLLAMA_URL in backend-python/.env"
      });
    }

    // VPS Ollama unreachable (propagated from Python as 503)
    if (err.response?.status === 503) {
      return res.status(503).json({
        error: err.response.data?.detail || "Cannot reach Ollama on VPS. Check OLLAMA_URL in backend-python/.env"
      });
    }

    console.error("Python RAG error:", err.message);
    return res.status(500).json({ error: "Unexpected error from RAG service." });
  }
});

// GET /api/research/health
// Checks if Python RAG service is reachable
router.get("/health", async (_req, res) => {
  try {
    const response = await axios.get(
      `${PYTHON_RAG_URL}/health`,
      { timeout: 3000 }
    );
    return res.json({
      node: "ok",
      python: response.data.status
    });
  } catch {
    return res.json({
      node: "ok",
      python: "unreachable — start the Python server"
    });
  }
});

module.exports = router;
