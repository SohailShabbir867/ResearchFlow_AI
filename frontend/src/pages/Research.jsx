import { useDispatch } from "react-redux";
import { clearMessages } from "../store/researchSlice.js";
import ChatBox from "../components/ChatBox.jsx";

export default function Research() {
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col h-screen bg-gray-100/40">
      {/* Premium Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 shadow-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark
                            flex items-center justify-center shadow-md shadow-primary/20">
              <span className="text-white text-base font-bold">🔬</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">
                MedResearch AI
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs text-gray-400 font-medium">
                  FastEmbed + Qdrant Hybrid RAG &middot; Groq LLaMA 70B
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch(clearMessages())}
              className="text-xs font-semibold text-gray-500 hover:text-primary bg-white hover:bg-primary/5
                         border border-gray-200 hover:border-primary/30 px-3.5 py-2 rounded-xl transition-all"
            >
              Clear Conversation
            </button>
          </div>
        </div>
      </header>

      {/* Main chat window container */}
      <main className="flex-grow flex justify-center overflow-hidden">
        <div className="w-full max-w-5xl bg-white md:border-x md:border-gray-100 flex flex-col h-full shadow-sm">
          <ChatBox />
        </div>
      </main>
    </div>
  );
}
