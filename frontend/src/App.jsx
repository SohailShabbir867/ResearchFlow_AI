import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { loadCurrentUser } from "./store/authSlice.js";

// ─── Pages ────────────────────────────────────────────────────────────────────
import Research    from "./pages/Research.jsx";
import Login       from "./pages/Login.jsx";
import SignUp      from "./pages/SignUp.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword  from "./pages/ResetPassword.jsx";
import VerifyEmail    from "./pages/VerifyEmail.jsx";
import Documents   from "./pages/Documents.jsx";
import UserProfile from "./pages/UserProfile.jsx";

// Admin pages (standalone with their own AdminSidebar embedded)
import AdminDashboard  from "./pages/AdminDashboard.jsx";
import UserManagement  from "./pages/UserManagement.jsx";
import DocumentManager from "./pages/DocumentManager.jsx";
import QueryAuditLog   from "./pages/QueryAuditLog.jsx";
import SystemSettings  from "./pages/SystemSettings.jsx";
import SystemHealth    from "./pages/SystemHealth.jsx";

// ─── Route Guards ─────────────────────────────────────────────────────────────

function PrivateRoute({ children }) {
  const { user, token, initializing } = useSelector(s => s.auth);
  const location = useLocation();

  if (initializing) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Loading MedResearch AI…</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, token, initializing } = useSelector(s => s.auth);
  const location = useLocation();

  if (initializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <div className="w-8 h-8 border-2 border-[#E21B70] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, token, initializing } = useSelector(s => s.auth);

  if (initializing) return null;
  if (token && user) return <Navigate to="/" replace />;
  return children;
}

// ─── App Init ─────────────────────────────────────────────────────────────────

function AppInit() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Restore session from localStorage on every app mount
    dispatch(loadCurrentUser());
  }, [dispatch]);

  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppInit />
          <Routes>
            {/* Public auth routes */}
            <Route
              path="/login"
              element={<PublicRoute><Login /></PublicRoute>}
            />
            <Route
              path="/signup"
              element={<PublicRoute><SignUp /></PublicRoute>}
            />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/forgot-password"     element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protected — Regular users */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Research />
                </PrivateRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <PrivateRoute>
                  <Documents />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <UserProfile />
                </PrivateRoute>
              }
            />

            {/* Admin-only routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/documents"
              element={
                <AdminRoute>
                  <DocumentManager />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <AdminRoute>
                  <QueryAuditLog />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <SystemSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/health"
              element={
                <AdminRoute>
                  <SystemHealth />
                </AdminRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
