import React, { useState, useEffect } from "react";
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
  Server, 
  AlertCircle, 
  CheckCircle2, 
  Database, 
  Cpu, 
  RefreshCw, 
  Info,
  Terminal,
  Layers,
  Zap,
  Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";



export default function SystemHealth() {
  const navigate = useNavigate();

  // Navigation & Page State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHealth = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem("medresearch_token");
      const res = await fetch("/api/admin/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Map API response to service cards
      const svc = data.services || {};
      const newServices = [
        {
          id: "srv_python",
          name: "Python RAG API",
          port: "port 8000",
          status: svc.pythonRag?.status === "online" ? "ONLINE" : "OFFLINE",
          errorText: svc.pythonRag?.error || null,
        },
        {
          id: "srv_qdrant",
          name: "Qdrant Vector DB",
          port: "port 6333",
          status: svc.qdrant?.status === "online" ? "ONLINE" : svc.qdrant?.status === "unknown" ? "UNKNOWN" : "OFFLINE",
          errorText: svc.qdrant?.error || null,
        },
        {
          id: "srv_node",
          name: "Node.js API",
          port: `port ${svc.nodeApi?.port || 5000}`,
          status: svc.nodeApi?.status === "online" ? "ONLINE" : "OFFLINE",
          errorText: null,
        },
        {
          id: "srv_mongo",
          name: "MongoDB",
          port: "port 27017",
          status: svc.mongodb?.status === "online" ? "ONLINE" : "OFFLINE",
          errorText: null,
        },
      ];

      // Add Groq API card from Python data if available
      if (svc.pythonRag?.data?.groq !== undefined) {
        newServices.push({
          id: "srv_groq",
          name: "Groq API",
          port: "cloud",
          status: svc.pythonRag.data.groq === "ok" ? "ONLINE" : "OFFLINE",
          errorText: null,
        });
      }

      setServices(newServices);
      setLastUpdated(new Date().toISOString());

      // Build a log entry from the refresh
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      const offlineServices = newServices.filter(s => s.status === "OFFLINE").map(s => s.name);
      const newLog = {
        type: offlineServices.length > 0 ? "WARNING" : "INFO",
        time: now,
        msg: offlineServices.length > 0
          ? `Health check: ${offlineServices.join(", ")} offline`
          : "Health check: All systems operational.",
      };
      setLogs(prev => [newLog, ...prev.slice(0, 49)]);

      // Show toast for offline services
      if (offlineServices.length > 0) {
        setToastMsg(`${offlineServices.join(", ")} ${offlineServices.length === 1 ? "is" : "are"} currently offline.`);
        setShowToast(true);
      } else {
        setShowToast(false);
      }
    } catch (err) {
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      setLogs(prev => [{ type: "ERROR", time: now, msg: `Health check failed: ${err.message}` }, ...prev.slice(0, 49)]);
    }
    setIsRefreshing(false);
  };

  // Auto-refresh every 30s, and fetch on mount
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => fetchHealth();

  return (
    <div className="admin-ui flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      

      {/* Shared Admin Sidebar with working React Router navigation */}
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />


      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-y-auto p-6 lg:p-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                System Health
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Real-time service telemetry & logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {lastUpdated && (
              <span className="text-[11px] text-gray-500 font-mono hidden sm:block">
                Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}

            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Refresh services"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} style={{ color: isRefreshing ? "var(--brand-primary)" : "inherit" }} />
            </button>
          </div>
        </div>


        {/* ── SERVICE STATUS GRID (3 Columns, 2 Rows = 6 Service Cards) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {services.map(srv => {
            const isOnline = srv.status === "ONLINE";
            const isOffline = srv.status === "OFFLINE";

            return (
              <div
                key={srv.id}
                className={`rounded-2xl p-5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between ${
                  isOffline
                    ? "bg-red-950/30 border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
                    : "bg-emerald-950/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.05)]"
                }`}
              >
                <div>
                  {/* Card Header: Service Name & Dot Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white text-base leading-snug">
                      {srv.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isOnline ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                      }`} />
                      <span className={`text-xs font-bold ${isOnline ? "text-emerald-400" : "text-red-400"}`}>
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>

                  {/* Port Number */}
                  <p className="text-xs text-gray-400 font-mono">
                    {srv.port}
                  </p>

                  {/* Error Detail Text for Offline State */}
                  {isOffline && srv.errorText && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-200 leading-relaxed font-medium">
                        {srv.errorText}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>


        {/* ── QDRANT STATS SECTION (Below Grid) ── */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-4 backdrop-blur-md mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <span className="text-gray-400">Total chunks:</span>
              <span className="font-mono text-white font-bold">4,089</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Vector dimensions:</span>
              <span className="font-mono text-white font-bold">768</span>
            </div>

            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400">Collection:</span>
              <span className="font-mono text-white font-bold">cybersec</span>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-400">Search:</span>
              <span className="font-mono font-bold" style={{ color: "var(--brand-primary)" }}>Hybrid+Rerank</span>
            </div>
          </div>
        </div>


        {/* ── SERVER LOGS SECTION (Dark Terminal Container) ── */}
        <div className="rounded-2xl bg-[#0A0614] border border-white/10 p-5 shadow-2xl font-mono text-xs mb-8 relative">
          
          {/* Header & Auto-refresh Indicator */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-gray-300">
              <Terminal className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <span className="font-bold text-white text-sm">Server Telemetry Logs</span>
            </div>

            <span className="text-[11px] text-gray-500 font-medium">
              ↻ Auto-refreshes every 30s
            </span>
          </div>

          {/* Log Lines Container */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {logs.map((log, i) => {
              const isErr = log.type === "ERROR";
              const isWarn = log.type === "WARNING";

              return (
                <div key={i} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-gray-500 shrink-0 select-none">
                    {log.time}
                  </span>

                  <div className="flex-1 min-w-0">
                    {isErr && (
                      <span className="text-red-400 font-semibold">
                        {log.msg}
                      </span>
                    )}
                    {isWarn && (
                      <span className="text-amber-400 font-semibold">
                        {log.msg}
                      </span>
                    )}
                    {!isErr && !isWarn && (
                      <span className="text-gray-300">
                        {log.msg}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TOAST NOTIFICATION (Bottom Right Blue Info Toast) ── */}
        {showToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-blue-600/95 border border-blue-400/50 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
            <Info className="w-5 h-5 text-blue-200 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs leading-relaxed font-medium">
              {toastMsg || "A service is currently offline. System capabilities may be degraded."}
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-blue-200 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
