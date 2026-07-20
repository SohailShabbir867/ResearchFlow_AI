const express = require("express");
const axios = require("axios");
const Chat = require("../models/Chat");
const router = express.Router();

const PYTHON_RAG_URL = process.env.PYTHON_RAG_URL || "http://localhost:8000";

// GET /api/research/chats
// Returns all chat sessions
router.get("/chats", async (req, res) => {
  try {
    const chats = await Chat.find({}, { messages: { $slice: -1 } })
      .sort({ updatedAt: -1 });
    
    // Format response to include simple details
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
// Create a new chat session
router.post("/chats", async (req, res) => {
  try {
    const { title } = req.body;
    const newChat = new Chat({
      title: title || "New Chat",
      messages: []
    });
    await newChat.save();
    return res.json(newChat);
  } catch (err) {
    console.error("Error creating chat:", err.message);
    return res.status(500).json({ error: "Failed to create new chat." });
  }
});

// GET /api/research/chats/:id
// Get a specific chat session with its messages
router.get("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: "Chat session not found." });
    }
    return res.json(chat);
  } catch (err) {
    console.error("Error getting chat details:", err.message);
    return res.status(500).json({ error: "Failed to load chat details." });
  }
});

// DELETE /api/research/chats/:id
// Delete a chat session
router.delete("/chats/:id", async (req, res) => {
  try {
    const chat = await Chat.findByIdAndDelete(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: "Chat session not found." });
    }
    return res.json({ message: "Chat session deleted successfully.", id: req.params.id });
  } catch (err) {
    console.error("Error deleting chat:", err.message);
    return res.status(500).json({ error: "Failed to delete chat session." });
  }
});

// POST /api/research/chats/:id/ask
// Send a question, save it to DB, query Python service, save AI answer, return complete session
router.post("/chats/:id/ask", async (req, res) => {
  const { question } = req.body;
  const { id } = req.params;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  try {
    // 1. Check if chat session exists
    const chat = await Chat.findById(id);
    if (!chat) {
      return res.status(404).json({ error: "Chat session not found." });
    }

    // 2. Append User question
    chat.messages.push({
      role: "user",
      text: question.trim(),
      timestamp: new Date()
    });

    // Save immediately so user input is not lost if LLM fails
    await chat.save();

    // 3. Forward to Python RAG service
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
      console.error("Python RAG Service Error:", apiErr.message);
      
      let clientError = "RAG service offline.";
      if (apiErr.code === "ECONNREFUSED") {
        clientError = "RAG service is offline. Please start uvicorn backend.";
      } else if (apiErr.code === "ECONNABORTED") {
        clientError = "RAG service timeout.";
      } else if (apiErr.response?.data?.detail) {
        clientError = apiErr.response.data.detail;
      }
      
      // Still push an assistant error message so the conversation can continue
      chat.messages.push({
        role: "assistant",
        text: `⚠️ Error: ${clientError}`,
        sources: [],
        timestamp: new Date()
      });
      await chat.save();

      return res.json(chat);
    }

    // 4. Update chat title if it's default
    if (chat.title === "New Chat" && chat.messages.length <= 2) {
      // Set title as the first 5 words of the question
      const words = question.trim().split(/\s+/);
      const titleCandidate = words.slice(0, 5).join(" ");
      chat.title = titleCandidate.length > 30 ? titleCandidate.substring(0, 30) + "..." : titleCandidate;
    }

    // 5. Append Assistant response
    chat.messages.push({
      role: "assistant",
      text: answerText,
      sources: sources,
      timestamp: new Date()
    });

    await chat.save();
    return res.json(chat);

  } catch (err) {
    console.error("Ask query error:", err.message);
    return res.status(500).json({ error: "Failed to process question." });
  }
});

// GET /api/research/health
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
      python: "unreachable"
    });
  }
});

module.exports = router;
