import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../../components/layout/AdminSidebar.jsx";
import { Menu } from "lucide-react";

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-page)" }}>
      {/* Sidebar */}
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 h-14 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-sidebar)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl transition-colors"
            style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Admin Panel
          </span>
        </header>

        {/* Page content rendered by child route */}
        <Outlet />
      </div>
    </div>
  );
}
