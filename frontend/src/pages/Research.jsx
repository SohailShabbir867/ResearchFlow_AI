import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  FileText,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  FolderOpen,
  Menu,
  Upload,
  MessageSquare,
  Crown,
  CheckCircle2,
  X,
  Globe,
  Microscope,
} from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

/* ─── Suggestion Prompts (shown on empty chat state) ─────────────── */
const SUGGESTIONS = [
  "Explain how a buffer overflow exploit works and write a Python PoC",
  "What is SQL injection? Show payloads in Python, Bash, and SQLmap",
  "How does a reverse shell work? Give me Bash, Python, and PowerShell examples",
  "Explain privilege escalation on Linux with step-by-step enumeration commands",
];

/* ─── Detail Levels → mapped to backend answer_style values ─────── */
const DETAIL_LEVELS = [
  { label: "Short", value: "short" },
  { label: "Technical", value: "technical" },
  { label: "Detailed", value: "detailed" },
  { label: "Case Study Mode", value: "case_study" },
  { label: "Code / Script", value: "code" },
];

/* ─── Markdown renderer config ──────────────────────────────────────
   Renders the streamed LLM answer with proper headings, sub-headings,
   lists, bold/italic, code, blockquotes and tables. A blinking caret is
   shown while the message is still streaming to reinforce the typewriter
   effect.
*/
const mdComponents = (streaming) => ({
  h1: ({ children }) => (
    <h1 className="chat-h1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="chat-h2">
      <span className="chat-h2-bar" />
      <span>{children}</span>
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="chat-h3">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="chat-h4">{children}</h4>
  ),
  p: ({ children }) => {
    // For the very last paragraph of a streaming message, append the caret.
    return <p className="chat-p">{children}{streaming && <span className="stream-caret" />}</p>;
  },
  ul: ({ children }) => <ul className="chat-ul">{children}</ul>,
  ol: ({ children }) => <ol className="chat-ol">{children}</ol>,
  li: ({ children, ...props }) => {
    // remark-gfm marks task list items with a checkbox child
    const isTask = props.checked !== null && props.checked !== undefined;
    if (isTask) {
      return <li className="chat-li chat-task">{children}</li>;
    }
    return (
      <li className="chat-li">
        <span className="chat-li-dot" />
        <span className="chat-li-text">{children}</span>
      </li>
    );
  },
  strong: ({ children }) => <strong className="chat-strong">{children}</strong>,
  em: ({ children }) => <em className="chat-em">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="chat-quote">{children}</blockquote>
  ),
  hr: () => <hr className="chat-hr" />,
  a: ({ children, href }) => (
    <a className="chat-link" href={href} target="_blank" rel="noreferrer">{children}</a>
  ),
  code: ({ inline, children, className }) =>
    inline ? (
      <code className="chat-code-inline">{children}</code>
    ) : (
      <CodeBlock className={className}>{children}</CodeBlock>
    ),
  table: ({ children }) => (
    <div className="chat-table-wrap">
      <table className="chat-table">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="chat-th">{children}</th>,
  td: ({ children }) => <td className="chat-td">{children}</td>,
});

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const rawCode  = String(children || "").replace(/\n$/, "");

  // Detect language from className (e.g. "language-python" → "python")
  const langRaw  = (className || "").replace("language-", "").trim();
  const language = langRaw || "text";

  // Friendly display label for the language badge
  const LANG_LABELS = {
    python: "Python", py: "Python",
    bash: "Bash", sh: "Bash", shell: "Shell",
    javascript: "JavaScript", js: "JavaScript",
    typescript: "TypeScript", ts: "TypeScript",
    c: "C", cpp: "C++", "c++": "C++",
    go: "Go", rust: "Rust", ruby: "Ruby",
    sql: "SQL", powershell: "PowerShell", ps1: "PowerShell",
    assembly: "Assembly", asm: "Assembly", nasm: "NASM",
    json: "JSON", yaml: "YAML", toml: "TOML",
    html: "HTML", css: "CSS", xml: "XML",
    java: "Java", kotlin: "Kotlin", swift: "Swift",
    php: "PHP", csharp: "C#", "c#": "C#",
    dockerfile: "Dockerfile", makefile: "Makefile",
  };
  const langLabel = LANG_LABELS[language.toLowerCase()] || language.toUpperCase();

  // Brand color for the language badge
  const LANG_COLORS = {
    python: "#3B82F6", bash: "#10B981", sh: "#10B981", shell: "#10B981",
    javascript: "#F59E0B", typescript: "#06B6D4",
    c: "#6366F1", cpp: "#8B5CF6", go: "#22D3EE",
    rust: "#F97316", ruby: "#EF4444", sql: "#14B8A6",
    powershell: "#A78BFA", assembly: "#EC4899", nasm: "#EC4899",
  };
  const badgeColor = LANG_COLORS[language.toLowerCase()] || "#9CA3AF";

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden shadow-lg" style={{ border: `1px solid ${badgeColor}30` }}>
      {/* Header bar with language badge + copy button */}
      <div className="flex items-center justify-between px-4 py-2 select-none" style={{ background: "#161B22", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-[11px] font-bold uppercase tracking-widest font-mono" style={{ color: badgeColor }}>
          {langLabel}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer"
          style={{ color: copied ? "#10B981" : "#8B949E", background: copied ? "rgba(16,185,129,0.1)" : "transparent" }}
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5" /><span className="font-semibold">Copied!</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
          )}
        </button>
      </div>

      {/* Syntax-highlighted code */}
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        showLineNumbers={rawCode.split("\n").length > 4}
        lineNumberStyle={{ color: "#4B5563", fontSize: "11px", minWidth: "2.5em" }}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "12.5px",
          lineHeight: "1.65",
          background: "#0D1117",
          padding: "1rem 1.25rem",
        }}
        codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" } }}
        wrapLongLines={false}
      >
        {rawCode}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownContent({ text, streaming = false }) {
  return (
    <div className="prose-chat max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={mdComponents(streaming)}
      >
        {text || (streaming ? "" : "")}
      </ReactMarkdown>
      {/* Caret shows up when streaming hasn't emitted a paragraph yet */}
      {streaming && (!text || !text.trim()) && (
        <span className="stream-caret" />
      )}
    </div>
  );
}

