import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
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
  Sparkles,
  FolderOpen,
  Menu
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import ThemeToggle from "../components/ThemeToggle.jsx";

const SUGGESTIONS = [
  "What is Type 2 diabetes?",
  "List symptoms of heart failure",
  "Explain antibiotic resistance"
];

const SAMPLE_CHATS = {
  today: [
    { 
      id: "c1", 
      title: "What are recommended treatments for chronic hypertension...", 
      time: "10m ago",
      active: true 
    },
    { 
      id: "c2", 
      title: "What is a medical research question about diabetes?", 
      time: "1h ago",
      active: false 
    }
  ],
  yesterday: [
    { 
      id: "c3", 
      title: "How symptoms of heart failure present in elderly...", 
      time: "1d ago",
      active: false 
    },
    { 
      id: "c4", 
      title: "Explain antibiotic resistance to the treatment...", 
      time: "1d ago",
      active: false 
    }
  ]
};

const DEFAULT_ACTIVE_MESSAGES = [
  {
    id: "msg_1",
    role: "user",
    text: "What are the recommended treatments for chronic hypertension in elderly patients?"
  },
  {
    id: "msg_2",
    role: "assistant",
    isRefused: false,
    text: "According to the JNC 8 guidelines and recent meta-analyses, treatment for chronic hypertension in patients over 60 should initially target a systolic blood pressure of less than 150 mmHg. Recommended first-line agents include thiazide-type diuretics, calcium channel blockers (CCBs), ACE inhibitors, or ARBs.\n\n### Recommended Drug Classes:\n- **Calcium Channel Blockers (CCBs)**: Long-acting dihydropyridines (e.g. Amlodipine)\n- **ACE Inhibitors / ARBs**: Prioritized in diabetic or renal-impaired patients\n- **Thiazide Diuretics**: Chlorthalidone or Hydrochlorothiazide\n- **Beta-Blockers**: Not recommended as primary first-line monotherapy unless specific compelling cardiac indications exist.",
    sources: ["JNC_8_Hypertension_Guidelines.pdf", "Hypertension_in_Elderly_Review_2024.pdf"]
  },
  {
    id: "msg_3",
    role: "user",
    text: "Can you summarize the experimental off-label dosage for investigational Drug X?"
  },
  {
    id: "msg_4",
    role: "assistant",
    isRefused: true,
    text: "I can only answer questions based on the uploaded documents. The provided clinical search index does not contain verified guidelines or protocol data regarding investigational Drug X off-label dosages.",
    sources: []
  }
];

