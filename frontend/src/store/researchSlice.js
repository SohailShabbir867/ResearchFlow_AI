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
        { question, answer_style: answer_style || "technical" },
        { timeout: 120000 }
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Server error.");
    }
  }
);

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
  setCurrentChatId
} = researchSlice.actions;

export default researchSlice.reducer;
