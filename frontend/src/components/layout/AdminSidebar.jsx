import { useNavigate, useLocation } from "react-router-dom";
import Avatar from "../ui/Avatar.jsx";

const NAV = [
  { icon: "📊", label: "Overview",       path: "/admin" },
  { icon: "👥", label: "Users",          path: "/admin/users" },
  { icon: "📁", label: "Documents",      path: "/admin/documents" },
  { icon: "📋", label: "Query Logs",     path: "/admin/logs" },
  { icon: "⚙️",  label: "Settings",      path: "/admin/settings" },
  { icon: "💚", label: "System Health",  path: "/admin/health" },
];

export default function AdminSidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = { name: "Admin", role: "Administrator" };

  return (
    <aside className="sidebar w-64 h-screen flex-shrink-0">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center glow-sm">
          <span>🔬</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">MedResearch AI</p>
          <p className="text-[10px] text-[#E21B70] font-semibold uppercase tracking-widest">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <p className="section-title px-2">Management</p>
        {NAV.map(n => {
          const active = location.pathname === n.path;
          return (
            <button key={n.path}
                    onClick={() => navigate(n.path)}
                    className={`sidebar-item w-full text-left ${active ? "sidebar-item-active" : ""}`}>
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E21B70]"/>}
            </button>
          );
        })}

        <div className="divider"/>

        <button onClick={() => navigate("/")}
                className="sidebar-item w-full text-left">
          <span>🔬</span>
          <span>Research Chat</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="sm"/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[10px] text-[#E21B70]">{user.role}</p>
          </div>
          <button className="text-gray-500 hover:text-white transition-colors text-sm"
                  onClick={() => navigate("/login")}>
            ↗
          </button>
        </div>
      </div>
    </aside>
  );
}
