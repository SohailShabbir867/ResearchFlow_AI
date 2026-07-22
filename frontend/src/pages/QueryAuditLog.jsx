import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  Users, 
  FileText, 
  MessageSquare, 
  Settings, 
  HeartPulse, 
  BarChart3, 
  ArrowLeft, 
  Download, 
  Search, 
  Calendar, 
  User, 
  Filter, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Menu
} from "lucide-react";

// Mock Query Audit Log Dataset matching visual prompt
const MOCK_QUERY_LOGS = [
  {
    id: "q_1",
    timestamp: "Jul 12, 2025 14:32",
    user: "Sohail Shabbir",
    userRole: "Admin",
    userAvatarBg: "from-[#E21B70] to-[#A53860]",
    question: "What are Type 2 diabetes treatments for chronic hypertension in elderly patients?",
    status: "Answered",
    sourcesCount: 21,
    ms: 3300,
    answer: "According to recent ADA and JNC 8 clinical guidelines, initial pharmacologic management for elderly patients with comorbid Type 2 diabetes and hypertension includes ACE inhibitors (or ARBs) combined with long-acting calcium channel blockers. Metformin remains first-line for glycemic control.",
    breakdown: { embed: 110, search: 42, rerank: 88, llm: 3060, total: 3300 }
  },
  {
    id: "q_2",
    timestamp: "Jul 12, 2025 14:15",
    user: "Sohail Shabbir",
    userRole: "Admin",
    userAvatarBg: "from-[#E21B70] to-[#A53860]",
    question: "Recommended dosage protocols for chronic heart failure with reduced ejection fraction...",
    status: "Answered",
    sourcesCount: 17,
    ms: 3500,
    answer: "Guideline-directed medical therapy (GDMT) for HFrEF includes quad therapy: ARNI (Sacubitril/Valsartan), Beta-blockers (Bisoprolol/Carvedilol), MRA (Spironolactone), and SGLT2 inhibitors (Dapagliflozin/Empagliflozin).",
    breakdown: { embed: 95, search: 38, rerank: 75, llm: 3292, total: 3500 }
  },
  {
    id: "q_3",
    timestamp: "Jul 12, 2025 13:40",
    user: "Dr. Sarah Khan",
    userRole: "Doctor",
    userAvatarBg: "from-blue-500 to-indigo-600",
    question: "What are the Type 2 diabetes protocols for acute myocardial infarction off-label dosage?",
    status: "Refused",
    sourcesCount: 13,
    ms: 3500,
    answer: "I can only answer questions based on the uploaded documents. The provided clinical search index does not contain verified guidelines or protocol data regarding off-label experimental dosages for acute myocardial infarction in diabetic patients.",
    breakdown: { embed: 88, search: 50, rerank: 62, llm: 3300, total: 3500 }
  },
  {
    id: "q_4",
    timestamp: "Jul 12, 2025 12:20",
    user: "Sohail Shabbir",
    userRole: "Admin",
    userAvatarBg: "from-[#E21B70] to-[#A53860]",
    question: "What are the Type 2 chronic treatment options in pulmonary hypertension?",
    status: "Answered",
    sourcesCount: 16,
    ms: 1850,
    answer: "Targeted therapies for pulmonary arterial hypertension (PAH) include endothelin receptor antagonists (Ambrisentan), PDE-5 inhibitors (Sildenafil), and prostacyclin pathway agonists.",
    breakdown: { embed: 70, search: 30, rerank: 50, llm: 1700, total: 1850 }
  },
  {
    id: "q_5",
    timestamp: "Jul 12, 2025 11:05",
    user: "Dr. Marcus Vance",
    userRole: "Viewer",
    userAvatarBg: "from-purple-500 to-violet-600",
    question: "Request for off-label dosage information regarding investigational Drug X...",
    status: "Refused",
    sourcesCount: 10,
    ms: 4500,
    answer: "I can only answer questions based on the uploaded documents. Investigational Drug X is not indexed in the current medical database.",
    breakdown: { embed: 130, search: 60, rerank: 110, llm: 4200, total: 4500 }
  },
  {
    id: "q_6",
    timestamp: "Jul 12, 2025 10:14",
    user: "Sohail Shabbir",
    userRole: "Admin",
    userAvatarBg: "from-[#E21B70] to-[#A53860]",
    question: "What are the Type 2 Chronic treatment in diabetic nephropathy?",
    status: "Answered",
    sourcesCount: 19,
    ms: 2500,
    answer: "Management includes strict glycemic control (HbA1c < 7.0%), RAS blockade (ACEi/ARB) for proteinuria, and SGLT2 inhibitors which demonstrate proven renal protective benefits.",
    breakdown: { embed: 85, search: 35, rerank: 60, llm: 2320, total: 2500 }
  },
  {
    id: "q_7",
    timestamp: "Jul 12, 2025 09:30",
    user: "Dr. Yasmin Raza",
    userRole: "Doctor",
    userAvatarBg: "from-emerald-500 to-teal-600",
    question: "What are the off-label diabetes hypertension drug interactions?",
    status: "Answered",
    sourcesCount: 12,
    ms: 5000,
    answer: "Dual RAS blockade (combining ACE inhibitors with ARBs or Aliskiren) is contraindicated due to increased risks of hyperkalemia, hypotension, and acute kidney injury.",
    breakdown: { embed: 140, search: 70, rerank: 120, llm: 4670, total: 5000 }
  }
];

