const express = require("express");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const Chat = require("../models/Chat");
const router = express.Router();

const PYTHON_RAG_URL = process.env.PYTHON_RAG_URL || "http://localhost:8000";

// Multer — store upload in memory so we can forward to Python
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});


// ─── Chat sessions ───────────────────────────────────────────────────────────

// GET /api/research/chats
router.get("/chats", async (req, res) => {
  try {
    const chats = await Chat.find({}, { messages: { $slice: -1 } })
      .sort({ updatedAt: -1 });

    const formatted = chats.map(c => ({
      _id: c._id,
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      lastMessage: c.messages[0] ? c.messages[0].text : ""
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("Error getting chats:", err.message);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
});

// POST /api/research/chats
router.post("/chats", async (req, res) => {
  try {
    const { title } = req.body;
    const newChat = new Chat({ title: title || "New Chat", messages: [] });
    await newChat.save();
    return res.json(newChat);
  } catch (err) {
    console.error("Error creating chat:", err.message);
    return res.status(500).json({ error: "Failed to create new chat." });
  }
});

// GET /api/research/chats/:id
router.get("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    return res.json(chat);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load chat." });
  }
});

// DELETE /api/research/chats/:id
router.delete("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findByIdAndDelete(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });
    return res.json({ message: "Chat deleted.", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete chat." });
  }
});


// ─── Ask (standard query) ────────────────────────────────────────────────────

// POST /api/research/chats/:id/ask
router.post("/chats/:id/ask", async (req, res) => {
  const { question } = req.body;
  const { id } = req.params;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  try {
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    // Save user message immediately
    chat.messages.push({ role: "user", text: question.trim(), timestamp: new Date() });
    await chat.save();

    // Forward to Python RAG
    let answerText = "No response from service.";
    let sources = [];

    try {
      const response = await axios.post(
        `${PYTHON_RAG_URL}/query`,
        { question: question.trim(), top_k: 5 },
        { timeout: 120000 }
      );
      answerText = response.data.answer;
      sources = response.data.sources || [];
    } catch (apiErr) {
      let clientError = "RAG service offline.";
      if (apiErr.code === "ECONNREFUSED") clientError = "RAG service is offline. Start uvicorn backend.";
      else if (apiErr.code === "ECONNABORTED") clientError = "RAG service timeout.";
      else if (apiErr.response?.data?.detail) clientError = apiErr.response.data.detail;

      chat.messages.push({ role: "assistant", text: `⚠️ ${clientError}`, sources: [], timestamp: new Date() });
      await chat.save();
      return res.json(chat);
    }

    // Auto-title from first question
    if (chat.title === "New Chat" && chat.messages.length <= 2) {
      const words = question.trim().split(/\s+/);
      const candidate = words.slice(0, 5).join(" ");
      chat.title = candidate.length > 30 ? candidate.substring(0, 30) + "..." : candidate;
    }

    chat.messages.push({ role: "assistant", text: answerText, sources, timestamp: new Date() });
    await chat.save();
    return res.json(chat);

  } catch (err) {
    console.error("Ask error:", err.message);
    return res.status(500).json({ error: "Failed to process question." });
  }
});


// ─── Upload (Fix #4 — forward file to Python for indexing) ───────────────────

// POST /api/research/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided." });
  }

  const allowed = [".pdf", ".txt", ".docx"];
  const ext = "." + req.file.originalname.split(".").pop().toLowerCase();
  if (!allowed.includes(ext)) {
    return res.status(400).json({
      error: `Unsupported file type '${ext}'. Allowed: PDF, TXT, DOCX`
    });
  }

  try {
    // Forward the file buffer to Python FastAPI /upload
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      `${PYTHON_RAG_URL}/upload`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 300000  // 5 min — large PDFs take time to embed
      }
    );

    return res.json(response.data);

  } catch (err) {
    if (err.response?.data?.detail) {
      return res.status(err.response.status).json({ error: err.response.data.detail });
    }
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Python RAG service is offline." });
    }
    console.error("Upload error:", err.message);
    return res.status(500).json({ error: "Upload failed. Check Python server logs." });
  }
});


// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/health", async (_req, res) => {
  try {
    const response = await axios.get(`${PYTHON_RAG_URL}/health`, { timeout: 3000 });
    return res.json({ node: "ok", python: response.data.status });
  } catch {
    return res.json({ node: "ok", python: "unreachable" });
  }
});

module.exports = router;
