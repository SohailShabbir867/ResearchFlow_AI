import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, Users, FileText, MessageSquare, Settings, HeartPulse, 
  BarChart3, ArrowLeft, Plus, Search, Pencil, PauseCircle, PlayCircle, 
  Trash2, X, AlertTriangle, CheckCircle2, Lock, User, Mail, Shield, 
  Stethoscope, Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const INITIAL_USERS = [
  {
    id: "usr_1",
    name: "Sohail Shabbir",
    email: "sohail@medresearch.ai",
    role: "Admin",
    specialty: "Medical AI Scientist",
    status: "Active",
    lastActive: "1 hour ago",
    queries: 47,
  },
  {
    id: "usr_2",
    name: "Dr. Sarah Khan",
    email: "sarah.khan@hospital.org",
    role: "Doctor",
    specialty: "Pulmonology",
    status: "Suspended",
    lastActive: "20 hours ago",
    queries: 23,
  },
  {
    id: "usr_3",
    name: "Dr. Marcus Vance",
    email: "m.vance@cardio-inst.org",
    role: "Viewer",
    specialty: "Cardiology",
    status: "Active",
    lastActive: "1 hour ago",
    queries: 12,
  },
  {
    id: "usr_4",
    name: "Dr. Yasmin Raza",
    email: "y.raza@endocrinology.med",
    role: "Doctor",
    specialty: "Endocrinology",
    status: "Active",
    lastActive: "3 hours ago",
    queries: 89,
  },
  {
    id: "usr_5",
    name: "Dr. Naveed Deng",
    email: "n.deng@oncology-center.org",
    role: "Researcher",
    specialty: "Oncology",
    status: "Active",
    lastActive: "5 hours ago",
    queries: 34,
  },
  {
    id: "usr_6",
    name: "Dr. Priya Ahmed",
    email: "priya.a@neurology.org",
    role: "Doctor",
    specialty: "Neurology",
    status: "Active",
    lastActive: "12 hours ago",
    queries: 5,
  }
];