export default function Research() {
  const navigate = useNavigate();
  // Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState(null);

  // Chat Data & Active Conversation
  const [chats, setChats] = useState(SAMPLE_CHATS);
  const [activeChatId, setActiveChatId] = useState("c1");
  const [messagesMap, setMessagesMap] = useState({
    c1: DEFAULT_ACTIVE_MESSAGES,
    c2: [],
    c3: [],
    c4: []
  });

  // Typing & Input State
  const [input, setInput] = useState("What are the contraindications for ACE inhibitors?");
  const [isTyping, setIsTyping] = useState(true); // Demonstrates typing indicator by default
  const [copiedId, setCopiedId] = useState(null);
  const [feedbacks, setFeedbacks] = useState({});
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const currentMessages = activeChatId ? (messagesMap[activeChatId] || []) : [];

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isTyping]);

  // Handle New Chat Click
  const handleNewChat = () => {
    setActiveChatId(null);
    setInput("");
    setIsTyping(false);
  };

  // Handle Sending Question
  const handleSend = (queryText) => {
    const question = (queryText || input).trim();
    if (!question) return;

    let chatId = activeChatId;

    if (!chatId) {
      chatId = "c_" + Date.now();
      const newChatItem = {
        id: chatId,
        title: question.length > 38 ? question.substring(0, 38) + "..." : question,
        time: "Just now"
      };
      setChats(prev => ({
        ...prev,
        today: [newChatItem, ...prev.today]
      }));
      setActiveChatId(chatId);
    }

    const userMsg = { id: "msg_u_" + Date.now(), role: "user", text: question };

    setMessagesMap(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), userMsg]
    }));

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsTyping(true);

    // Simulate RAG Response
    setTimeout(() => {
      let aiText = "";
      let sources = [];
      let isRefused = false;

      const lowerQ = question.toLowerCase();
      if (lowerQ.includes("contraindication") || lowerQ.includes("ace")) {
        aiText = "### Contraindications for ACE Inhibitors\n\n- **History of Angioedema**: Prior angioedema related to previous ACE inhibitor treatment.\n- **Pregnancy**: Absolute contraindication (FDA Black Box Warning due to fetal renal toxicity).\n- **Bilateral Renal Artery Stenosis**: Risk of severe acute renal failure.\n- **Concomitant Aliskiren Use**: In diabetic patients due to hyperkalemia and renal failure risk.";
        sources = ["JNC_8_Hypertension_Guidelines.pdf", "Cardiovascular_Pharmacology_2025.pdf"];
      } else if (lowerQ.includes("diabetes")) {
        aiText = "### Type 2 Diabetes Management\nFirst-line therapy remains **Metformin** combined with lifestyle modifications. SGLT2 inhibitors and GLP-1 receptor agonists are prioritized for patients with established ASCVD or heart failure.";
        sources = ["endocrinology_guidelines.pdf"];
      } else {
        isRefused = true;
        aiText = "I can only answer questions based on the uploaded documents. The indexed medical documents do not contain authoritative data matching this query.";
      }

      const aiMsg = {
        id: "msg_a_" + Date.now(),
        role: "assistant",
        isRefused,
        text: aiText,
        sources
      };

      setMessagesMap(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), aiMsg]
      }));

      setIsTyping(false);
    }, 1500);
  };

  // Delete Chat Item
  const handleDeleteChat = (e, groupKey, chatId) => {
    e.stopPropagation();
    setChats(prev => ({
      ...prev,
      [groupKey]: prev[groupKey].filter(c => c.id !== chatId)
    }));
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  // Copy Message Handler
  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen w-full bg-[#0F0A1E] font-sans antialiased text-gray-100 overflow-hidden selection:bg-[#E21B70]/30 selection:text-white">
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* ── LEFT SIDEBAR (280px, dark #0A0614) ── */}
      <aside 
        className={`bg-[#0A0614] border-r border-white/10 flex flex-col justify-between transition-all duration-300 z-50 shrink-0 fixed lg:static inset-y-0 left-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "w-16" : "w-[280px]"}`}
      >
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(226,27,112,0.3)]">
              <Microscope className="w-5 h-5 stroke-[2.2]" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-white text-base tracking-tight truncate">
                MedResearch AI
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Full-width Pink Gradient New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className={`w-full h-11 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#E21B70]/20 hover:opacity-95 active:scale-[0.98] transition-all duration-200 ${
              sidebarCollapsed ? "px-0" : "px-4"
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Chat History List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
            {/* TODAY */}
            <div>
              <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Today
              </div>
              <div className="space-y-1">
                {chats.today.map(c => {
                  const isActive = activeChatId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveChatId(c.id)}
                      onMouseEnter={() => setHoveredChatId(c.id)}
                      onMouseLeave={() => setHoveredChatId(null)}
                      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "bg-gradient-to-r from-[#E21B70]/20 to-[#A53860]/10 border-l-[3px] border-[#E21B70] text-white font-medium shadow-sm"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs truncate leading-snug">{c.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{c.time}</p>
                      </div>
                      {hoveredChatId === c.id && (
                        <button
                          onClick={(e) => handleDeleteChat(e, "today", c.id)}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* YESTERDAY */}
            <div>
              <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Yesterday
              </div>
              <div className="space-y-1">
                {chats.yesterday.map(c => {
                  const isActive = activeChatId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveChatId(c.id)}
                      onMouseEnter={() => setHoveredChatId(c.id)}
                      onMouseLeave={() => setHoveredChatId(null)}
                      className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "bg-gradient-to-r from-[#E21B70]/20 to-[#A53860]/10 border-l-[3px] border-[#E21B70] text-white font-medium shadow-sm"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs truncate leading-snug">{c.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{c.time}</p>
                      </div>
                      {hoveredChatId === c.id && (
                        <button
                          onClick={(e) => handleDeleteChat(e, "yesterday", c.id)}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items (Document Library) */}
        <div className="px-3 py-2 border-t border-white/5">
          <button
            onClick={() => navigate("/documents")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <FolderOpen className="w-4 h-4 text-gray-400 group-hover:text-[#E21B70]" />
            {!sidebarCollapsed && <span>Document Library</span>}
          </button>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-white/10 bg-[#0A0614]">
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer ${
            sidebarCollapsed ? "justify-center" : ""
          }`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
              SS
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Sohail Shabbir</p>
                <p className="text-[10px] text-gray-400 truncate">Admin · Doctor</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button 
                onClick={() => alert("Settings opened.")}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA (background #0F0A1E) ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 px-4 sm:px-6 border-b border-white/10 bg-[#0F0A1E]/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-base font-bold text-white tracking-tight">
              Research Chat
            </h1>
            {/* Green status dot "RAG Online" badge */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>RAG Online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={() => {
                if (activeChatId) {
                  setMessagesMap(prev => ({ ...prev, [activeChatId]: [] }));
                  setIsTyping(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </header>

        {/* Scrollable Conversation View */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* CENTER EMPTY STATE (If current chat has 0 messages) */}
          {currentMessages.length === 0 && !isTyping && (
            <div className="min-h-[calc(100vh-220px)] flex flex-col items-center justify-center text-center p-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-3xl bg-[#E21B70]/30 blur-2xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white shadow-[0_0_50px_rgba(226,27,112,0.4)]">
                  <Microscope className="w-10 h-10 stroke-[2.2]" />
                </div>
              </div>
              <h2 className="text-[24px] font-bold text-white tracking-tight mb-2">
                What would you like to research?
              </h2>
              <p className="text-gray-400 text-sm max-w-md mb-8">
                Answers come only from your indexed medical documents
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl">
                {SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(sug)}
                    className="px-5 py-3 rounded-full bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white text-sm font-medium hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-[#E21B70]/20 flex items-center gap-2"
                  >
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MESSAGES LIST */}
          {currentMessages.map((msg) => {
            const isUser = msg.role === "user";
            const isRefused = msg.isRefused;

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex gap-3 max-w-4xl mx-auto ${isUser ? "justify-end" : "justify-start"}`}
              >
                {/* AI Avatar to the left (28px circle) */}
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-1 shadow-md">
                    AI
                  </div>
                )}

                <div className={`flex flex-col ${isUser ? "items-end max-w-[65%]" : "items-start max-w-[80%]"}`}>
                  
                  {/* USER MESSAGE BUBBLE */}
                  {isUser && (
                    <div className="px-4 py-3 rounded-2xl rounded-tr-[4px] bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white text-[14px] leading-relaxed shadow-md shadow-pink-950/20">
                      {msg.text}
                    </div>
                  )}

                  {/* AI RESPONSE BUBBLE (Standard or Refused) */}
                  {!isUser && (
                    <div
                      className={`p-5 rounded-2xl rounded-tl-[4px] text-sm leading-relaxed ${
                        isRefused
                          ? "bg-amber-500/10 border-l-[3px] border-amber-500 border-t border-r border-b border-amber-500/20 text-amber-200"
                          : "bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md text-gray-100"
                      }`}
                    >
                      {/* Refused Header Badge */}
                      {isRefused && (
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wide mb-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>⚠ Outside document scope</span>
                        </div>
                      )}

                      {/* Markdown Content */}
                      <div className="prose prose-invert prose-sm max-w-none prose-h3:text-white prose-h3:font-bold prose-h3:text-base prose-p:leading-relaxed prose-li:my-1">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Sources Chips BELOW the AI bubble (Not inside) */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 flex flex-col items-start gap-1.5">
                      <span className="text-xs text-gray-400 font-medium">
                        Sources
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {msg.sources.map((src, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white text-xs font-medium shadow-sm hover:brightness-110 transition-all cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-white/90" />
                            <span>{src}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hover Action Buttons Row below AI message */}
                  {!isUser && hoveredMsgId === msg.id && (
                    <div className="flex items-center gap-1.5 mt-2 animate-fade-in">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>📋 Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setFeedbacks(p => ({ ...p, [msg.id]: "up" }))}
                        className={`p-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors ${
                          feedbacks[msg.id] === "up" ? "text-emerald-400" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setFeedbacks(p => ({ ...p, [msg.id]: "down" }))}
                        className={`p-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors ${
                          feedbacks[msg.id] === "down" ? "text-red-400" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                </div>

                {/* User Avatar to the right (28px circle) */}
                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-1 shadow-md">
                    SS
                  </div>
                )}
              </div>
            );
          })}

          {/* ── TYPING INDICATOR STATE (3rd item / active state) ── */}
          {isTyping && (
            <div className="flex gap-3 max-w-4xl mx-auto justify-start items-center">
              {/* 28px AI Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-md">
                AI
              </div>
              {/* Glass Card Bubble containing 3 bouncing pink dots */}
              <div className="px-4 py-3 rounded-2xl rounded-tl-[4px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#E21B70] animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-[#E21B70] animate-bounce [animation-delay:0.15s]" />
                <div className="w-2 h-2 rounded-full bg-[#E21B70] animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── BOTTOM INPUT BAR ── */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-[#0F0A1E]/95 backdrop-blur-md shrink-0 z-20">
          <div className="max-w-4xl mx-auto">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] rounded-2xl p-2 focus-within:border-[#E21B70]/60 transition-all duration-200"
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
                placeholder="Ask a medical research question..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm px-3 py-2 outline-none resize-none min-h-[44px] max-h-32"
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                }}
              />

              {/* Pink Send Button (ACTIVE pink when input has text) */}
              <button
                type="submit"
                disabled={!input.trim()}
                className={`h-[52px] px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shrink-0 ${
                  input.trim()
                    ? "bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white shadow-md shadow-[#E21B70]/25 hover:opacity-95 active:scale-[0.98] cursor-pointer"
                    : "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed opacity-50"
                }`}
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-2.5">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
