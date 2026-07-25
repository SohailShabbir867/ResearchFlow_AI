import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, Users, FileText, MessageSquare, Settings, HeartPulse, 
  BarChart3, ArrowLeft, TrendingUp, TrendingDown, CheckCircle2, Clock, 
  Server, Zap, ShieldCheck, Database, ArrowUpRight, RefreshCw, Menu
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
  },
  {
    id: "act_2",
    icon: "📄",
    title: "Document indexed",
    detail: "Oncology_Immunotherapy_Protocols.docx (145 chunks)",
    time: "45m ago",
    badge: "Document",
  },
  {
    id: "act_3",
    icon: "💬",
    title: "High-frequency clinical query",
    detail: "Endocrinology: Type 2 diabetes dosage protocols",
    time: "1h ago",
    badge: "Query",
  },
  {
    id: "act_4",
    icon: "⚡",
    title: "Vector index optimized",
    detail: "Qdrant DB HNSW collection re-indexed (768-dim embeddings)",
    time: "3h ago",
    badge: "System",
  },
  {
    id: "act_5",
    icon: "🔒",
    title: "Security audit logged",
    detail: "HIPAA document access token rotation completed",
    time: "5h ago",
    badge: "Security",
  },
  {
    id: "act_6",
    icon: "👥",
    title: "Role permission updated",
    detail: "Dr. Marcus Vance promoted to Senior Clinical Lead",
    time: "8h ago",
    badge: "Admin",
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

  const cardStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-color-subtle)",
    boxShadow: "var(--shadow-card)",
  };

  return (
    <div className="admin-ui flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>

      {/* Shared Admin Sidebar */}
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-6 lg:p-8">

        {/* Mobile hamburger header */}
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl border"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color-subtle)", color: "var(--text-muted)" }}
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
              className="p-2 rounded-xl border transition-colors"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color-subtle)", color: "var(--text-muted)" }}
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} style={{ color: isRefreshing ? "var(--brand-primary)" : "inherit" }} />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
                 style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>

        {/* ── STATS ROW (4 Clean White Cards in Light Mode) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Card 1: Total Users */}
          <div className="rounded-2xl p-5 relative overflow-hidden transition-all group" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Total Users
              </span>
              <span className="text-xl">👥</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
              {stats.users}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="text-emerald-600 font-semibold">{stats.activeUsers} active</span> · {stats.pendingUsers} pending
            </p>
          </div>

          {/* Card 2: Documents Indexed */}
          <div className="rounded-2xl p-5 relative overflow-hidden transition-all group" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Documents Indexed
              </span>
              <span className="text-xl">📚</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
              {stats.docs}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>{stats.chunks.toLocaleString()} chunks</span> total
            </p>
          </div>

          {/* Card 3: Queries Today */}
          <div className="rounded-2xl p-5 relative overflow-hidden transition-all group" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Queries Today
              </span>
              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+12%</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
              {stats.queries}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="text-amber-600 font-semibold">{stats.refused} refused</span> · <span className="text-emerald-600 font-semibold">{stats.answered} answered</span>
            </p>
          </div>

          {/* Card 4: Avg Response Time */}
          <div className="rounded-2xl p-5 relative overflow-hidden transition-all group" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Avg Response
              </span>
              <span className="text-xl">⚡</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
              {stats.avgMs}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Target <span className="text-emerald-600 font-semibold">&lt; 5s</span> (Groq LLaMA 3.3)
            </p>
          </div>

        </div>

        {/* ── TWO COLUMN LAYOUT: RECENT ACTIVITY & SERVICE STATUS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT (2/3 width): RECENT ACTIVITY CARD */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-heading)" }}>
                  Recent Activity
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Latest system logs and user interactions
                </p>
              </div>
              <span className="text-xs font-semibold cursor-pointer hover:underline flex items-center gap-1"
                    style={{ color: "var(--brand-primary)" }}>
                View all logs <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* List of 6 Activity Items */}
            <div className="space-y-1">
              {RECENT_ACTIVITIES.map(act => (
                <div
                  key={act.id}
                  className="flex items-center justify-between py-3 px-2 rounded-xl transition-colors"
                  style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                         style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color-subtle)" }}>
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {act.title}
                        </p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: "rgba(142,78,20,0.10)", color: "var(--brand-primary)", border: "1px solid rgba(142,78,20,0.20)" }}>
                          {act.badge}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {act.detail}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium shrink-0 ml-4" style={{ color: "var(--text-muted)" }}>
                    {act.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT (1/3 width): SERVICE STATUS CARD */}
          <div className="lg:col-span-1 rounded-2xl p-6 flex flex-col justify-between" style={cardStyle}>
            <div>
              <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
                <div>
                  <h3 className="text-base font-bold" style={{ color: "var(--text-heading)" }}>
                    Service Status
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Backend architecture health
                  </p>
                </div>
                <Server className="w-4 h-4 text-emerald-500" />
              </div>

              {/* 6 Service Rows */}
              <div className="space-y-3 mb-6">
                {SERVICES.map((srv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {srv.name}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                          {srv.port}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {srv.latency}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}>
                        Online
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary Table */}
            <div className="pt-4 p-3.5 rounded-xl space-y-2 text-xs"
                 style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color-subtle)" }}>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Total Vector Chunks:</span>
                <span className="font-mono font-bold" style={{ color: "var(--text-heading)" }}>4,089</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Vector Dims:</span>
                <span className="font-mono font-bold" style={{ color: "var(--text-heading)" }}>768</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Search Strategy:</span>
                <span className="font-mono font-bold" style={{ color: "var(--brand-primary)" }}>Hybrid + Rerank</span>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
