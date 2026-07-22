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
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  Server, 
  Zap, 
  ShieldCheck, 
  Database,
  ArrowUpRight,
  RefreshCw,
  Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";


const RECENT_ACTIVITIES = [
  {
    id: "act_1",
    icon: "👤",
    title: "New user registered",
    detail: "Dr. Elena Rostova (Cardiology)",
    time: "12m ago",
    badge: "User",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  },
  {
    id: "act_2",
    icon: "📄",
    title: "Document indexed",
    detail: "Oncology_Immunotherapy_Protocols.docx (145 chunks)",
    time: "45m ago",
    badge: "Document",
    badgeColor: "bg-[#E21B70]/20 text-[#E21B70] border-[#E21B70]/30"
  },
  {
    id: "act_3",
    icon: "💬",
    title: "High-frequency clinical query",
    detail: "Endocrinology: Type 2 diabetes dosage protocols",
    time: "1h ago",
    badge: "Query",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30"
  },
  {
    id: "act_4",
    icon: "⚡",
    title: "Vector index optimized",
    detail: "Qdrant DB HNSW collection re-indexed (768-dim embeddings)",
    time: "3h ago",
    badge: "System",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  },
  {
    id: "act_5",
    icon: "🔒",
    title: "Security audit logged",
    detail: "HIPAA document access token rotation completed",
    time: "5h ago",
    badge: "Security",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30"
  },
  {
    id: "act_6",
    icon: "👥",
    title: "Role permission updated",
    detail: "Dr. Marcus Vance promoted to Senior Clinical Lead",
    time: "8h ago",
    badge: "Admin",
    badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
  }
];

const SERVICES = [
  { name: "Python RAG API", port: ":8000", status: "online", latency: "42ms" },
  { name: "Qdrant DB", port: ":6333", status: "online", latency: "12ms" },
  { name: "Groq API", port: ":cloud", status: "online", latency: "180ms" },
  { name: "MongoDB", port: ":27017", status: "online", latency: "18ms" },
  { name: "Node.js API", port: ":5000", status: "online", latency: "35ms" },
  { name: "BM25 Index", port: ":memory", status: "online", latency: "<1ms" }
];

export default function AdminDashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    users: 12, activeUsers: 8, pendingUsers: 4,
    docs: 47, chunks: 4089, queries: 138, refused: 12, answered: 126, avgMs: "2.3s"
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setStats(prev => ({ ...prev, queries: prev.queries + 1, answered: prev.answered + 1 }));
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>

      {/* Shared Admin Sidebar — handles its own mobile drawer + navigation */}
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-6 lg:p-8">

        {/* Mobile hamburger header */}
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-muted)" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold" style={{ color: "var(--text-heading)" }}>Dashboard Overview</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
              Dashboard Overview
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Real-time system statistics and activity
            </p>
          </div>

          {/* Top-Right Operational Badge & Theme Toggle */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#E21B70]" : ""}`} />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>

        {/* ── STATS ROW (4 Cards in a Row) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Card 1: Total Users */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 relative overflow-hidden backdrop-blur-md hover:border-[#E21B70]/40 transition-all group">
            <div className="w-24 h-24 rounded-full bg-[#E21B70]/20 blur-xl absolute -top-6 -right-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Total Users
              </span>
              <span className="text-xl">👥</span>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
              {stats.users}
            </div>
            <p className="text-xs text-gray-400">
              <span className="text-emerald-400 font-semibold">{stats.activeUsers} active</span> · {stats.pendingUsers} pending
            </p>
          </div>

          {/* Card 2: Documents Indexed */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 relative overflow-hidden backdrop-blur-md hover:border-[#A53860]/40 transition-all group">
            <div className="w-24 h-24 rounded-full bg-[#A53860]/20 blur-xl absolute -top-6 -right-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Documents Indexed
              </span>
              <span className="text-xl">📚</span>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
              {stats.docs}
            </div>
            <p className="text-xs text-gray-400">
              <span className="text-[#E21B70] font-semibold">{stats.chunks.toLocaleString()} chunks</span> total
            </p>
          </div>

          {/* Card 3: Queries Today */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 relative overflow-hidden backdrop-blur-md hover:border-blue-500/40 transition-all group">
            <div className="w-24 h-24 rounded-full bg-blue-500/20 blur-xl absolute -top-6 -right-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Queries Today
              </span>
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+12%</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
              {stats.queries}
            </div>
            <p className="text-xs text-gray-400">
              <span className="text-amber-400 font-semibold">{stats.refused} refused</span> · <span className="text-emerald-400 font-semibold">{stats.answered} answered</span>
            </p>
          </div>

          {/* Card 4: Avg Response Time */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-5 relative overflow-hidden backdrop-blur-md hover:border-emerald-500/40 transition-all group">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 blur-xl absolute -top-6 -right-6 pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Avg Response
              </span>
              <span className="text-xl">⚡</span>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
              {stats.avgMs}
            </div>
            <p className="text-xs text-gray-400">
              Target <span className="text-emerald-400 font-semibold">&lt; 5s</span> (Groq LLaMA 3.3)
            </p>
          </div>

        </div>


        {/* ── TWO COLUMN LAYOUT: RECENT ACTIVITY & SERVICE STATUS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT (2/3 width): RECENT ACTIVITY GLASS CARD */}
          <div className="lg:col-span-2 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Recent Activity
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Latest system logs and user interactions
                </p>
              </div>
              <span className="text-xs text-[#E21B70] font-semibold cursor-pointer hover:underline flex items-center gap-1">
                View all logs <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* List of 6 Activity Items */}
            <div className="space-y-1">
              {RECENT_ACTIVITIES.map(act => (
                <div
                  key={act.id}
                  className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white truncate">
                          {act.title}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${act.badgeColor}`}>
                          {act.badge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {act.detail}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-gray-500 font-medium shrink-0 ml-4">
                    {act.time}
                  </span>
                </div>
              ))}
            </div>
          </div>


          {/* RIGHT (1/3 width): SERVICE STATUS GLASS CARD */}
          <div className="lg:col-span-1 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Service Status
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Backend architecture health
                  </p>
                </div>
                <Server className="w-4 h-4 text-emerald-400" />
              </div>

              {/* 6 Service Rows */}
              <div className="space-y-3 mb-6">
                {SERVICES.map((srv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-200 truncate">
                          {srv.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {srv.port}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {srv.latency}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                        Online
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary Table */}
            <div className="pt-4 border-t border-white/10 bg-white/[0.02] p-3.5 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Vector Chunks:</span>
                <span className="font-mono font-bold text-white">4,089</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Vector Dims:</span>
                <span className="font-mono font-bold text-white">768</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Search Strategy:</span>
                <span className="font-mono font-bold text-[#E21B70]">Hybrid + Rerank</span>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
