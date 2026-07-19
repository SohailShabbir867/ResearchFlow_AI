import { useDispatch } from "react-redux";
import { clearMessages } from "../store/researchSlice.js";
import ChatBox from "../components/ChatBox.jsx";

export default function Research() {
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">MedResearch AI</h1>
            <p className="text-xs text-gray-400">Ollama + Qdrant RAG</p>
          </div>
        </div>

        <button
          onClick={() => dispatch(clearMessages())}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200
                     px-3 py-1.5 rounded-lg transition-colors"
        >
          Clear
        </button>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatBox />
      </div>

    </div>
  );
}
