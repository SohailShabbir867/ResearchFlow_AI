import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { askQuestion, createChat } from "../store/researchSlice.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Markdown component map ─────────────────────────────────── */
const mdComponents = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-primary/20">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-primary mt-5 mb-2 flex items-center gap-2">
      <span className="w-1 h-5 bg-primary rounded-full inline-block shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-700 leading-relaxed mb-3 text-sm">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-3 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-3 pl-4 list-decimal marker:text-primary marker:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-600">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 bg-primary/5 rounded-r-lg pl-4 pr-3 py-2 my-3 text-sm text-gray-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-gray-100 text-primary font-mono text-xs px-1.5 py-0.5 rounded">
        {children}
      </code>
    ) : (
      <pre className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-3 my-3 overflow-x-auto">
        <code>{children}</code>
      </pre>
    ),
  hr: () => <hr className="border-gray-200 my-4" />,
};

/* ── Typing animation ───────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 bg-primary rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

/* ── Source badge ───────────────────────────────────────────── */
function SourceBadge({ source }) {
  const name = source.replace(/\.[^/.]+$/, ""); // strip extension
  return (
    <span className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/20
                     text-primary text-xs font-medium px-2.5 py-1 rounded-full">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
      </svg>
      {name}
    </span>
  );
}

/* ── Main ChatBox ───────────────────────────────────────────── */
export default function ChatBox() {
  const dispatch = useDispatch();
  const { currentChatId, messages, loading, error } = useSelector((s) => s.research);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    let activeChatId = currentChatId;

    // If no active chat session, create one first in MongoDB
    if (!activeChatId) {
      const resultAction = await dispatch(createChat("New Chat"));
      if (createChat.fulfilled.match(resultAction)) {
        activeChatId = resultAction.payload._id;
      } else {
        return; // failed to create chat
      }
    }

    dispatch(askQuestion({ chatId: activeChatId, question: input.trim() }));
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark
                            flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-3xl">🔬</span>
            </div>
            <div>
              <p className="text-gray-700 font-semibold text-base">Medical Research Assistant</p>
              <p className="text-gray-400 text-sm mt-1 flex flex-col gap-0.5">
                <span>Ask any question — answers come from your indexed documents</span>
                <span className="text-xs text-primary/70 font-semibold">Saved locally to MongoDB</span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-2 w-full max-w-sm">
              {["What is Chronic Kidney Disease?", "List diabetes medications", "Explain heart disease risk factors"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-left text-xs text-gray-500 bg-white border border-gray-200 rounded-xl
                             px-4 py-2.5 hover:border-primary hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

            {/* AI avatar */}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark
                              flex items-center justify-center shrink-0 shadow-sm mt-1">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
            )}

            <div className={`max-w-2xl ${msg.role === "user" ? "max-w-sm" : "w-full"}`}>
              {/* Bubble */}
              <div className={`rounded-2xl px-5 py-4 ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary-dark text-white rounded-tr-sm shadow-md shadow-primary/20"
                  : "bg-white border border-gray-100 rounded-tl-sm shadow-sm"
              }`}>
                {msg.role === "user" ? (
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                ) : (
                  <div className="prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={mdComponents}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Sources */}
              {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 px-1">
                  <span className="text-xs text-gray-400 self-center">Sources:</span>
                  {msg.sources.map((src, j) => (
                    <SourceBadge key={j} source={src} />
                  ))}
                </div>
              )}
            </div>

            {/* User avatar */}
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center shrink-0 mt-1">
                <span className="text-gray-600 text-xs font-bold">You</span>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark
                            flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-red-400">⚠️</span>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a medical research question… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                       focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10
                       transition-all placeholder-gray-400 bg-gray-50 focus:bg-white"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="shrink-0 bg-gradient-to-br from-primary to-primary-dark text-white
                       px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/25
                       hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                       transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 pl-1">
          Powered by Groq LLaMA 3.3 70B · Local RAG · {" "}
          <span className="text-primary font-medium">Hybrid Search</span>
        </p>
      </div>
    </div>
  );
}
