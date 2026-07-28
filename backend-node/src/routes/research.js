const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const QueryLog = require("../models/QueryLog");
const User = require("../models/User");
const AppSettings = require("../models/AppSettings");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// All research routes require authentication
router.use(authMiddleware);

const PYTHON_URL = () => process.env.PYTHON_RAG_URL || "http://localhost:8000";

// ─── GET /api/research/chats ──────────────────────────────────────────────────
router.get("/chats", async (req, res) => {
  try {
    const chats = await Chat.find(
      { userId: req.user._id },
      { messages: { $slice: -1 } }
    ).sort({ updatedAt: -1 });

    const formatted = chats.map(c => ({
      _id: c._id,
      title: c.title,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      lastMessage: c.messages[0] ? c.messages[0].text.substring(0, 100) : "",
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("Error getting chats:", err.message);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
});

// ─── POST /api/research/chats ─────────────────────────────────────────────────
router.post("/chats", async (req, res) => {
  try {
    const { title } = req.body;
    const newChat = new Chat({
      userId: req.user._id,
      title: title || "New Chat",
      messages: [],
    });
    await newChat.save();
    return res.json(newChat);
  } catch (err) {
    console.error("Error creating chat:", err.message);
    return res.status(500).json({ error: "Failed to create new chat." });
  }
});

// ─── GET /api/research/chats/:id ─────────────────────────────────────────────
router.get("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    // Ownership check
    if (chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    return res.json(chat);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load chat." });
  }
});

// ─── DELETE /api/research/chats/:id ──────────────────────────────────────────
router.delete("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    if (chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    await Chat.deleteOne({ _id: req.params.id });
    return res.json({ message: "Chat deleted.", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete chat." });
  }
});

// ─── POST /api/research/chats/:id/ask ────────────────────────────────────────
router.post("/chats/:id/ask", async (req, res) => {
  const { question, answer_style } = req.body;
  const { id } = req.params;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  try {
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    if (chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Save user message
    chat.messages.push({ role: "user", text: question.trim(), timestamp: new Date() });
    await chat.save();

    // Build conversation history (last 6 messages for context)
    const recentMessages = chat.messages.slice(-7, -1); // exclude the just-added user msg
    const history = recentMessages.map(m => ({
      role: m.role,
      text: (m.text || "").substring(0, 500), // truncate for efficiency
    }));

    // Forward to Python RAG with history + answer_style
    let answerText = "No response from service.";
    let sources = [];
    let webSources = [];
    let isWebFallback = false;
    let status = "answered";
    let refused = false;
    let timing = { embedMs: 0, searchMs: 0, rerankMs: 0, llmMs: 0, totalMs: 0 };

    try {
      const startTime = Date.now();
      const response = await axios.post(
        `${PYTHON_URL()}/query`,
        {
          question: question.trim(),
          top_k: 5,
          history: history.length > 0 ? history : null,
          answer_style: answer_style || "classical",
        },
        { timeout: 120000 }
      );
      timing.totalMs = Date.now() - startTime;

      answerText  = response.data.answer || response.data.response || "No answer provided.";
      sources     = response.data.sources || response.data.source_documents || [];
      webSources  = response.data.web_sources || [];
      isWebFallback = response.data.is_web_fallback || false;

      // Detect refused answers
      if (
        response.data.refused === true ||
        response.data.status === "refused" ||
        answerText.toLowerCase().includes("outside the scope") ||
        answerText.toLowerCase().includes("cannot answer")
      ) {
        status = "refused";
        refused = true;
      }

      // Extract timing if provided by Python
      if (response.data.timing) {
        Object.assign(timing, response.data.timing);
      }
    } catch (apiErr) {
      let clientError = "RAG service error.";
      if (apiErr.code === "ECONNREFUSED") {
        clientError = "RAG service is offline. Please ensure the Python backend is running.";
      } else if (apiErr.code === "ECONNABORTED") {
        clientError = "Request timed out. The document may require more processing time.";
      } else if (apiErr.response?.data?.detail) {
        clientError = apiErr.response.data.detail;
      }

      chat.messages.push({ role: "assistant", text: `⚠️ ${clientError}`, sources: [], webSources: [], isWebFallback: false, timestamp: new Date() });
      await chat.save();
      return res.json(chat);
    }

    // Save assistant message
    chat.messages.push({
      role: "assistant",
      text: answerText,
      sources,
      webSources,
      isWebFallback,
      timestamp: new Date()
    });
    await chat.save();

    // Save QueryLog
    await QueryLog.create({
      userId: req.user._id,
      userName: req.user.name,
      chatId: chat._id,
      question: question.trim(),
      answer: answerText,
      sources,
      status,
      refused,
      timing,
    });

    // Update user stats (fire and forget)
    User.findByIdAndUpdate(req.user._id, {
      $inc: { queryCount: 1 },
      lastActive: Date.now(),
    }).catch(() => {});

    return res.json(chat);
  } catch (err) {
    console.error("Ask error:", err.message);
    return res.status(500).json({ error: "Failed to process question." });
  }
});

// ─── POST /api/research/feedback/:chatId/:messageIndex ────────────────────────
router.post("/feedback/:chatId/:messageIndex", async (req, res) => {
  try {
    const { feedback } = req.body;
    const { chatId, messageIndex } = req.params;

    if (!["positive", "negative"].includes(feedback)) {
      return res.status(400).json({ error: "Feedback must be 'positive' or 'negative'." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    if (chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    const idx = parseInt(messageIndex);
    if (idx < 0 || idx >= chat.messages.length) {
      return res.status(400).json({ error: "Invalid message index." });
    }

    chat.messages[idx].feedback = feedback;
    await chat.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("Feedback error:", err.message);
    return res.status(500).json({ error: "Failed to save feedback." });
  }
});

// ─── POST /api/research/chats/:id/stream ────────────────────────────────────────
// Proxies SSE streaming from Python RAG with auth check + MongoDB persistence
router.post("/chats/:id/stream", async (req, res) => {
  const { id } = req.params;
  const { question, top_k, answer_style, history } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  let chat = null;
  let isNewChat = false;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      chat = await Chat.findById(id);
    }
    if (!chat) {
      isNewChat = true;
      chat = new Chat({
        userId: req.user._id,
        title: question.trim().substring(0, 45),
        messages: [],
      });
      await chat.save();
    } else if (chat.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }
  } catch (err) {
    console.error("Stream chat validation error:", err.message);
    return res.status(500).json({ error: "Failed to validate chat." });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Emit real chatId whenever current chat._id does not match requested param id
  if (chat._id.toString() !== id) {
    res.write(`data: ${JSON.stringify({ chatId: chat._id.toString(), chatTitle: chat.title })}\n\n`);
  }

  try {
    const appSettings = await AppSettings.findOne({ key: "global" }).lean();
    const maxTokens = appSettings?.data?.llm?.maxTokens ? parseInt(appSettings.data.llm.maxTokens) : 4000;

    const pyResponse = await axios.post(
      `${PYTHON_URL()}/stream`,
      {
        question: question.trim(),
        top_k: top_k || 8,
        answer_style: answer_style || "technical",
        history,
        max_tokens: maxTokens,
      },
      { responseType: "stream", timeout: 120000 }
    );

    let fullAnswer = "";
    let finalSources = [];
    let finalWebSources = [];
    let finalWebResults = [];
    let finalRagSourceDetails = [];
    let isRefused = false;

    pyResponse.data.on("data", (chunk) => {
      res.write(chunk);

      const str = chunk.toString();
      const lines = str.split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.replace("data: ", ""));
          if (data.token) fullAnswer += data.token;
          if (data.replace) { fullAnswer = data.replace; isRefused = true; }
          if (data.done) {
            finalSources = data.sources || [];
            finalWebSources = data.web_sources || [];
            finalWebResults = data.web_results || [];
            finalRagSourceDetails = data.rag_source_details || [];
            if (data.refused) isRefused = true;
          }
        } catch (_e) {}
      }
    });

    pyResponse.data.on("end", async () => {
      try {
        if (fullAnswer.trim()) {
          const lastUserMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
          if (!lastUserMsg || lastUserMsg.role !== "user" || lastUserMsg.text !== question.trim()) {
            chat.messages.push({ role: "user", text: question.trim(), timestamp: new Date() });
          }
          chat.messages.push({
            role: "assistant",
            text: fullAnswer.trim(),
            sources: finalSources,
            webSources: finalWebSources,
            webResults: finalWebResults,
            ragSourceDetails: finalRagSourceDetails,
            timestamp: new Date()
          });
          await chat.save();

          await QueryLog.create({
            userId: req.user._id,
            userName: req.user.name || "Unknown",
            chatId: chat._id,
            question: question.trim(),
            answer: fullAnswer.trim(),
            sources: finalSources,
            status: isRefused ? "refused" : "answered",
            refused: isRefused,
          });

          User.findByIdAndUpdate(req.user._id, {
            $inc: { queryCount: 1 },
            lastActive: Date.now(),
          }).catch(() => {});
        }
      } catch (saveErr) {
        console.error("Failed to save stream history:", saveErr.message);
      }

      res.end();
    });

    pyResponse.data.on("error", (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    let msg = "RAG stream service error.";
    if (err.code === "ECONNREFUSED") msg = "RAG service is offline. Please ensure Python backend is running.";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// ─── GET /api/research/health ─────────────────────────────────────────────────
router.get("/health", async (_req, res) => {
  try {
    const response = await axios.get(`${PYTHON_URL()}/health`, { timeout: 3000 });
    return res.json({ node: "ok", python: response.data.status || "ok", details: response.data });
  } catch (_e) {
    return res.json({ node: "ok", python: "unreachable" });
  }
});

module.exports = router;
