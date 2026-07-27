import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = "/api/research";

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchChats = createAsyncThunk("research/fetchChats", async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${API}/chats`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to load chats.");
  }
});

export const createChat = createAsyncThunk("research/createChat", async (title, { rejectWithValue }) => {
  try {
    const res = await axios.post(`${API}/chats`, { title });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to create chat.");
  }
});

export const loadChat = createAsyncThunk("research/loadChat", async (chatId, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${API}/chats/${chatId}`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to load chat.");
  }
});

export const deleteChat = createAsyncThunk("research/deleteChat", async (chatId, { rejectWithValue }) => {
  try {
    await axios.delete(`${API}/chats/${chatId}`);
    return chatId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to delete chat.");
  }
});

export const askQuestion = createAsyncThunk(
  "research/askQuestion",
  async ({ chatId, question, answer_style }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${API}/chats/${chatId}/ask`,
        { question, answer_style: answer_style || "classical" },
        { timeout: 120000 }
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Server error.");
    }
  }
);

// ─── Streaming thunk (Fix #5) ─────────────────────────────────────────────────
// Uses fetch() + ReadableStream to consume SSE tokens one by one.
// Dispatches appendStreamToken on each token, then finalizeStream with sources.

export const askQuestionStream = (chatId, question, answer_style = "classical") => async (dispatch, getState) => {
  // Push user message immediately
  dispatch(pushUserMessage(question));
  // Open a blank assistant message to stream into
  dispatch(openAssistantMessage());

  // Build conversation history from current messages for context
  const { messages } = getState().research;
  const recentMsgs = messages.slice(-7, -1); // exclude the just-pushed user msg
  const history = recentMsgs.length > 0
    ? recentMsgs.map(m => ({ role: m.role, text: (m.text || "").substring(0, 500) }))
    : null;

  // Get JWT token for auth header
  const token = localStorage.getItem("medresearch_token");

  try {
    const response = await fetch(`/api/research/chats/${chatId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, top_k: 5, answer_style, history })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Stream request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      // SSE lines: "data: {...}\n\n"
      const lines = text.split("\n").filter(l => l.startsWith("data: "));

      for (const line of lines) {
        try {
          const payload = JSON.parse(line.replace("data: ", ""));

          if (payload.error) {
            dispatch(streamError(payload.error));
            return;
          }

          if (payload.replace) {
            // Layer 3 guardrail: replace streamed text with refusal
            dispatch(replaceStreamText(payload.replace));
          }

          if (payload.done) {
            dispatch(finalizeStream({ sources: payload.sources || [], refused: payload.refused || false }));
            return;
          }

          if (payload.token) {
            dispatch(appendStreamToken(payload.token));
          }
        } catch (_e) {
          // Ignore malformed lines
        }
      }
    }
  } catch (err) {
    dispatch(streamError(err.message || "Streaming failed."));
  }
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const researchSlice = createSlice({
  name: "research",
  initialState: {
    // Sidebar
    chatList: [],
    chatListLoading: false,

    // Active chat
    currentChatId: null,
    messages: [],        // { role, text, sources? }
    loading: false,
    streaming: false,    // true while stream is active
    error: null
  },

  reducers: {
    clearMessages(state) {
      state.messages = [];
      state.error = null;
      state.currentChatId = null;
    },

    setCurrentChatId(state, action) {
      state.currentChatId = action.payload;
    },

    // Streaming reducers
    pushUserMessage(state, action) {
      state.messages.push({ role: "user", text: action.payload });
      state.streaming = true;
      state.error = null;
    },

    openAssistantMessage(state) {
      // Add empty assistant message — tokens will be appended here
      state.messages.push({ role: "assistant", text: "", sources: [] });
    },

    appendStreamToken(state, action) {
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant") {
        last.text += action.payload;
      }
    },

    replaceStreamText(state, action) {
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant") {
        last.text = action.payload;
        last.isRefused = true;
      }
    },

    finalizeStream(state, action) {
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant") {
        last.sources = action.payload.sources || action.payload;
        if (action.payload.refused) last.isRefused = true;
      }
      state.streaming = false;
    },

    streamError(state, action) {
      state.streaming = false;
      state.error = action.payload;
      // Remove the empty assistant placeholder
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant" && last.text === "") {
        state.messages.pop();
      }
    }
  },

  extraReducers: (builder) => {
    // fetchChats
    builder
      .addCase(fetchChats.pending, (state) => { state.chatListLoading = true; })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.chatListLoading = false;
        state.chatList = action.payload;
      })
      .addCase(fetchChats.rejected, (state) => { state.chatListLoading = false; });

    // createChat
    builder.addCase(createChat.fulfilled, (state, action) => {
      state.chatList.unshift(action.payload);
      state.currentChatId = action.payload._id;
      state.messages = [];
    });

    // loadChat
    builder.addCase(loadChat.fulfilled, (state, action) => {
      state.currentChatId = action.payload._id;
      state.messages = action.payload.messages.map(m => ({
        role: m.role,
        text: m.text,
        sources: m.sources || []
      }));
    });

    // deleteChat
    builder.addCase(deleteChat.fulfilled, (state, action) => {
      state.chatList = state.chatList.filter(c => c._id !== action.payload);
      if (state.currentChatId === action.payload) {
        state.currentChatId = null;
        state.messages = [];
      }
    });

    // askQuestion (standard)
    builder
      .addCase(askQuestion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.messages.push({ role: "user", text: action.meta.arg.question });
      })
      .addCase(askQuestion.fulfilled, (state, action) => {
        state.loading = false;
        const msgs = action.payload.messages;
        // Replace local messages with the server-saved version
        state.messages = msgs.map(m => ({
          role: m.role,
          text: m.text,
          sources: m.sources || []
        }));
        // Update chat title in sidebar
        const idx = state.chatList.findIndex(c => c._id === action.payload._id);
        if (idx !== -1) state.chatList[idx].title = action.payload.title;
      })
      .addCase(askQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  clearMessages,
  setCurrentChatId,
  pushUserMessage,
  openAssistantMessage,
  appendStreamToken,
  replaceStreamText,
  finalizeStream,
  streamError
} = researchSlice.actions;

export default researchSlice.reducer;
