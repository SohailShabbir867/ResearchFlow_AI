import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchChats, createChat, askQuestion, clearMessages } from "../store/researchSlice.js";
import Sidebar from "../components/layout/Sidebar.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import Badge from "../components/ui/Badge.jsx";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "What are the symptoms of Type 2 diabetes?",
  "List first-line treatments for hypertension",
  "Explain antibiotic resistance mechanisms",
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
    </div>
  );
}

function SourceChip({ source }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1
                     bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400
                     hover:border-[#E21B70]/30 hover:text-gray-200 transition-colors cursor-pointer">
      📄 {source.replace(/\.[^.]+$/, "").replace(/_/g, " ")}
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isRefused = msg.text?.includes("I can only answer questions based on");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const copy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-fade-in">
        <div className="max-w-[65%] px-4 py-3 rounded-2xl rounded-tr-md
                        bg-gradient-to-br from-[#E21B70] to-[#A53860]
                        text-white text-sm leading-relaxed shadow-glow-sm">
          {msg.text}
        </div>
        <Avatar name="Dr" size="sm"/>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      {/* AI avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-primary shrink-0
                      flex items-center justify-center text-sm glow-sm mt-0.5">
        🔬
      </div>

      <div className="flex-1 max-w-[80%]">
        {/* Bubble */}
        <div className={`px-5 py-4 rounded-2xl rounded-tl-md text-sm leading-relaxed
                         ${isRefused
                           ? "bg-amber-500/10 border border-amber-500/25 text-amber-200"
                           : "glass-card text-gray-100"}`}>
          {isRefused && (
            <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-semibold uppercase tracking-wide">
              <span>⚠</span> Outside document scope
            </div>
          )}

          <div className="prose prose-invert prose-sm max-w-none
                          prose-headings:text-white prose-headings:font-semibold
                          prose-strong:text-white prose-code:text-[#E21B70]
                          prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
                          prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
                          prose-ul:text-gray-300 prose-ol:text-gray-300">
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>
        </div>

        {/* Sources */}
        {msg.sources?.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-600 uppercase font-semibold tracking-wider">
              Sources
            </span>
            {msg.sources.map((s, i) => <SourceChip key={i} source={s}/>)}
          </div>
        )}

        {/* Actions */}
        {!isRefused && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100
                          hover:opacity-100 transition-opacity">
            <button onClick={copy}
                    className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
            <button onClick={() => setFeedback("up")}
                    className={`btn-ghost text-xs py-1 px-2 ${feedback==="up"?"text-emerald-400":""}`}>
              👍
            </button>
            <button onClick={() => setFeedback("down")}
                    className={`btn-ghost text-xs py-1 px-2 ${feedback==="down"?"text-red-400":""}`}>
              👎
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Research() {
  const dispatch  = useDispatch();
  const { messages, loading, currentChatId, chatList } = useSelector(s => s.research);
  const [input, setInput]       = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { dispatch(fetchChats()); }, [dispatch]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    if (!currentChatId) {
      dispatch(createChat("New Chat")).then(a => {
        dispatch(askQuestion({ chatId: a.payload._id, question }));
      });
    } else {
      dispatch(askQuestion({ chatId: currentChatId, question }));
    }
  };

  return (
    <div className="flex h-screen bg-[#0F0A1E] overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}/>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4
                           border-b border-white/5 bg-[#0F0A1E]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-bold text-white">Research Chat</h1>
              <div className="flex items-center gap-1.5">
                <span className="status-online"/>
                <p className="text-[10px] text-gray-500 font-mono">
                  Groq · Qdrant · Hybrid Search
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="ghost">
              <span className="status-online mr-1"/>
              RAG Online
            </Badge>
            <button onClick={() => dispatch(clearMessages())} className="btn-ghost text-xs">
              Clear
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-primary
                              flex items-center justify-center text-4xl mb-6 glow-primary
                              animate-pulse-glow">
                🔬
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">What would you like to research?</h2>
              <p className="text-gray-500 text-sm mb-8 max-w-sm">
                Answers come only from your indexed medical documents
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button key={s}
                          onClick={() => { setInput(s); inputRef.current?.focus(); }}
                          className="px-4 py-2.5 glass-card hover:border-[#E21B70]/30
                                     text-sm text-gray-300 hover:text-white rounded-xl
                                     transition-all duration-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="group">
              <Message msg={msg}/>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-gradient-primary shrink-0
                              flex items-center justify-center text-sm glow-sm">
                🔬
              </div>
              <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-md">
                <TypingDots/>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input bar */}
        <div className="border-t border-white/5 px-6 py-4 bg-[#0F0A1E]/80 backdrop-blur-sm shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask a medical research question..."
                rows={1}
                disabled={loading}
                className="input-base resize-none pr-4 py-3.5 min-h-[52px] max-h-40
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ lineHeight: "1.5" }}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
              />
            </div>
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="btn-primary h-[52px] px-6 shrink-0 flex items-center gap-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <span className="text-lg">↑</span>}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-2">
            Enter to send · Shift+Enter for new line · Answers from documents only
          </p>
        </div>
      </div>
    </div>
  );
}
