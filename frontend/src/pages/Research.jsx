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
  Zap,
  Lock,
  CheckCircle2,
  X,
  Globe,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

/* ─── General Research Sample / Demo Data ──────────────────────────── */
const SUGGESTIONS = [
  "Summarize the latest breakthroughs in AI and Quantum Computing",
  "Analyze recent trends in renewable energy and global market impact",
  "Synthesize key takeaways from my uploaded research paper dataset",
  "Compare transformer architecture variations for domain-specific RAG",
];

const SAMPLE_CHATS = {
  today: [
    { id: "c1", title: "What are the core advances in LLM reasoning in 2026?", time: "10m ago", active: true },
    { id: "c2", title: "Compare solar vs wind energy grid integration methods", time: "1h ago", active: false },
  ],
  yesterday: [
    { id: "c3", title: "Key economic indicators and 2026 growth forecasts...", time: "1d ago", active: false },
    { id: "c4", title: "Explain retrieval-augmented generation chunking techniques...", time: "1d ago", active: false },
  ],
};

const DEFAULT_MESSAGES = [
  {
    id: "msg_1",
    role: "user",
    text: "What are the core advances in LLM reasoning in 2026?",
    time: "09:55 AM",
  },
  {
    id: "msg_2",
    role: "assistant",
    isRefused: false,
    text: "Key advances in LLM reasoning in 2026 focus on multi-step chain-of-thought verification, hybrid neuro-symbolic reasoning engines, and real-time retrieval augmented generation (RAG) with dynamic confidence scoring. Models now integrate live web knowledge streams with private vector databases for zero-hallucination research outputs.",
    sources: ["LLM_Reasoning_Survey_2026.pdf", "RAG_Vector_Search_Benchmark.pdf"],
    time: "09:55 AM",
  },
];

