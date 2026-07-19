import { BrowserRouter, Routes, Route } from "react-router-dom";
import Research from "./pages/Research.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Research />} />
      </Routes>
    </BrowserRouter>
  );
}
