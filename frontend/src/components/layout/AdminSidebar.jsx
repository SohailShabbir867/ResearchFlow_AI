import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, LayoutDashboard, Users, FileStack, ScrollText,
  Settings, Activity, ArrowLeft, X, LogOut,
} from "lucide-react";
import { logoutUser } from "../../store/authSlice.js";
import ThemeToggle from "../ThemeToggle.jsx";

const NAV_ITEMS = [
  { path: "/admin",           icon: LayoutDashboard, label: "Overview"      },
  { path: "/admin/users",     icon: Users,           label: "Users"         },
  { path: "/admin/documents", icon: FileStack,       label: "Documents"     },
  { path: "/admin/logs",      icon: ScrollText,      label: "Query Logs"    },
  { path: "/admin/settings",  icon: Settings,        label: "Settings"      },
  { path: "/admin/health",    icon: Activity,        label: "System Health" },
];

export default function AdminSidebar({ mobileOpen, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user     = useSelector(s => s.auth.user);

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const userInitials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
    : "AD";

  function handleNav(path) {
    navigate(path);
    if (onMobileClose) onMobileClose();
  }

  async function handleLogout() {
    await dispatch(logoutUser());
    navigate("/login");
  }

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        width: "256px",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-color-subtle)",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--brand-primary)" }}
          >
            <Microscope className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest leading-none"
               style={{ color: "var(--text-primary)" }}>MedResearch</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
               style={{ color: "var(--brand-primary)" }}>Admin Panel</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-0.5">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                color:      active ? "var(--brand-primary)" : "var(--text-muted)",
                background: active ? "rgba(142,78,20,0.10)" : "transparent",
                border:     active ? "1px solid rgba(142,78,20,0.20)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.background = "rgba(142,78,20,0.06)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--brand-primary)" }} />
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-3" style={{ borderTop: "1px solid var(--border-color-subtle)" }} />

        {/* Back to Research Chat */}
        <button
          onClick={() => { navigate("/"); if (onMobileClose) onMobileClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "rgba(142,78,20,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Research Chat</span>
        </button>
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0 px-4 py-4" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "var(--brand-primary)" }}
          >
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {user?.name || "Admin"}
            </p>
            <p className="text-[10px] font-medium" style={{ color: "var(--brand-primary)" }}>
              Administrator
            </p>
          </div>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={onMobileClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
                style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
