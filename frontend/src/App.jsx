import { BrowserRouter, Routes, Route } from "react-router-dom";
import Research from "./pages/Research.jsx";
import Login from "./pages/Login.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Research />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
