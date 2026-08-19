const mongoose = require("mongoose");

const QueryLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  userName: {
    type: String,
    default: "Unknown",
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    default: null,
  },
  question: {
    type: String,
    required: [true, "Question is required"],
  },
  answer: {
    type: String,
    default: "",
  },
  sources: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  status: {
    type: String,
    enum: ["answered", "refused"],
    default: "answered",
  },
  refused: {
    type: Boolean,
    default: false,
  },
  provider: {
    type: String,
    default: "groq",
  },
  model: {
    type: String,
    default: "openai/gpt-oss-120b",
  },
  timing: {
    embedMs:  { type: Number, default: 0 },
    searchMs: { type: Number, default: 0 },
    rerankMs: { type: Number, default: 0 },
    llmMs:    { type: Number, default: 0 },
    totalMs:  { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
QueryLogSchema.index({ createdAt: -1 });
QueryLogSchema.index({ userId: 1 });
QueryLogSchema.index({ status: 1 });

module.exports = mongoose.model("QueryLog", QueryLogSchema);
