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
  Plus, 
  Search, 
  Pencil, 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  X, 
  AlertTriangle,
  CheckCircle2,
  Lock,
  User,
  Mail,
  Shield,
  Stethoscope,
  Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";


// Mock Users Dataset matching visual spec
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
    avatarBg: "from-[#E21B70] to-[#A53860]"
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
    avatarBg: "from-blue-500 to-indigo-600"
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
    avatarBg: "from-purple-500 to-violet-600"
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
    avatarBg: "from-blue-500 to-indigo-600"
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
    avatarBg: "from-emerald-500 to-teal-600"
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
    avatarBg: "from-blue-500 to-indigo-600"
  }
];

export default function UserManagement() {
  const navigate = useNavigate();

  // Navigation & Active State
  const [activeNav, setActiveNav] = useState("Users");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [users, setUsers] = useState(INITIAL_USERS);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Hover & Action State
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Add User Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Doctor",
    specialty: "",
    password: ""
  });

  // Filter Users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "All" || user.role === roleFilter;
    const matchesStatus = statusFilter === "All" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handle Add User Submit
  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;

    let avatarBg = "from-blue-500 to-indigo-600";
    if (form.role === "Admin") avatarBg = "from-[#E21B70] to-[#A53860]";
    if (form.role === "Researcher") avatarBg = "from-emerald-500 to-teal-600";
    if (form.role === "Viewer") avatarBg = "from-purple-500 to-violet-600";

    const newUser = {
      id: "usr_" + Date.now(),
      name: form.name,
      email: form.email,
      role: form.role,
      specialty: form.specialty || "General Medicine",
      status: "Active",
      lastActive: "Just now",
      queries: 0,
      avatarBg
    };

    setUsers(prev => [newUser, ...prev]);
    setShowAddModal(false);
    setForm({ name: "", email: "", role: "Doctor", specialty: "", password: "" });
  };

  // Toggle Suspend / Active Status
  const handleToggleStatus = (id) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        return {
          ...u,
          status: u.status === "Active" ? "Suspended" : "Active"
        };
      }
      return u;
    }));
  };

  // Permanently Delete User
  const handleDeleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    setDeleteConfirmUser(null);
  };

  // Helper for Initials
  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Role Badge Styling
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "Admin":
        return "bg-[#E21B70]/20 text-[#E21B70] border-[#E21B70]/30";
      case "Doctor":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Researcher":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Viewer":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      
      {/* Mobile Sidebar Backdrop Overlay */}

      {/* Shared Admin Sidebar */}
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
                User Management
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {users.length} total users
              </p>
            </div>
          </div>

          {/* Top-Right: ThemeToggle + Add User Button */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={() => setShowAddModal(true)}
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-sm flex items-center gap-2 shadow-md shadow-[#E21B70]/25 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
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
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full h-10 pl-10 pr-4 text-sm text-white bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] rounded-xl outline-none focus:border-[#E21B70] transition-all"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Role:</span>
            {["All", "Admin", "Doctor", "Researcher", "Viewer"].map(role => {
              const isSelected = roleFilter === role;
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[#E21B70]/20 border border-[#E21B70] text-[#E21B70] shadow-sm"
                      : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Status:</span>
            {["All", "Active", "Suspended"].map(st => {
              const isSelected = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[#E21B70]/20 border border-[#E21B70] text-[#E21B70] shadow-sm"
                      : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>

        </div>


        {/* ── USER TABLE (Glass Card Container, Alternating Row Shading) ── */}
        <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md overflow-hidden shadow-xl mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-4 px-5">Avatar + Name</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Specialty</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Last Active</th>
                  <th className="py-4 px-5">Queries</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-200">
                {filteredUsers.map((u, idx) => {
                  const isHovered = hoveredRowId === u.id;
                  const isDeleting = deleteConfirmUser?.id === u.id;

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onMouseEnter={() => setHoveredRowId(u.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        className={`transition-colors duration-150 ${
                          idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                        } ${isHovered ? "bg-white/[0.05]" : ""}`}
                      >
                        {/* Avatar + Name & Email */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${u.avatarBg} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white leading-snug">
                                {u.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-4 px-5">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeStyle(u.role)}`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Specialty */}
                        <td className="py-4 px-5 text-gray-300 font-medium">
                          {u.specialty}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-5">
                          {u.status === "Active" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Last Active */}
                        <td className="py-4 px-5 text-gray-400">
                          {u.lastActive}
                        </td>

                        {/* Queries Count */}
                        <td className="py-4 px-5 font-mono text-white font-semibold">
                          {u.queries}
                        </td>

                        {/* Hover Action Buttons: Pencil | Toggle | Trash */}
                        <td className="py-4 px-5 text-right">
                          <div className={`flex items-center justify-end gap-1.5 transition-opacity ${
                            isHovered ? "opacity-100" : "opacity-40"
                          }`}>
                            
                            {/* Pencil / Edit Button */}
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Edit user details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={() => handleToggleStatus(u.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.status === "Active"
                                  ? "text-gray-400 hover:text-amber-400 hover:bg-amber-500/10"
                                  : "text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                              title={u.status === "Active" ? "Suspend user" : "Activate user"}
                            >
                              {u.status === "Active" ? (
                                <PauseCircle className="w-4 h-4" />
                              ) : (
                                <PlayCircle className="w-4 h-4 text-emerald-400" />
                              )}
                            </button>

                            {/* Trash / Delete Button */}
                            <button
                              onClick={() => setDeleteConfirmUser(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>
                      </tr>

                      {/* ── DELETE CONFIRMATION CARD (Inline under row) ── */}
                      {isDeleting && (
                        <tr className="bg-red-500/10 border-t border-b border-red-500/30">
                          <td colSpan={7} className="p-4">
                            <div className="flex items-center justify-between max-w-3xl mx-auto">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-bold text-white">
                                    Delete {u.name}?
                                  </p>
                                  <p className="text-xs text-red-200">
                                    This will remove their account and all associated chat history permanently.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setDeleteConfirmUser(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
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


        {/* ── ADD NEW USER MODAL (Floating 480px Dark Glass Modal) ── */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-[480px] rounded-2xl bg-[#140E26] border border-white/10 p-6 relative shadow-2xl animate-fade-in">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Add New User
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateUser} className="space-y-4">
                
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-300">
                      Full name
                    </label>
                    <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-300">
                      Email address
                    </label>
                    <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="doctor@hospital.com"
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
                  />
                </div>

                {/* Role Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-300">
                      Role
                    </label>
                    <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                  </div>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full h-11 px-4 text-sm text-white bg-[#1A1230] border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Researcher">Researcher</option>
                    <option value="Viewer">Viewer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {/* Medical Specialty */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-300">
                      Medical specialty
                    </label>
                    <span className="text-[11px] text-gray-500">optional</span>
                  </div>
                  <input
                    type="text"
                    value={form.specialty}
                    onChange={(e) => setForm(p => ({ ...p, specialty: e.target.value }))}
                    placeholder="e.g. Cardiology, Endocrinology"
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
                  />
                </div>

                {/* Temporary Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-300">
                      Temporary password
                    </label>
                    <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                  </div>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
                  />
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-sm hover:opacity-95 shadow-md shadow-[#E21B70]/25 transition-all"
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
