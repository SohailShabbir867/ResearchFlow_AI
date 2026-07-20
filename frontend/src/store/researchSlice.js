import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Fetch list of all chat sessions
export const fetchChats = createAsyncThunk(
  "research/fetchChats",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/research/chats");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load previous chats."
      );
    }
  }
);

// Create a new chat session
export const createChat = createAsyncThunk(
  "research/createChat",
  async (title, { rejectWithValue }) => {
    try {
      const res = await axios.post("/api/research/chats", { title });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to start a new chat."
      );
    }
  }
);

// Load details/messages of a specific chat session
export const fetchChatDetails = createAsyncThunk(
  "research/fetchChatDetails",
  async (chatId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`/api/research/chats/${chatId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load chat conversation."
      );
    }
  }
);

// Delete a chat session
export const deleteChat = createAsyncThunk(
  "research/deleteChat",
  async (chatId, { rejectWithValue }) => {
    try {
      const res = await axios.delete(`/api/research/chats/${chatId}`);
      return res.data; // { message, id }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to delete chat session."
      );
    }
  }
);

// Ask question inside an active chat session
export const askQuestion = createAsyncThunk(
  "research/askQuestion",
  async ({ chatId, question }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`/api/research/chats/${chatId}/ask`, { question });
      return res.data; // Returns updated Chat object
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.error || "Server error. Is Node.js running?"
      );
    }
  }
);

const researchSlice = createSlice({
  name: "research",
  initialState: {
    chats: [],           // List of previous chats
    currentChatId: null, // Active chat session ID
    messages: [],        // Messages in active session
    loading: false,
    error: null,
  },
  reducers: {
    clearMessages(state) {
      state.messages = [];
      state.error = null;
    },
    setCurrentChatId(state, action) {
      state.currentChatId = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Chats
      .addCase(fetchChats.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.chats = action.payload;
        // If there is no active chat but we have previous chats, set current to the first one
        if (!state.currentChatId && action.payload.length > 0) {
          state.currentChatId = action.payload[0]._id;
        }
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Create Chat
      .addCase(createChat.fulfilled, (state, action) => {
        state.chats.unshift({
          _id: action.payload._id,
          title: action.payload.title,
          updatedAt: action.payload.updatedAt,
          createdAt: action.payload.createdAt,
          lastMessage: ""
        });
        state.currentChatId = action.payload._id;
        state.messages = [];
        state.error = null;
      })

      // Fetch Chat Details
      .addCase(fetchChatDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChatDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.messages || [];
        state.currentChatId = action.payload._id;
      })
      .addCase(fetchChatDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Chat
      .addCase(deleteChat.fulfilled, (state, action) => {
        state.chats = state.chats.filter(c => c._id !== action.payload.id);
        if (state.currentChatId === action.payload.id) {
          if (state.chats.length > 0) {
            state.currentChatId = state.chats[0]._id;
          } else {
            state.currentChatId = null;
            state.messages = [];
          }
        }
      })

      // Ask Question
      .addCase(askQuestion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.messages.push({
          role: "user",
          text: action.meta.arg.question,
          timestamp: new Date().toISOString()
        });
      })
      .addCase(askQuestion.fulfilled, (state, action) => {
        state.loading = false;
        // The endpoint returns the updated chat object
        state.messages = action.payload.messages;
        
        // Update the title and lastMessage of the chat in the sidebar list
        const idx = state.chats.findIndex(c => c._id === action.payload._id);
        if (idx !== -1) {
          state.chats[idx].title = action.payload.title;
          state.chats[idx].lastMessage = action.payload.messages[action.payload.messages.length - 1]?.text || "";
          state.chats[idx].updatedAt = action.payload.updatedAt;
          
          // Re-sort chats list by updatedAt
          state.chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
      })
      .addCase(askQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearMessages, setCurrentChatId } = researchSlice.actions;
export default researchSlice.reducer;
