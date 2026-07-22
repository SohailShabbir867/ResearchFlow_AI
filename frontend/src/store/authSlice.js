import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = "/api/auth";

// ─── Helper: set auth header ──────────────────────────────────────────────────
function setAxiosAuth(token) {
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common["Authorization"];
  }
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/login`, { email, password });
      const { token, user } = res.data;
      localStorage.setItem("medresearch_token", token);
      setAxiosAuth(token);
      return { token, user };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Login failed. Please try again.");
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(`${API}/logout`);
    } catch {
      // Ignore server errors — always clear client state
    } finally {
      localStorage.removeItem("medresearch_token");
      setAxiosAuth(null);
    }
  }
);

export const loadCurrentUser = createAsyncThunk(
  "auth/loadCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("medresearch_token");
      if (!token) {
        return rejectWithValue("No token found.");
      }
      setAxiosAuth(token);
      const res = await axios.get(`${API}/me`);
      return { token, user: res.data };
    } catch (err) {
      localStorage.removeItem("medresearch_token");
      setAxiosAuth(null);
      return rejectWithValue(err.response?.data?.error || "Session expired.");
    }
  }
);

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (updates, { rejectWithValue }) => {
    try {
      // Profile update goes through admin patch endpoint when admin,
      // or a future /api/auth/profile endpoint — for now reload user
      const res = await axios.get(`${API}/me`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Update failed.");
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    loading: false,       // login/logout in progress
    initializing: true,   // true until loadCurrentUser resolves on app mount
    error: null,
  },

  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    setUser(state, action) {
      state.user = action.payload;
    },
  },

  extraReducers: (builder) => {
    // ── loginUser ──────────────────────────────────────────────────────────
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── logoutUser ─────────────────────────────────────────────────────────
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.error = null;
      });

    // ── loadCurrentUser ────────────────────────────────────────────────────
    builder
      .addCase(loadCurrentUser.pending, (state) => {
        state.initializing = true;
        state.error = null;
      })
      .addCase(loadCurrentUser.fulfilled, (state, action) => {
        state.initializing = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loadCurrentUser.rejected, (state) => {
        state.initializing = false;
        state.token = null;
        state.user = null;
      });

    // ── updateProfile ──────────────────────────────────────────────────────
    builder
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = { ...state.user, ...action.payload };
      });
  },
});

export const { clearAuthError, setUser } = authSlice.actions;
export default authSlice.reducer;
