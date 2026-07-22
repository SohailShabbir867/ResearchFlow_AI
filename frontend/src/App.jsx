import { BrowserRouter, Routes, Route } from "react-router-dom";
import Research from "./pages/Research.jsx";
import Login from "./pages/Login.jsx";
import Documents from "./pages/Documents.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import DocumentManager from "./pages/DocumentManager.jsx";
import QueryAuditLog from "./pages/QueryAuditLog.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Research />} />
        <Route path="/login" element={<Login />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/documents" element={<DocumentManager />} />
        <Route path="/admin/logs" element={<QueryAuditLog />} />
      </Routes>
    </BrowserRouter>
  );
}
