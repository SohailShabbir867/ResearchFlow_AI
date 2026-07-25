const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  sources: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  feedback: {
    type: String,
    enum: ["positive", "negative", null],
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    default: "New Chat",
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt on save + auto-title from first user message
ChatSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Auto-title: take first 5 words of first user message if title is default
  if (this.title === "New Chat" && this.messages && this.messages.length > 0) {
    const firstUserMsg = this.messages.find(m => m.role === "user");
    if (firstUserMsg && firstUserMsg.text) {
      const words = firstUserMsg.text.trim().split(/\s+/).slice(0, 5).join(" ");
      this.title = words.length > 40 ? words.substring(0, 40) + "..." : words;
    }
  }

  next();
});

// Index for efficient queries
ChatSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", ChatSchema);
