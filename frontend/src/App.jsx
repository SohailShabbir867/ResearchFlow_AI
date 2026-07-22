import { BrowserRouter, Routes, Route } from "react-router-dom";
import Research from "./pages/Research.jsx";
import Login from "./pages/Login.jsx";
import Documents from "./pages/Documents.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Research />} />
        <Route path="/login" element={<Login />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