/* ─── Detail Levels ──────────────────────────────────────────────── */
const DETAIL_LEVELS = ["Quick", "Standard", "Detailed", "Deep"];

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

  // Chat data
  const [chats, setChats] = useState(SAMPLE_CHATS);
  const [activeChatId, setActiveChatId] = useState("c1");
  const [messagesMap, setMessagesMap] = useState({
    c1: DEFAULT_MESSAGES,
    c2: [],
    c3: [],
    c4: [],
  });

  // Input & UI state
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [feedbacks, setFeedbacks] = useState({});
  const [detailLevel, setDetailLevel] = useState("Detailed");
  const [sourcesOpen, setSourcesOpen] = useState({});

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const currentMessages = activeChatId ? messagesMap[activeChatId] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isTyping]);

  /* ── Handlers ──────────────────────────────────────────────────── */
  const handleNewChat = () => {
    setActiveChatId(null);
    setInput("");
    setIsTyping(false);
  };

  const handleSend = (queryText) => {
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
    setIsTyping(true);

    setTimeout(() => {
      let aiText, sources = [], isRefused = false;
      const q = question.toLowerCase();
      if (q.includes("contraindication") || q.includes("ace")) {
        aiText = "### Contraindications for ACE Inhibitors\n\n- **History of Angioedema**: Prior angioedema related to previous ACE inhibitor treatment.\n- **Pregnancy**: Absolute contraindication (FDA Black Box Warning).\n- **Bilateral Renal Artery Stenosis**: Risk of severe acute renal failure.\n- **Concomitant Aliskiren Use**: In diabetic patients due to hyperkalemia risk.";
        sources = ["JNC_8_Hypertension_Guidelines.pdf", "Cardiovascular_Pharmacology_2025.pdf"];
      } else if (q.includes("diabetes")) {
        aiText = "### Type 2 Diabetes Management\nFirst-line therapy remains **Metformin** combined with lifestyle modifications. SGLT2 inhibitors and GLP-1 receptor agonists are prioritized for patients with established ASCVD or heart failure.";
        sources = ["endocrinology_guidelines.pdf"];
      } else {
        isRefused = true;
        aiText = "I can only answer questions based on the uploaded documents. The indexed medical documents do not contain authoritative data matching this query.";
      }

      setMessagesMap((prev) => ({
        ...prev,
        [chatId]: [
          ...(prev[chatId] || []),
          { id: "a_" + Date.now(), role: "assistant", isRefused, text: aiText, sources, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ],
      }));
      setIsTyping(false);
    }, 1600);
  };

  const handleDeleteChat = (e, groupKey, chatId) => {
    e.stopPropagation();
    setChats((prev) => ({ ...prev, [groupKey]: prev[groupKey].filter((c) => c.id !== chatId) }));
    if (activeChatId === chatId) setActiveChatId(null);
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
        className={`flex flex-col h-full shrink-0 z-50 fixed lg:static inset-y-0 left-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
                  ResearchAI
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
                  Upload Custom RAG Dataset
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  PDF / TXT / DOCX · Max 50 MB
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
                          onClick={() => setActiveChatId(c.id)}
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
                          onClick={() => setActiveChatId(c.id)}
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
              </>
            )}
          </div>
        )}

        {/* Admin Navigation Links */}
        {isAdmin && (
          <div className="px-3 py-2 shrink-0 space-y-1" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
            <button
              onClick={() => navigate("/admin")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              style={{ color: "var(--brand-primary)", background: "rgba(142,78,20,0.08)" }}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Admin Dashboard</span>}
            </button>

            <button
              onClick={() => navigate("/documents")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                sidebarCollapsed ? "justify-center" : ""
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
            className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
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
                ResearchAI
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                />
                <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  REAL-TIME WEB INTELLIGENCE · QDRANT RAG · GROQ LLAMA 3.3 70B
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
            <ThemeToggle />
            <button
              onClick={() => {
                if (activeChatId) {
                  setMessagesMap((prev) => ({ ...prev, [activeChatId]: [] }));
                  setIsTyping(false);
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
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </header>

        {/* ── Scrollable chat messages ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 sidebar-scroll">
          <div className="max-w-3xl mx-auto w-full">

            {/* Empty state / Welcome screen */}
            {currentMessages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--brand-primary)", boxShadow: "0 8px 24px var(--brand-glow)" }}
                >
                  <Sparkles className="w-8 h-8 text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-heading)" }}>
                    ResearchAI Knowledge Assistant
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Ask any question for real-time up-to-date information, or upload custom RAG datasets (Pro).
                  </p>
                  <p className="text-xs mt-1 font-medium" style={{ color: "var(--brand-primary)" }}>
                    Up-to-Date Web Intelligence · Custom Vector Datasets · Citation Traceability
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
            {currentMessages.map((msg) => {
              const isUser = msg.role === "user";
              const isRefused = msg.isRefused;

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

                  <div className={`flex flex-col ${isUser ? "items-end max-w-[65%]" : "items-start max-w-[80%] w-full"}`}>

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

                    {/* AI bubble */}
                    {!isUser && (
                      <>
                        <div
                          className="w-full rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed"
                          style={{
                            background: isRefused ? "rgba(245,158,11,0.08)" : "var(--bg-card)",
                            border: isRefused
                              ? "1px solid rgba(245,158,11,0.3)"
                              : "1px solid var(--border-color)",
                            boxShadow: "var(--shadow-card)",
                            color: "var(--text-ai-msg)",
                          }}
                        >
                          {isRefused && (
                            <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold uppercase tracking-wide mb-2">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Outside document scope</span>
                            </div>
                          )}
                          <div
                            className="prose-chat max-w-none"
                            style={{ color: "var(--text-ai-msg)" }}
                          >
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        </div>

                        {/* Sources row */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div
                            className="mt-2 w-full rounded-xl p-3 flex items-center justify-between"
                            style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                Sources: {msg.sources.length} documents
                              </span>
                              <button
                                onClick={() => setSourcesOpen((p) => ({ ...p, [msg.id]: !p[msg.id] }))}
                                className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                                style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
                              >
                                {sourcesOpen[msg.id] ? "▲" : "▼"}
                              </button>
                            </div>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {msg.time}
                            </span>
                          </div>
                        )}
                        {sourcesOpen[msg.id] && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2 pl-1">
                            {msg.sources.map((src, i) => (
                              <div
                                key={i}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all"
                                style={{
                                  background: "var(--brand-primary)",
                                  color: "#FFFFFF",
                                }}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{src}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 mt-2">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setFeedbacks((p) => ({ ...p, [msg.id]: "up" }))}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: feedbacks[msg.id] === "up" ? "#10B981" : "var(--text-muted)" }}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setFeedbacks((p) => ({ ...p, [msg.id]: "down" }))}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: feedbacks[msg.id] === "down" ? "#EF4444" : "var(--text-muted)" }}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--brand-primary)" }}
                >
                  <Microscope className="w-4 h-4 text-white" strokeWidth={2.2} />
                </div>
                <div
                  className="px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "var(--brand-primary)", animationDelay: `${delay}ms` }}
                    />
                  ))}
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
            borderTop: "1px solid var(--border-color-subtle)",
            background: "var(--bg-input-bar)",
          }}
        >
          <div className="max-w-3xl mx-auto">
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
                placeholder="Ask a question about your uploaded documents... (Enter to send)"
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
                {DETAIL_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setDetailLevel(level)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={
                      detailLevel === level
                        ? { background: "var(--brand-primary)", color: "#FFFFFF", borderColor: "var(--brand-primary)" }
                        : { background: "transparent", color: "var(--text-muted)", borderColor: "var(--border-color)" }
                    }
                  >
                    {level}
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
                    Upgrade to ResearchAI Pro
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
    </div>
  );
}