export default function QueryAuditLog() {
  const navigate = useNavigate();

  // Active Navigation & Filters
  const [activeNav, setActiveNav] = useState("Logs");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("from date — to date");
  const [userFilter, setUserFilter] = useState("All Users");
  const [statusFilter, setStatusFilter] = useState("All");

  // Selection & Modal States
  const [selectedLog, setSelectedLog] = useState(null);
  const [hoveredQuestionId, setHoveredQuestionId] = useState(null);

  // Filter Logic
  const filteredLogs = MOCK_QUERY_LOGS.filter(log => {
    const matchesSearch = log.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.user.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUser = userFilter === "All Users" || log.user === userFilter;
    const matchesStatus = statusFilter === "All" || log.status === statusFilter;
    return matchesSearch && matchesUser && matchesStatus;
  });

  // Export CSV Action
  const handleExportCSV = () => {
    const csvHeader = "Timestamp,User,Question,Status,SourcesUsed,ResponseTimeMs\n";
    const csvRows = filteredLogs.map(l => 
      `"${l.timestamp}","${l.user}","${l.question.replace(/"/g, '""')}","${l.status}",${l.sourcesCount},${l.ms}`
    ).join("\n");

    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_audit_logs_${Date.now()}.csv`;
    a.click();
  };

  // Response Time Color Helper
  const getResponseTimeColor = (ms) => {
    if (ms < 2000) return "text-emerald-400";
    if (ms <= 4000) return "text-amber-400";
    return "text-red-400";
  };

  // User Avatar Initials Helper
  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
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

      {/* ── LEFT ADMIN SIDEBAR (256px, darkest #0A0614) ── */}
      <aside className={`w-64 bg-[#0A0614] border-r border-white/10 flex flex-col justify-between h-screen shrink-0 z-50 fixed lg:static inset-y-0 left-0 transition-transform duration-300 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        
        <div>
          {/* Logo + Admin Panel Tag */}
          <div className="p-5 border-b border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(226,27,112,0.3)]">
              <Microscope className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight tracking-tight">
                MedResearch AI
              </p>
              <p className="text-[10px] text-[#E21B70] font-bold uppercase tracking-widest mt-0.5">
                ADMIN PANEL
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {[
              { id: "Overview", icon: BarChart3, label: "Overview", path: "/admin" },
              { id: "Users", icon: Users, label: "Users", path: "/admin/users" },
              { id: "Documents", icon: FileText, label: "Documents", path: "/documents" },
              { id: "Logs", icon: MessageSquare, label: "Query Logs", path: "/admin" },
              { id: "Settings", icon: Settings, label: "Settings", path: "/admin" },
              { id: "Health", icon: HeartPulse, label: "System Health", path: "/admin" },
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    if (item.id === "Overview") navigate("/admin");
                    if (item.id === "Users") navigate("/admin/users");
                    if (item.id === "Documents") navigate("/documents");
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? "bg-gradient-to-r from-[#E21B70]/20 to-[#A53860]/10 border-l-[3px] border-[#E21B70] text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#E21B70]" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="border-t border-white/10 my-3 pt-3" />

            {/* Back to Research Chat Link */}
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-[#E21B70]" />
              <span>Research Chat</span>
            </button>
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0A0614]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
              SS
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Sohail Shabbir</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="bg-[#E21B70]/20 text-[#E21B70] border border-[#E21B70]/30 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>


      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-y-auto p-6 lg:p-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                Query Audit Log
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Full history of all questions
              </p>
            </div>
          </div>

          {/* Top-Right: Export CSV Secondary Button */}
          <button
            onClick={handleExportCSV}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-[#E21B70]" />
            <span>Export CSV</span>
          </button>
        </div>


        {/* ── FILTER BAR (ALL ON ONE ROW) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 bg-white/[0.02] p-3 rounded-2xl border border-white/10 backdrop-blur-md">
          
          {/* 1. Search Question Text */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text..."
              className="w-full h-9 pl-9 pr-3 text-xs text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
            />
          </div>

          {/* 2. Date Range Picker (Ghost Field) */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              placeholder="from date — to date"
              className="w-full h-9 pl-9 pr-3 text-xs text-gray-300 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
            />
          </div>

          {/* 3. User Dropdown */}
          <div>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs text-gray-200 bg-[#160E2E] border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
            >
              <option value="All Users">All Users</option>
              <option value="Sohail Shabbir">Sohail Shabbir (Admin)</option>
              <option value="Dr. Sarah Khan">Dr. Sarah Khan</option>
              <option value="Dr. Marcus Vance">Dr. Marcus Vance</option>
              <option value="Dr. Yasmin Raza">Dr. Yasmin Raza</option>
            </select>
          </div>

          {/* 4. Status Filter Dropdown / Pills */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs text-gray-200 bg-[#160E2E] border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Answered">Answered</option>
              <option value="Refused">Refused</option>
            </select>
          </div>

        </div>


        {/* ── LOG TABLE (Glass Card Container, Alternating Rows) ── */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md overflow-hidden shadow-xl mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Question</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sources used</th>
                  <th className="py-3.5 px-4">Response time</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-200">
                {filteredLogs.map((log, idx) => {
                  const isHoveredQuestion = hoveredQuestionId === log.id;

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-white/[0.04] transition-colors ${
                        idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                      }`}
                    >
                      {/* Timestamp Monospace */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      {/* User Avatar + Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${log.userAvatarBg} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm`}>
                            {getInitials(log.user)}
                          </div>
                          <span className="font-semibold text-white text-xs">
                            {log.user}
                          </span>
                        </div>
                      </td>

                      {/* Question (2-line truncation + Expandable Tooltip Card on Hover) */}
                      <td className="py-3.5 px-4 max-w-sm relative">
                        <div 
                          onMouseEnter={() => setHoveredQuestionId(log.id)}
                          onMouseLeave={() => setHoveredQuestionId(null)}
                          className="cursor-pointer"
                        >
                          <p className="line-clamp-2 text-xs text-gray-200 leading-snug font-medium hover:text-white transition-colors">
                            {log.question}
                          </p>

                          {/* Hover Tooltip Card */}
                          {isHoveredQuestion && (
                            <div className="absolute left-4 top-full mt-1 z-40 p-3 rounded-xl bg-[#1A1230] border border-white/20 text-white text-xs shadow-2xl max-w-md w-max pointer-events-none animate-fade-in">
                              <p className="font-semibold text-[#E21B70] text-[10px] uppercase mb-1">Full Question Text:</p>
                              <p className="leading-relaxed">{log.question}</p>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.status === "Answered" ? (
                          <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px]">
                            Answered
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-[11px]">
                            Refused
                          </span>
                        )}
                      </td>

                      {/* Sources Used Badge (Blue circle badge with number count) */}
                      <td className="py-3.5 px-4">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold font-mono">
                          {log.sourcesCount}
                        </div>
                      </td>

                      {/* Response Time Mono Font Colored */}
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <span className={getResponseTimeColor(log.ms)}>
                          {log.ms}ms
                        </span>
                      </td>

                      {/* View Action Link */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs font-semibold text-[#E21B70] hover:underline hover:text-[#c4155f] flex items-center justify-end gap-1 ml-auto transition-colors"
                        >
                          <span>View full conversation</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>


        {/* ── LOG DETAIL MODAL (640px Wide Dark Glass Modal) ── */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-[640px] rounded-2xl bg-[#140E26] border border-white/10 p-6 relative shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Query Inspection Detail
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    Log ID: {selectedLog.id} · {selectedLog.timestamp}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2x2 Grid of Info Cards */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Info Card 1: User */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                    User
                  </span>
                  <p className="text-xs font-bold text-white">
                    {selectedLog.user}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {selectedLog.userRole}
                  </p>
                </div>

                {/* Info Card 2: Status */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                    Status
                  </span>
                  {selectedLog.status === "Answered" ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                      Answered
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold">
                      Refused
                    </span>
                  )}
                </div>

                {/* Info Card 3: Response Time */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                    Response Time
                  </span>
                  <span className={`text-sm font-mono font-bold ${getResponseTimeColor(selectedLog.ms)}`}>
                    {selectedLog.ms}ms
                  </span>
                </div>

                {/* Info Card 4: Sources Used */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">
                    Sources Used
                  </span>
                  <span className="text-xs font-bold text-blue-400">
                    {selectedLog.sourcesCount} vector sources
                  </span>
                </div>
              </div>

              {/* Question Section */}
              <div className="mb-4">
                <span className="text-xs font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
                  Question
                </span>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-sm leading-relaxed">
                  {selectedLog.question}
                </div>
              </div>

              {/* AI Answer Section */}
              <div className="mb-5">
                <span className="text-xs font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
                  AI Answer
                </span>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs leading-relaxed max-h-[160px] overflow-y-auto">
                  {selectedLog.answer}
                </div>
              </div>

              {/* Timing Breakdown Table */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 mb-6">
                <span className="text-xs font-semibold text-gray-300 block mb-3 uppercase tracking-wider">
                  RAG Pipeline Latency Breakdown
                </span>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-[10px] text-gray-500 block">Embed</span>
                    <span className="font-mono font-bold text-gray-200">{selectedLog.breakdown.embed}ms</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-[10px] text-gray-500 block">Search</span>
                    <span className="font-mono font-bold text-gray-200">{selectedLog.breakdown.search}ms</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-[10px] text-gray-500 block">Rerank</span>
                    <span className="font-mono font-bold text-gray-200">{selectedLog.breakdown.rerank}ms</span>
                  </div>
                  <div className="p-2 rounded bg-white/5">
                    <span className="text-[10px] text-gray-500 block">LLM Gen</span>
                    <span className="font-mono font-bold text-gray-200">{selectedLog.breakdown.llm}ms</span>
                  </div>
                  <div className="p-2 rounded bg-[#E21B70]/20 border border-[#E21B70]/30">
                    <span className="text-[10px] text-[#E21B70] font-bold block">Total</span>
                    <span className="font-mono font-bold text-white">{selectedLog.breakdown.total}ms</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2.5 rounded-xl bg-[#E21B70] text-white text-sm font-semibold hover:bg-[#c4155f] transition-colors"
              >
                Close Inspection
              </button>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
