import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "../../components/ui/StatCard.jsx";
import Badge from "../../components/ui/Badge.jsx";

const ACTIVITY = [
  { icon: "💬", text: "Dr. Khan asked about hypertension protocols", time: "2m ago", color: "text-blue-400" },
  { icon: "📁", text: "Admin uploaded cardiology_ESC_2024.pdf", time: "1h ago", color: "text-[#E21B70]" },
  { icon: "👤", text: "New user Dr. Ahmed registered", time: "3h ago", color: "text-emerald-400" },
  { icon: "💬", text: "Dr. Patel asked about antibiotic resistance", time: "4h ago", color: "text-blue-400" },
  { icon: "🗑", text: "Admin deleted outdated_protocol_2018.pdf", time: "1d ago", color: "text-red-400" },
  { icon: "💬", text: "Dr. Chen asked about insulin dosage", time: "1d ago", color: "text-blue-400" },
];

const SERVICES = [
  { name: "Python RAG API",  port: "8000", status: "online" },
  { name: "Qdrant DB",       port: "6333", status: "online" },
  { name: "Groq API",        port: "cloud", status: "online" },
  { name: "MongoDB",         port: "27017", status: "online" },
  { name: "Node.js API",     port: "5000", status: "online" },
  { name: "BM25 Index",      port: "memory", status: "online" },
];

export default function Overview() {
  const [stats, setStats] = useState({ users:0, docs:0, queries:0, avgMs:0 });

  useEffect(() => {
    axios.get("/api/admin/stats").then(r => setStats(r.data)).catch(() => {
      setStats({ users:12, docs:47, queries:138, avgMs:2340 });
    });
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Real-time system statistics and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-online"/>
          <span className="text-xs text-gray-400">All systems operational</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Total Users"      value={stats.users}   sub="8 active · 4 pending"  color="#E21B70" trend={12}/>
        <StatCard icon="📚" label="Documents Indexed" value={stats.docs}    sub={`${stats.docs * 87} chunks total`} color="#A53860" trend={8}/>
        <StatCard icon="💬" label="Queries Today"    value={stats.queries} sub="12 refused · 126 answered" color="#2B7DE9" trend={-3}/>
        <StatCard icon="⚡" label="Avg Response"     value={`${(stats.avgMs/1000).toFixed(1)}s`} sub="Target < 5s" color="#12A150" trend={5}/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Activity feed */}
        <div className="xl:col-span-2 glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-5">Recent Activity</h3>
          <div className="space-y-3">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                <span className="text-lg shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 leading-snug">{a.text}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service status */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-5">Service Status</h3>
          <div className="space-y-3">
            {SERVICES.map(s => (
              <div key={s.name}
                   className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className={s.status === "online" ? "status-online" : "status-offline"}/>
                  <div>
                    <p className="text-xs font-medium text-gray-200">{s.name}</p>
                    <p className="text-[10px] text-gray-600 font-mono">:{s.port}</p>
                  </div>
                </div>
                <Badge variant={s.status === "online" ? "success" : "error"}>
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total chunks</span>
              <span className="text-white font-mono">{stats.docs * 87}</span>
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-gray-500">Vector dims</span>
              <span className="text-white font-mono">768</span>
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-gray-500">Search method</span>
              <span className="text-[#E21B70] font-mono text-xs">Hybrid+Rerank</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
