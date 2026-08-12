import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = "/api/auth";

// Ensure cross-origin / same-origin requests carry httpOnly auth cookies
axios.defaults.withCredentials = true;

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
      // Clean up legacy localStorage tokens
      localStorage.removeItem("researchflow_token");
      localStorage.removeItem("medresearch_token");
      if (token) setAxiosAuth(token);
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
    } catch (_e) {
      // Ignore server errors — always clear client state
    } finally {
      localStorage.removeItem("researchflow_token");
      localStorage.removeItem("medresearch_token");
      setAxiosAuth(null);
    }
  }
);

export const loadCurrentUser = createAsyncThunk(
  "auth/loadCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      // Check legacy token if present
      const legacyToken = localStorage.getItem("researchflow_token") || localStorage.getItem("medresearch_token");
      if (legacyToken) {
        setAxiosAuth(legacyToken);
      }
      const res = await axios.get(`${API}/me`);
      return { user: res.data };
    } catch (err) {
      localStorage.removeItem("researchflow_token");
      localStorage.removeItem("medresearch_token");
      setAxiosAuth(null);
      return rejectWithValue(err.response?.data?.error || "Session expired.");
    }
  }
);

export const signupUser = createAsyncThunk(
  "auth/signupUser",
  async ({ name, email, password, specialty }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/signup`, { name, email, password, specialty });
      return res.data; // { message, email }
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Signup failed. Please try again.");
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async ({ email }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/forgot-password`, { email });
      return res.data; // { message }
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to send reset email.");
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/reset-password/${token}`, { password });
      return res.data; // { message }
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Password reset failed.");
    }
  }
);

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/change-password`, { currentPassword, newPassword });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Failed to change password.");
    }
  }
);

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (updates, { rejectWithValue }) => {
    try {
      const res = await axios.patch(`${API}/profile`, updates);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || "Profile update failed.");
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    loading: false,
    initializing: true,
    error: null,
    emailSent: false,     // signup/forgot-password email sent
    resetDone: false,     // password reset completed
    signupDone: false,    // signup completed (waiting for verification)
  },

  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    clearFlags(state) {
      state.emailSent  = false;
      state.resetDone  = false;
      state.signupDone = false;
      state.error      = null;
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
      .addCase(updateProfile.pending, (state) => { state.loading = true; })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = { ...state.user, ...action.payload };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── signupUser ─────────────────────────────────────────────────────────
    builder
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.signupDone = false;
      })
      .addCase(signupUser.fulfilled, (state) => {
        state.loading = false;
        state.signupDone = true;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── forgotPassword ─────────────────────────────────────────────────────
    builder
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.emailSent = false;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
        state.emailSent = true;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── resetPassword ──────────────────────────────────────────────────────
    builder
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.resetDone = false;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
        state.resetDone = true;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── changePassword ─────────────────────────────────────────────────────
    builder
      .addCase(changePassword.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(changePassword.fulfilled, (state) => { state.loading = false; })
      .addCase(changePassword.rejected,  (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { clearAuthError, clearFlags, setUser } = authSlice.actions;
export default authSlice.reducer;