export default function Research() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(s => s.auth.user);

  const isAdmin = user?.role === "admin";
  const [isPro, setIsPro] = useState(isAdmin || user?.canUploadDocuments || false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  const canUpload = isAdmin || isPro || user?.canUploadDocuments;
  const userInitials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
    : "U";

  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState(null);

  // Chat data — start empty, populated as user creates chats
  const [chats, setChats] = useState({ today: [], yesterday: [], older: [] });
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [chatLoading, setChatLoading] = useState(false);

  // Input & UI state
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [feedbacks, setFeedbacks] = useState({});
  const [detailLevel, setDetailLevel] = useState("technical");
  const [sourcesOpen, setSourcesOpen] = useState({});

  // Perplexity-style Sources Panel
  const [streamingIntent, setStreamingIntent] = useState(null);    // {intent, intent_info} while streaming
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);   // right-panel toggle
  const [activeSources, setActiveSources] = useState({ rag: [], web: [] }); // currently shown sources

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const currentMessages = activeChatId ? messagesMap[activeChatId] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isTyping]);

  useEffect(() => {
    const fetchUserChats = async () => {
      try {
        const token = localStorage.getItem("researchflow_token");
        const res = await axios.get("/api/research/chats", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (Array.isArray(res.data)) {
          const today = [];
          const yesterday = [];
          const older = [];

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);

          res.data.forEach((c) => {
            const chatTime = new Date(c.updatedAt || c.createdAt).getTime();
            const formatted = {
              id: c._id,
              title: c.title || "Untitled Chat",
              time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
            };

            if (chatTime >= startOfToday) {
              today.push(formatted);
            } else if (chatTime >= startOfYesterday) {
              yesterday.push(formatted);
            } else {
              older.push(formatted);
            }
          });

          setChats({ today, yesterday, older });
        }
      } catch (err) {
        console.error("Failed to load chats:", err.message);
      }
    };
    fetchUserChats();
  }, []);

  /* ── Handlers ──────────────────────────────────────────────────── */