export default function UserManagement() {
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [users, setUsers] = useState(INITIAL_USERS);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", role: "Doctor", specialty: "", password: ""
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "All" || user.role === roleFilter;
    const matchesStatus = statusFilter === "All" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;

    const newUser = {
      id: "usr_" + Date.now(),
      name: form.name,
      email: form.email,
      role: form.role,
      specialty: form.specialty || "General Medicine",
      status: "Active",
      lastActive: "Just now",
      queries: 0,
    };

    setUsers(prev => [newUser, ...prev]);
    setShowAddModal(false);
    setForm({ name: "", email: "", role: "Doctor", specialty: "", password: "" });
  };

  const handleToggleStatus = (id) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, status: u.status === "Active" ? "Suspended" : "Active" };
      }
      return u;
    }));
  };

  const handleDeleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    setDeleteConfirmUser(null);
  };

  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-6 lg:p-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-xl border transition-colors"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color-subtle)", color: "var(--text-muted)" }}
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
                User Management
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {users.length} total users
              </p>
            </div>
          </div>

          {/* Top-Right */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={() => setShowAddModal(true)}
              className="h-11 px-5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* ── FILTER ROW ── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-xl outline-none transition-all"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase mr-1" style={{ color: "var(--text-muted)" }}>Role:</span>
            {["All", "Admin", "Doctor", "Researcher", "Viewer"].map(role => {
              const isSelected = roleFilter === role;
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: isSelected ? "var(--brand-primary)" : "var(--bg-card)",
                    color: isSelected ? "#FFFFFF" : "var(--text-muted)",
                    border: isSelected ? "1px solid var(--brand-primary)" : "1px solid var(--border-color-subtle)",
                    boxShadow: isSelected ? "var(--shadow-btn)" : "none",
                  }}
                >
                  {role}
                </button>
              );
            })}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase mr-1" style={{ color: "var(--text-muted)" }}>Status:</span>
            {["All", "Active", "Suspended"].map(st => {
              const isSelected = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: isSelected ? "var(--brand-primary)" : "var(--bg-card)",
                    color: isSelected ? "#FFFFFF" : "var(--text-muted)",
                    border: isSelected ? "1px solid var(--brand-primary)" : "1px solid var(--border-color-subtle)",
                    boxShadow: isSelected ? "var(--shadow-btn)" : "none",
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>

        </div>

        {/* ── USER TABLE ── */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color-subtle)",
          boxShadow: "var(--shadow-card)"
        }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ borderBottom: "1px solid var(--border-color-subtle)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                  <th className="py-4 px-5">Avatar + Name</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Specialty</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Last Active</th>
                  <th className="py-4 px-5">Queries</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredUsers.map((u, idx) => {
                  const isHovered = hoveredRowId === u.id;
                  const isDeleting = deleteConfirmUser?.id === u.id;

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onMouseEnter={() => setHoveredRowId(u.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        className="transition-colors duration-150"
                        style={{
                          borderBottom: "1px solid var(--border-color-subtle)",
                          background: isHovered ? "var(--bg-row-hover)" : "transparent",
                        }}
                      >
                        {/* Avatar + Name */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
                                 style={{ background: "#FFFFFF", border: "1px solid var(--border-color-strong)", color: "var(--brand-primary)" }}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <p className="font-bold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
                                {u.name}
                              </p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-4 px-5">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                                style={{ background: "var(--bg-badge)", color: "var(--text-secondary)", border: "1px solid var(--border-color-subtle)" }}>
                            {u.role}
                          </span>
                        </td>

                        {/* Specialty */}
                        <td className="py-4 px-5 font-medium" style={{ color: "var(--text-secondary)" }}>
                          {u.specialty}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-5">
                          {u.status === "Active" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                  style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                  style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Last Active */}
                        <td className="py-4 px-5" style={{ color: "var(--text-muted)" }}>
                          {u.lastActive}
                        </td>

                        {/* Queries */}
                        <td className="py-4 px-5 font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                          {u.queries}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className={`flex items-center justify-end gap-1.5 transition-opacity ${
                            isHovered ? "opacity-100" : "opacity-40"
                          }`}>
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: "var(--text-muted)" }}
                              title="Edit user details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(u.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: u.status === "Active" ? "var(--text-muted)" : "#10B981" }}
                              title={u.status === "Active" ? "Suspend user" : "Activate user"}
                            >
                              {u.status === "Active" ? (
                                <PauseCircle className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-4 h-4" />
                              )}
                            </button>

                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: "var(--text-muted)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Delete confirmation row */}
                      {isDeleting && (
                        <tr style={{ background: "rgba(239,68,68,0.08)", borderTop: "1px solid rgba(239,68,68,0.25)", borderBottom: "1px solid rgba(239,68,68,0.25)" }}>
                          <td colSpan={7} className="p-4">
                            <div className="flex items-center justify-between max-w-3xl mx-auto">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                                    Delete {u.name}?
                                  </p>
                                  <p className="text-xs text-red-600">
                                    This will remove their account permanently.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setDeleteConfirmUser(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                                  style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
                                >
                                  Delete permanently
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ADD NEW USER MODAL ── */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-[480px] rounded-2xl p-6 relative shadow-2xl animate-fade-in"
                 style={{ background: "var(--bg-card)", border: "1px solid var(--border-color-subtle)" }}>
              
              <div className="flex items-center justify-between mb-6 pb-3" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
                <h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
                  Add New User
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="doctor@hospital.com"
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all cursor-pointer"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Researcher">Researcher</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Medical specialty
                  </label>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => setForm(p => ({ ...p, specialty: e.target.value }))}
                    placeholder="e.g. Cardiology, Endocrinology"
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Temporary password
                  </label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                    style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-all"
                    style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
                  >
                    Create User
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
