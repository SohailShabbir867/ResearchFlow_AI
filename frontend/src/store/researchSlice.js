import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Vite proxy forwards /api → http://localhost:5000
// So no need to hardcode port in frontend
export const askQuestion = createAsyncThunk(
  "research/askQuestion",
  async (question, { rejectWithValue }) => {
    try {
      const res = await axios.post("/api/research/ask", { question });
      return res.data;
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
    messages: [],   // { role: "user"|"assistant", text, sources? }
    loading: false,
    error: null
  },
  reducers: {
    clearMessages(state) {
      state.messages = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(askQuestion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        // Push user message immediately so UI feels fast
        state.messages.push({
          role: "user",
          text: action.meta.arg
        });
      })
      .addCase(askQuestion.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push({
          role: "assistant",
          text: action.payload.answer,
          sources: action.payload.sources || []
        });
      })
      .addCase(askQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearMessages } = researchSlice.actions;
export default researchSlice.reducer;
