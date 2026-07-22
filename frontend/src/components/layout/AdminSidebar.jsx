import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope,
  LayoutDashboard,
  Users,
  FileStack,
  ScrollText,
  Settings,
  Activity,
  ArrowLeft,
  X,
} from "lucide-react";
import { logoutUser } from "../../store/authSlice.js";
import ThemeToggle from "../ThemeToggle.jsx";

const NAV_ITEMS = [
  { path: "/admin",          icon: LayoutDashboard, label: "Overview"      },
  { path: "/admin/users",    icon: Users,           label: "Users"         },
  { path: "/admin/documents",icon: FileStack,        label: "Documents"     },
  { path: "/admin/logs",     icon: ScrollText,       label: "Query Logs"    },
  { path: "/admin/settings", icon: Settings,         label: "Settings"      },
  { path: "/admin/health",   icon: Activity,         label: "System Health" },
];

export default function AdminSidebar({ mobileOpen, onMobileClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector(s => s.auth.user);

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

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        width: "256px",
        background: "#070412",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Logo + Admin Label ── */}
      <div className="px-5 py-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center shadow-[0_0_16px_rgba(226,27,112,0.4)]">
            <Microscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">MedResearch</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#E21B70] mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto sidebar-scroll space-y-1">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            onClick={() => handleNav(path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive(path)
                ? "text-[#E21B70] border border-[#E21B70]/25"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
            style={isActive(path) ? {
              background: "linear-gradient(135deg, rgba(226,27,112,0.15), rgba(165,56,96,0.08))",
            } : {}}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive(path) ? "text-[#E21B70]" : ""}`} />
            <span>{label}</span>
            {isActive(path) && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E21B70] shadow-[0_0_6px_#E21B70]" />
            )}
          </button>
        ))}

        {/* ── Divider ── */}
        <div className="border-t border-white/5 my-3" />

        {/* ── Back to Research Chat ── */}
        <button
          onClick={() => { navigate("/"); if (onMobileClose) onMobileClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Research Chat</span>
        </button>
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0 px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #E21B70, #A53860)" }}
          >
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name || "Admin"}</p>
            <p className="text-[10px] text-[#E21B70] font-medium">Administrator</p>
          </div>
          <ThemeToggle />
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
            className="fixed inset-0 bg-black/70 z-40 lg:hidden"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={onMobileClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-gray-400"
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
