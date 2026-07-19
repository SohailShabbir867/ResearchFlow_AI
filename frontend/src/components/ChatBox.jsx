import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { askQuestion, clearMessages } from "../store/researchSlice.js";
import SourceCard from "./SourceCard.jsx";

export default function ChatBox() {
  const dispatch = useDispatch();
  const { messages, loading, error } = useSelector((s) => s.research);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    dispatch(askQuestion(input.trim()));
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <span className="text-2xl">🔬</span>
            </div>
            <p className="text-gray-500 text-sm">Ask any medical research question</p>
            <p className="text-gray-400 text-xs mt-1">Answers come from your indexed documents</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-white rounded-br-sm"
                : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
            }`}>
              <p>{msg.text}</p>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Sources
                  </p>
                  {msg.sources.map((src, j) => (
                    <SourceCard key={j} source={src} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-red-500 text-xs bg-red-50 rounded-lg py-2 px-4">
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 px-4 py-3 flex gap-3 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a medical question... (Enter to send)"
          rows={2}
          className="input-base resize-none flex-1"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="btn-primary shrink-0"
        >
          Ask
        </button>
      </div>

    </div>
  );
}