function formatSourcesData(ragDetails = [], webResults = [], sources = [], webSources = []) {
  const web = (webResults && webResults.length > 0)
    ? webResults
    : (webSources || []).map((url) => {
        let domain = "";
        try { domain = new URL(url).hostname; } catch (_e) { domain = String(url); }
        return {
          url,
          title: domain,
          domain,
          favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
          confidence: 85
        };
      });

  const rag = (ragDetails && ragDetails.length > 0)
    ? ragDetails
    : (sources || []).map(s => ({
        source: typeof s === "string" ? s : s?.source || "Knowledge Base Document",
        score: 85
      }));

  return { rag, web };
}

  const handleSelectChat = async (chatId) => {
    setActiveChatId(chatId);
    let msgs = messagesMap[chatId];
    if (chatId && (!msgs || msgs.length === 0)) {
      setChatLoading(true);
      try {
        const token = localStorage.getItem("researchflow_token");
        const res = await axios.get(`/api/research/chats/${chatId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.data && Array.isArray(res.data.messages)) {
          msgs = res.data.messages.map((m, idx) => ({
            id: m._id || `msg_${idx}_${Date.now()}`,
            role: m.role,
            text: m.text,
            sources: m.sources || [],
            webSources: m.webSources || [],
            webResults: m.webResults || [],
            ragSourceDetails: m.ragSourceDetails || [],
            isWebFallback: m.isWebFallback || false,
            time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          }));
          setMessagesMap((prev) => ({ ...prev, [chatId]: msgs }));
        }
      } catch (err) {
        console.error("Failed to load chat messages:", err.message);
      } finally {
        setChatLoading(false);
      }
    }

    if (msgs && msgs.length > 0) {
      const lastAssis = [...msgs].reverse().find((m) => m.role === "assistant");
      if (lastAssis) {
        setActiveSources(formatSourcesData(
          lastAssis.ragSourceDetails,
          lastAssis.webResults,
          lastAssis.sources,
          lastAssis.webSources
        ));
      } else {
        setActiveSources({ rag: [], web: [] });
      }
    } else {
      setActiveSources({ rag: [], web: [] });
    }
  };

  const handleFeedback = async (chatId, messageIndex, type) => {
    setFeedbacks((prev) => ({ ...prev, [messageIndex]: type }));
    if (!chatId) return;
    try {
      const token = localStorage.getItem("researchflow_token");
      await axios.post(
        `/api/research/feedback/${chatId}/${messageIndex}`,
        { feedback: type === "up" ? "positive" : "negative" },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch (err) {
      console.error("Failed to record feedback:", err.message);
    }
  };

  const handleDeleteChat = async (e, group, chatId) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem("researchflow_token");
      if (chatId && !chatId.startsWith("c_")) {
        await axios.delete(`/api/research/chats/${chatId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
      setChats((prev) => ({
        ...prev,
        [group]: (prev[group] || []).filter((c) => c.id !== chatId),
      }));
      setMessagesMap((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    } catch (err) {
      console.error("Failed to delete chat:", err.message);
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setInput("");
    setIsTyping(false);
  };

  const handleSend = async (queryText) => {
    const question = (queryText || input).trim();
    if (!question) return;

    let chatId = activeChatId;
    if (!chatId) {
      chatId = "c_" + Date.now();
      setChats((prev) => ({
        ...prev,
        today: [
          { id: chatId, title: question.substring(0, 45) + (question.length > 45 ? "…" : ""), time: "Just now" },
          ...prev.today,
        ],
      }));
      setActiveChatId(chatId);
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessagesMap((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), { id: "u_" + Date.now(), role: "user", text: question, time: now }],
    }));
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSearchStatusText(""); // Reset status text for each new query
    setIsTyping(true);

    // Reset sources panel for new query
    setStreamingIntent(null);
    setActiveSources({ rag: [], web: [] });
    setSourcePanelOpen(false);

    try {
      // Build conversation history from current messages
      const currentMsgs = messagesMap[chatId] || [];
      const history = currentMsgs.slice(-6).map(m => ({
        role: m.role,
        text: (m.text || "").substring(0, 500),
      }));

      // Call Node proxy stream endpoint (authenticated)
      const token = localStorage.getItem("researchflow_token");
      const response = await fetch(`/api/research/chats/${chatId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          top_k: 8,           // Bug 12 Fix: was hardcoded to 5, now matches backend default of 8
          answer_style: detailLevel,
          history: history.length > 0 ? history : null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || "Stream request failed");
      }

      // Add empty assistant message to stream into
      const assistantId = "a_" + Date.now();
      setMessagesMap((prev) => ({
        ...prev,
        [chatId]: [
          ...(prev[chatId] || []),
          { id: assistantId, role: "assistant", text: "", sources: [], webSources: [], webResults: [], ragSourceDetails: [], isWebFallback: false, intent: null, intentInfo: null, time: now },
        ],
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      // Bug 13 Fix: persistent SSE line buffer across read() chunks
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate raw bytes into buffer — a single read() may contain
        // partial SSE frames or multiple events merged together
        sseBuffer += decoder.decode(value, { stream: true });

        // Extract complete SSE lines (terminated by \n\n)
        const parts = sseBuffer.split("\n\n");
        // Last part is incomplete — keep in buffer
        sseBuffer = parts.pop() || "";

        for (const part of parts) {
          // Each 'part' is one complete SSE event block
          const lines = part.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            try {
              const payload = JSON.parse(line.slice(6)); // strip "data: "

              // ── Intent badge (Feature 6 & 8) ─────────────────────────────
              if (payload.intent && payload.intent_info) {
                setStreamingIntent({ intent: payload.intent, intentInfo: payload.intent_info });
                setMessagesMap((prev) => {
                  const msgs = [...(prev[chatId] || [])];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                    msgs[lastIdx] = { ...msgs[lastIdx], intent: payload.intent, intentInfo: payload.intent_info };
                  }
                  return { ...prev, [chatId]: msgs };
                });
              }

              if (payload.chatId) {
                const realId = payload.chatId;
                if (chatId !== realId) {
                  setChats((prev) => ({
                    today: prev.today.map((c) => c.id === chatId ? { ...c, id: realId, title: payload.chatTitle || c.title } : c),
                    yesterday: prev.yesterday.map((c) => c.id === chatId ? { ...c, id: realId, title: payload.chatTitle || c.title } : c),
                  }));
                  setMessagesMap((prev) => {
                    const msgs = prev[chatId] || [];
                    const next = { ...prev };
                    delete next[chatId];
                    next[realId] = msgs;
                    return next;
                  });
                  setActiveChatId(realId);
                  chatId = realId;
                }
              }

              if (payload.status_text) {
                setSearchStatusText(payload.status_text);
              }

              if (payload.error) {
                setMessagesMap((prev) => {
                  const msgs = [...(prev[chatId] || [])];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                    msgs[lastIdx] = { ...msgs[lastIdx], text: `⚠️ ${payload.error}`, isRefused: true };
                  }
                  return { ...prev, [chatId]: msgs };
                });
                setIsTyping(false);
                return;
              }

              if (payload.replace !== undefined) {
                fullText = payload.replace || "";
                setMessagesMap((prev) => {
                  const msgs = [...(prev[chatId] || [])];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                    msgs[lastIdx] = { ...msgs[lastIdx], text: payload.replace || "", isRefused: payload.replace ? false : true };
                  }
                  return { ...prev, [chatId]: msgs };
                });
              }

              if (payload.done) {
                // Feature 8: populate Sources Panel when stream completes
                const formatted = formatSourcesData(
                  payload.rag_source_details,
                  payload.web_results,
                  payload.sources,
                  payload.web_sources
                );
                setActiveSources(formatted);
                if (formatted.web.length > 0 || formatted.rag.length > 0) {
                  setSourcePanelOpen(true);
                }
                setStreamingIntent(null);

                setMessagesMap((prev) => {
                  const msgs = [...(prev[chatId] || [])];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                    msgs[lastIdx] = {
                      ...msgs[lastIdx],
                      sources: payload.sources || [],
                      webSources: payload.web_sources || [],
                      webResults: formatted.web,
                      ragSourceDetails: formatted.rag,
                      isWebFallback: payload.is_web_fallback || false,
                      intent: payload.intent || msgs[lastIdx].intent,
                      intentInfo: payload.intent_info || msgs[lastIdx].intentInfo,
                      isRefused: payload.refused ? true : msgs[lastIdx].isRefused,
                    };
                  }
                  return { ...prev, [chatId]: msgs };
                });
                setIsTyping(false);
                return;
              }

              if (payload.token) {
                fullText += payload.token;
                const captured = fullText;
                setMessagesMap((prev) => {
                  const msgs = [...(prev[chatId] || [])];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                    msgs[lastIdx] = { ...msgs[lastIdx], text: captured };
                  }
                  return { ...prev, [chatId]: msgs };
                });
              }
            } catch (_e) {
              // Ignore malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      setMessagesMap((prev) => ({
        ...prev,
        [chatId]: [
          ...(prev[chatId] || []),
          {
            id: "a_" + Date.now(),
            role: "assistant",
            isRefused: true,
            text: `⚠️ ${err.message || "Failed to connect to RAG service. Make sure the Python backend is running."}`,
            sources: [],
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      }));
    }
    setIsTyping(false);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ── Styles ──────────────────────────────────────────────────────
     All colors driven by CSS custom properties so they adapt to
     both light (default) and dark mode automatically.
  ─────────────────────────────────────────────────────────────────*/

  return (
    <div
      className="flex h-screen w-full font-sans antialiased overflow-hidden"
      style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      {/* ── Mobile backdrop ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ════════════════════════════════════════════════════════════ */}
      <aside
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color-subtle)",
          width: sidebarCollapsed ? "64px" : "260px",
          transition: "width 0.25s ease",
        }}
        className={`flex flex-col h-full shrink-0 z-50 fixed lg:static inset-y-0 left-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        {/* Logo row */}
        <div
          className="flex items-center justify-between px-4 h-14 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2.2} />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest truncate" style={{ color: "var(--text-primary)" }}>
                  ResearchFlow AI
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full h-10 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97]"
            style={{
              background: "var(--brand-primary)",
              color: "#FFFFFF",
              boxShadow: "var(--shadow-btn)",
            }}
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
            {!sidebarCollapsed && <span>+ New Chat</span>}
          </button>
        </div>

        {/* Upload Custom RAG Dataset Box */}
        {!sidebarCollapsed && (
          <div className="px-3 pb-2 shrink-0">
            {canUpload ? (
              <div
                className="rounded-xl p-3.5 text-center cursor-pointer transition-all"
                style={{
                  border: "2px dashed var(--border-color)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
              >
                <Upload className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--brand-primary)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  Upload ResearchFlow Dataset
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  PDF / TXT / DOCX / MD · Max 50 MB
                </p>
              </div>
            ) : (
              <div
                onClick={() => setShowUpgradeModal(true)}
                className="rounded-xl p-3.5 text-center cursor-pointer transition-all relative overflow-hidden group"
                style={{
                  border: "1px solid rgba(217,119,6,0.30)",
                  background: "rgba(217,119,6,0.08)",
                }}
              >
                <div className="flex items-center justify-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span>Pro Feature: RAG Upload</span>
                </div>
                <p className="text-[11px] text-amber-800/80 font-medium">
                  Upload your own PDF/TXT dataset
                </p>
                <span className="mt-2 inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-amber-700 shadow-sm group-hover:bg-amber-800 transition-colors">
                  Upgrade to Pro →
                </span>
              </div>
            )}
          </div>
        )}

        {/* Indexed Documents */}
        {!sidebarCollapsed && (
          <div className="px-3 pb-3 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              Indexed Documents
            </p>
            <p className="text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>
              No documents indexed yet.
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Upload a PDF to get started.
            </p>
            <div className="mt-2" style={{ borderBottom: "1px solid var(--border-color-subtle)" }} />
          </div>
        )}

        {/* Chat History */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-2 sidebar-scroll">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1" style={{ color: "var(--text-muted)" }}>
              Chat History
            </p>

            {Object.entries(chats).length === 0 || (chats.today.length === 0 && chats.yesterday.length === 0) ? (
              <div className="text-center py-6">
                <MessageSquare className="w-6 h-6 mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No previous chats.</p>
                <button
                  onClick={handleNewChat}
                  className="text-xs font-semibold mt-0.5"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Create one now
                </button>
              </div>
            ) : (
              <>
                {chats.today.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--text-muted)" }}>
                      Today
                    </p>
                    {chats.today.map((c) => {
                      const isActive = activeChatId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectChat(c.id)}
                          onMouseEnter={() => setHoveredChatId(c.id)}
                          onMouseLeave={() => setHoveredChatId(null)}
                          className="group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 mb-0.5"
                          style={{
                            background: isActive ? "rgba(142,78,20,0.12)" : "transparent",
                            borderLeft: isActive ? "3px solid var(--brand-primary)" : "3px solid transparent",
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p
                              className="text-xs truncate leading-snug font-medium"
                              style={{ color: isActive ? "var(--brand-primary)" : "var(--text-secondary)" }}
                            >
                              {c.title}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {c.time}
                            </p>
                          </div>
                          {hoveredChatId === c.id && (
                            <button
                              onClick={(e) => handleDeleteChat(e, "today", c.id)}
                              className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {chats.yesterday.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--text-muted)" }}>
                      Yesterday
                    </p>
                    {chats.yesterday.map((c) => {
                      const isActive = activeChatId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectChat(c.id)}
                          onMouseEnter={() => setHoveredChatId(c.id)}
                          onMouseLeave={() => setHoveredChatId(null)}
                          className="group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 mb-0.5"
                          style={{
                            background: isActive ? "rgba(142,78,20,0.12)" : "transparent",
                            borderLeft: isActive ? "3px solid var(--brand-primary)" : "3px solid transparent",
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p
                              className="text-xs truncate leading-snug font-medium"
                              style={{ color: isActive ? "var(--brand-primary)" : "var(--text-secondary)" }}
                            >
                              {c.title}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {c.time}
                            </p>
                          </div>
                          {hoveredChatId === c.id && (
                            <button
                              onClick={(e) => handleDeleteChat(e, "yesterday", c.id)}
                              className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {chats.older && chats.older.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-1" style={{ color: "var(--text-muted)" }}>
                      Older
                    </p>
                    {chats.older.map((c) => {
                      const isActive = activeChatId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectChat(c.id)}
                          onMouseEnter={() => setHoveredChatId(c.id)}
                          onMouseLeave={() => setHoveredChatId(null)}
                          className="group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 mb-0.5"
                          style={{
                            background: isActive ? "rgba(142,78,20,0.12)" : "transparent",
                            borderLeft: isActive ? "3px solid var(--brand-primary)" : "3px solid transparent",
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p
                              className="text-xs truncate leading-snug font-medium"
                              style={{ color: isActive ? "var(--brand-primary)" : "var(--text-secondary)" }}
                            >
                              {c.title}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {c.time}
                            </p>
                          </div>
                          {hoveredChatId === c.id && (
                            <button
                              onClick={(e) => handleDeleteChat(e, "older", c.id)}
                              className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Admin Navigation Links */}
        {isAdmin && (
          <div className="px-3 py-2 shrink-0 space-y-1" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
            <button
              onClick={() => navigate("/admin")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${sidebarCollapsed ? "justify-center" : ""
                }`}
              style={{ color: "var(--brand-primary)", background: "rgba(142,78,20,0.08)" }}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Admin Dashboard</span>}
            </button>

            <button
              onClick={() => navigate("/documents")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${sidebarCollapsed ? "justify-center" : ""
                }`}
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(142,78,20,0.08)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Document Library</span>}
            </button>
          </div>
        )}

        {/* User Footer */}
        <div
          className="px-3 py-3 shrink-0"
          style={{ borderTop: "1px solid var(--border-color-subtle)" }}
        >
          <div
            className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors ${sidebarCollapsed ? "justify-center" : ""
              }`}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(142,78,20,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              {userInitials}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0" onClick={() => navigate("/profile")}>
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>
                    {user?.role || "Viewer"} {user?.specialty ? `· ${user.specialty}` : ""}
                  </p>
                </div>
                <ThemeToggle />
                <button
                  onClick={() => navigate("/profile")}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  title="Profile Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════════════════════ */}
      <main
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        style={{ background: "var(--bg-chat-area)" }}
      >
        {/* Top Header */}
        <header
          className="h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20"
          style={{ borderBottom: "1px solid var(--border-color-subtle)", background: "var(--bg-input-bar)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* AI Icon + name */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                ResearchFlow AI
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                />
                <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  ETHICAL HACKING EXPERT · HYBRID RAG · GROQ LLAMA 3.3 70B
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPro && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-700" />
                <span>Upgrade Pro RAG</span>
              </button>
            )}
            <button
              onClick={() => setSourcePanelOpen(!sourcePanelOpen)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer"
              style={{
                color: sourcePanelOpen ? "var(--brand-primary)" : "var(--text-muted)",
                borderColor: sourcePanelOpen ? "var(--brand-primary)" : "var(--border-color-subtle)",
                background: sourcePanelOpen ? "rgba(142,78,20,0.08)" : "transparent",
              }}
              title="Toggle Sources Panel"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Sources {activeSources.web.length + activeSources.rag.length > 0 ? `(${activeSources.web.length + activeSources.rag.length})` : ""}</span>
            </button>
            <ThemeToggle />
            <button
              onClick={() => {
                if (activeChatId) {
                  setMessagesMap((prev) => ({ ...prev, [activeChatId]: [] }));
                  setIsTyping(false);
                  setActiveSources({ rag: [], web: [] });
                  setSourcePanelOpen(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5"
              style={{
                color: "var(--text-muted)",
                borderColor: "var(--border-color-subtle)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-color-subtle)";
              }}
              title="Clear messages from screen view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear View</span>
            </button>
          </div>
        </header>

        {/* ── Scrollable chat messages ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 sidebar-scroll">
          <div className="max-w-5xl mx-auto w-full">

            {/* Chat loading indicator */}
            {chatLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3 animate-fade-in">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand-primary)", borderTopColor: "transparent" }} />
                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Loading conversation history...</p>
              </div>
            )}

            {/* Empty state / Welcome screen */}
            {!chatLoading && currentMessages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--brand-primary)", boxShadow: "0 8px 24px var(--brand-glow)" }}
                >
                  <Sparkles className="w-8 h-8 text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-heading)" }}>
                    ResearchFlow AI — AI Research Assistant
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Ask any question about ethical hacking, penetration testing, CVEs, or tools.
                    Get answers with code in Python, Bash, C, PowerShell, Ruby, and Assembly.
                  </p>
                  <p className="text-xs mt-1 font-medium" style={{ color: "var(--brand-primary)" }}>
                    Hybrid RAG · Semantic Chunking · Multi-Language Code Generation · Case Study Support
                  </p>
                </div>

                {/* Suggestion chips */}
                <div className="flex flex-col gap-2 mt-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left text-sm px-4 py-3 rounded-xl border transition-all"
                      style={{
                        background: "var(--bg-card)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-secondary)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--brand-primary)";
                        e.currentTarget.style.color = "var(--brand-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {currentMessages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isRefused = msg.isRefused;
              // A message is "streaming" only if it's the last assistant
              // message and we're currently typing — drives the typewriter caret.
              const isStreaming =
                !isUser &&
                isTyping &&
                idx === currentMessages.length - 1;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  {/* AI avatar */}
                  {!isUser && (
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-sm"
                      style={{ background: "var(--brand-primary)" }}
                    >
                      <Microscope className="w-4 h-4 text-white" strokeWidth={2.2} />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? "items-end max-w-[75%]" : "items-start w-full"}`}>

                    {/* USER bubble — deep forest green (#012D1D) */}
                    {isUser && (
                      <>
                        <div
                          className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed font-medium"
                          style={{ background: "var(--brand-primary)", color: "#FFFFFF" }}
                        >
                          {msg.text}
                        </div>
                        {msg.time && (
                          <p className="text-[10px] mt-1 mr-1" style={{ color: "var(--text-muted)" }}>
                            {msg.time}
                          </p>
                        )}
                      </>
                    )}

                    {/* AI message — clean, uncontained presentation matching Image 2 */}
                    {!isUser && (
                      <>
                        <div
                          className="w-full text-sm leading-relaxed"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {isRefused && (
                            <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold uppercase tracking-wide mb-2">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Outside document scope</span>
                            </div>
                          )}

                          {/* Source Type Badge */}
                          {msg.isWebFallback ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 mb-2 shadow-xs">
                              <Globe className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Live Web Intelligence (DuckDuckGo)</span>
                            </div>
                          ) : msg.sources && msg.sources.length > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 mb-2 shadow-xs">
                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Local Document RAG</span>
                            </div>
                          ) : null}

                          <MarkdownContent text={msg.text} streaming={isStreaming} />
                        </div>

                        {/* Clean bottom action bar (Copy, Feedback, Sources button) */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors hover:bg-white/5"
                            style={{ color: "var(--text-muted)" }}
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleFeedback(activeChatId, idx, "up")}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: feedbacks[idx] === "up" || feedbacks[msg.id] === "up" ? "#10B981" : "var(--text-muted)" }}
                            title="Good response"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleFeedback(activeChatId, idx, "down")}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: feedbacks[idx] === "down" || feedbacks[msg.id] === "down" ? "#EF4444" : "var(--text-muted)" }}
                            title="Bad response"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>

                          {/* Sources pill button if available */}
                          {((msg.sources && msg.sources.length > 0) || (msg.webSources && msg.webSources.length > 0)) && (
                            <button
                              onClick={() => {
                                setSourcesOpen((p) => ({ ...p, [msg.id]: !p[msg.id] }));
                                setActiveSources(formatSourcesData(msg.ragSourceDetails, msg.webResults, msg.sources, msg.webSources));
                                setSourcePanelOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border cursor-pointer"
                              style={{
                                borderColor: "var(--border-color)",
                                color: "var(--text-muted)",
                                background: "transparent",
                              }}
                            >
                              {msg.isWebFallback ? <Globe className="w-3.5 h-3.5 text-cyan-400" /> : <FileText className="w-3.5 h-3.5" />}
                              <span>Sources ({(msg.sources?.length || 0) + (msg.webSources?.length || 0)})</span>
                              <span>{sourcesOpen[msg.id] ? "▲" : "▼"}</span>
                            </button>
                          )}
                        </div>

                        {/* Expanded sources list */}
                        {sourcesOpen[msg.id] && (
                          <div className="mt-2 flex flex-wrap gap-2 pl-1">
                            {/* Document sources */}
                            {msg.sources && msg.sources.map((src, i) => (
                              <div
                                key={`doc_${i}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                style={{
                                  background: "var(--brand-primary)",
                                  color: "#FFFFFF",
                                }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{src}</span>
                              </div>
                            ))}

                            {/* Web source URLs */}
                            {msg.webSources && msg.webSources.map((url, i) => (
                              <a
                                key={`web_${i}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan-900/60 text-cyan-200 border border-cyan-700/60 hover:bg-cyan-800/70 transition-all"
                              >
                                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="max-w-[200px] truncate">{url}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* User avatar */}
                  {isUser && (
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm"
                      style={{ background: "var(--brand-primary)" }}
                    >
                      {userInitials}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing / Searching indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start items-center my-3 animate-fade-in pl-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "transparent", border: "1px solid var(--border-color)" }}
                >
                  <Globe className="w-4 h-4 text-cyan-400 animate-pulse" strokeWidth={2} />
                </div>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  <span>{searchStatusText || "Searching the web..."}</span>
                  <div className="flex items-center gap-1 ml-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: "var(--brand-primary)", animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Bottom Input Bar ── */}
        <div
          className="shrink-0 px-4 sm:px-8 pt-3 pb-4 z-20"
          style={{
            borderTop: "none",
            background: "var(--bg-input-bar)",
          }}
        >
          <div className="max-w-5xl mx-auto">
            <div
              className="flex items-center gap-3 rounded-2xl px-3 py-2 transition-all"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-input)",
              }}
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = "var(--border-input-focus)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-glow-subtle)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = "var(--border-input)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything — science, medicine, data, tech, programming, or general questions... (Enter to send)"
                className="flex-1 bg-transparent text-sm px-2 py-2 outline-none resize-none min-h-[36px] max-h-32"
                style={{
                  color: "var(--text-primary)",
                  caretColor: "var(--brand-primary)",
                }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="h-10 px-5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all duration-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] text-white"
                style={{
                  background: "var(--brand-primary)",
                  boxShadow: "var(--shadow-btn)",
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--brand-hover)";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-primary)")}
              >
                <Send className="w-4 h-4" strokeWidth={2.5} />
                <span>Send</span>
              </button>
            </div>

            {/* Detail level + footer */}
            <div className="flex items-center justify-between mt-2.5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Detail:
                </span>
                {DETAIL_LEVELS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setDetailLevel(value)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={
                      detailLevel === value
                        ? { background: "var(--brand-primary)", color: "#FFFFFF", borderColor: "var(--brand-primary)" }
                        : { background: "transparent", color: "var(--text-muted)", borderColor: "var(--border-color)" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Groq LLaMA 3.3 70B · Hybrid Search · Live RAG
              </p>
            </div>
          </div>
        </div>

        {/* ── PRO PLAN UPGRADE MODAL ── */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="w-full max-w-[540px] rounded-3xl p-6 sm:p-8 relative shadow-2xl animate-fade-in"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color-subtle)" }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-xl transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30 text-amber-600 shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
                    Upgrade to ResearchFlow AI Pro
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Unlock Custom RAG Dataset Ingestion & Private Vector Storage
                  </p>
                </div>
              </div>

              {/* Upgrade Success Notification */}
              {upgradeSuccess && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pro Plan Activated! You can now upload custom PDF / TXT / DOCX datasets.</span>
                </div>
              )}

              {/* Pricing Cards */}
              <div className="grid grid-cols-2 gap-3 my-5">
                {/* Free Plan */}
                <div className="p-4 rounded-2xl border text-left" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-color-subtle)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Free Plan</p>
                  <p className="text-2xl font-black mt-1" style={{ color: "var(--text-heading)" }}>$0 <span className="text-xs font-normal">/mo</span></p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Up-to-Date Web AI Chat</p>
                  <div className="mt-3 text-[10px] space-y-1 text-gray-500">
                    <p>✓ Unlimited Web Queries</p>
                    <p className="text-red-500">✕ Custom RAG Uploads</p>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="p-4 rounded-2xl border-2 text-left relative overflow-hidden"
                  style={{ background: "rgba(142,78,20,0.06)", borderColor: "var(--brand-primary)" }}>
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider" style={{ background: "var(--brand-primary)" }}>
                    Popular
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>Pro Plan</p>
                  <p className="text-2xl font-black mt-1" style={{ color: "var(--text-heading)" }}>$19 <span className="text-xs font-normal">/mo</span></p>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--brand-primary)" }}>Custom RAG Uploads</p>
                  <div className="mt-3 text-[10px] space-y-1 font-medium" style={{ color: "var(--text-primary)" }}>
                    <p>✓ Unlimited PDF/TXT Ingestion</p>
                    <p>✓ Qdrant Vector Indexing</p>
                    <p>✓ LLaMA 3.3 70B Priority</p>
                  </div>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2 mb-6 text-xs text-left" style={{ color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Private Vector Collections:</strong> Index thousands of documents per workspace.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Zero Data Leakage:</strong> Isolated Qdrant & Groq processing pipeline.</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 py-3 rounded-2xl border font-semibold text-xs transition-colors"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                >
                  Continue Free
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPro(true);
                    setUpgradeSuccess(true);
                    setTimeout(() => setShowUpgradeModal(false), 1200);
                  }}
                  className="flex-1 py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                  style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
                >
                  <Crown className="w-4 h-4" />
                  <span>Unlock Pro Plan ($19)</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ════════════════════════════════════════════════════════════
          PERPLEXITY-STYLE SOURCES PANEL (Right Sidebar)
          Feature 8 — slides in after stream completes with sources
      ════════════════════════════════════════════════════════════ */}
      {sourcePanelOpen && (
        <aside
          style={{
            width: "280px",
            background: "var(--bg-sidebar)",
            borderLeft: "1px solid var(--border-color-subtle)",
            overflowY: "auto",
            flexShrink: 0,
            transition: "width 0.25s ease",
          }}
          className="flex flex-col h-full sidebar-scroll"
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-4 h-14 shrink-0"
            style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                Sources
              </p>
            </div>
            <button
              onClick={() => setSourcePanelOpen(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 sidebar-scroll">

            {/* Web Sources */}
            {activeSources.web.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "var(--text-muted)" }}>
                  🌐 Live Web Results
                </p>
                <div className="space-y-2">
                  {activeSources.web.map((src, i) => {
                    const confLevel = src.confidence >= 70 ? "high" : src.confidence >= 45 ? "medium" : "low";
                    const confColor = confLevel === "high" ? "#10b981" : confLevel === "medium" ? "#f59e0b" : "#ef4444";
                    const confLabel = confLevel === "high" ? "High" : confLevel === "medium" ? "Med" : "Low";
                    return (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 rounded-xl border transition-all group"
                        style={{
                          background: "var(--bg-card)",
                          borderColor: "var(--border-color-subtle)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--brand-primary)";
                          e.currentTarget.style.background = "rgba(142,78,20,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-color-subtle)";
                          e.currentTarget.style.background = "var(--bg-card)";
                        }}
                      >
                        {/* Favicon + domain */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {src.favicon_url ? (
                            <img
                              src={src.favicon_url}
                              alt=""
                              className="w-4 h-4 rounded-sm flex-shrink-0"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                          ) : (
                            <Globe className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          )}
                          <span className="text-[10px] font-medium truncate" style={{ color: "var(--text-muted)" }}>
                            {src.domain || new URL(src.url || "https://example.com").hostname}
                          </span>
                          <span
                            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${confColor}20`, color: confColor }}
                          >
                            {confLabel}
                          </span>
                        </div>
                        {/* Title */}
                        <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: "var(--text-primary)" }}>
                          {src.title}
                        </p>
                        {/* Snippet */}
                        {src.snippet && (
                          <p className="text-[11px] mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                            {src.snippet}
                          </p>
                        )}
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RAG Document Sources */}
            {activeSources.rag.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "var(--text-muted)" }}>
                  📄 Knowledge Base
                </p>
                <div className="space-y-2">
                  {activeSources.rag.map((src, i) => {
                    const conf = src.confidence || {};
                    const level = conf.level || "medium";
                    const confColor = level === "high" ? "#10b981" : level === "medium" ? "#f59e0b" : "#ef4444";
                    const confLabel = level === "high" ? "High" : level === "medium" ? "Med" : "Low";
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl border"
                        style={{ background: "var(--bg-card)", borderColor: "var(--border-color-subtle)" }}
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--brand-primary)" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {src.source?.replace(/\.[^/.]+$/, "") || "Document"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {src.chunks || 1} chunk{src.chunks !== 1 ? "s" : ""}
                              </span>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: `${confColor}20`, color: confColor }}
                              >
                                {confLabel}
                              </span>
                              {conf.score != null && (
                                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                                  {conf.score}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Empty state */}
            {activeSources.web.length === 0 && activeSources.rag.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Globe className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No sources yet</p>
              </div>
            )}
          </div>
        </aside>
      )}

    </div>
  );
}
