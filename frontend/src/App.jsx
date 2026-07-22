import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import Research from "./pages/Research.jsx";
import Login from "./pages/Login.jsx";
import Documents from "./pages/Documents.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import DocumentManager from "./pages/DocumentManager.jsx";
import QueryAuditLog from "./pages/QueryAuditLog.jsx";
import SystemSettings from "./pages/SystemSettings.jsx";
import SystemHealth from "./pages/SystemHealth.jsx";
import UserProfile from "./pages/UserProfile.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Research />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/documents" element={<DocumentManager />} />
          <Route path="/admin/logs" element={<QueryAuditLog />} />
          <Route path="/admin/settings" element={<SystemSettings />} />
          <Route path="/admin/health" element={<SystemHealth />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
