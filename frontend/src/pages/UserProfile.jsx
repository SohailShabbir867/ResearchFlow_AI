import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { logoutUser } from "../store/authSlice.js";
import { 
  Microscope, 
  Plus, 
  Trash2, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Key, 
  Save, 
  FolderOpen,
  Camera,
  X,
  Menu
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function UserProfile() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === "admin";

  // Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.name || "Dr. Sohail Shabbir");
  const [email] = useState(user?.email || "sohail.shabbir@medresearch.ai");
  const [specialty, setSpecialty] = useState(user?.specialty || "Cardiology & Medical AI");
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  // Danger Zone Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const userInitials = (fullName || "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Calculate Password Strength
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10 && /[A-Z]/.test(pass) && /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score === 1) return { score: 1, label: "Weak", color: "bg-red-500", text: "text-red-400" };
    if (score === 2) return { score: 2, label: "Medium", color: "bg-amber-500", text: "text-amber-400" };
    return { score: 3, label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" };
  };

  const pwStrength = getPasswordStrength(newPassword);

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    try {
      const token = localStorage.getItem("medresearch_token");
      await axios.patch("/api/auth/profile", { name: fullName, specialty }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setProfileSuccessMsg("Profile information updated successfully!");
    } catch (err) {
      setProfileSuccessMsg(err?.response?.data?.error || "Failed to update profile.");
    }
    setTimeout(() => setProfileSuccessMsg(""), 3000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordErrorMsg("");
    setPasswordSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("New passwords do not match. Please verify.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErrorMsg("New password must be at least 6 characters.");
      return;
    }

    try {
      const token = localStorage.getItem("medresearch_token");
      await axios.post("/api/auth/change-password", { currentPassword, newPassword }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setPasswordSuccessMsg("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordErrorMsg(err?.response?.data?.error || "Failed to change password.");
    }
    setTimeout(() => setPasswordSuccessMsg(""), 4000);
    setTimeout(() => setPasswordErrorMsg(""), 4000);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.trim() !== "DELETE") return;
    try {
      const token = localStorage.getItem("medresearch_token");
      await axios.delete("/api/auth/account", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (_e) {
      // Even if delete fails on server, we clear local session
    }
    dispatch(logoutUser());
    setShowDeleteModal(false);
    navigate("/login");
  };

  const isPasswordFormValid = currentPassword && newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div
      className="flex h-screen w-full font-sans antialiased overflow-hidden"
      style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}
    >
      {/* ── Mobile backdrop ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        style={{
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color-subtle)",
          width: sidebarCollapsed ? "64px" : "260px",
          transition: "width 0.25s ease",
        }}
        className={`flex flex-col h-full shrink-0 z-50 fixed lg:static inset-y-0 left-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo header */}
        <div
          className="flex items-center justify-between px-4 h-14 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              <Microscope className="w-4 h-4" strokeWidth={2.2} />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-sm tracking-tight truncate" style={{ color: "var(--text-heading)" }}>
                CyberSecAI
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => navigate("/")}
            className={`w-full h-11 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all duration-200 ${
              sidebarCollapsed ? "px-0" : "px-4"
            }`}
            style={{ background: "var(--brand-primary)" }}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <Microscope className="w-4 h-4" />
            {!sidebarCollapsed && <span>Research Chat</span>}
          </button>

          <button
            onClick={() => navigate("/documents")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ color: "var(--text-muted)" }}
          >
            <FolderOpen className="w-4 h-4" />
            {!sidebarCollapsed && <span>Document Library</span>}
          </button>

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
              style={{ color: "var(--text-muted)" }}
            >
              <Settings className="w-4 h-4" />
              {!sidebarCollapsed && <span>Admin Dashboard</span>}
            </button>
          )}
        </div>

        {/* User Footer (HIGHLIGHTED FOR PROFILE) */}
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid var(--border-color-subtle)", background: "var(--bg-sidebar)" }}>
          <div 
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
            style={{
              background: "var(--bg-badge)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
              style={{ background: "var(--brand-primary)" }}
            >
              {userInitials}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-heading)" }}>{fullName}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{specialty}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <span className="text-xs font-bold" style={{ color: "var(--brand-primary)" }}>Profile</span>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-y-auto p-6 lg:p-8" style={{ background: "var(--bg-page)" }}>
        <div className="max-w-[900px] w-full mx-auto space-y-6">
          
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl border transition-colors"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color-subtle)", color: "var(--text-muted)" }}
                title="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
                User Profile
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => navigate("/")}
                className="px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-muted)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Chat</span>
              </button>
            </div>
          </div>

          {/* ── SECTION 1 — PERSONAL INFORMATION ── */}
          <div
            className="rounded-2xl p-6 backdrop-blur-md relative"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            {/* Top-Right Save Changes Button */}
            <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-heading)" }}>
                <User className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
                <span>Personal Information</span>
              </h2>

              <button
                onClick={handleSaveProfile}
                className="h-10 px-5 rounded-xl text-white font-semibold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                style={{ background: "var(--brand-primary)" }}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>

            {/* Profile Content Layout */}
            <div className="flex flex-col sm:flex-row items-start gap-8">
              
              {/* Left Side: Avatar */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative group">
                  <div
                    className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl"
                    style={{ background: "var(--brand-primary)" }}
                  >
                    {userInitials}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => alert("Photo upload dialog opened.")}
                  className="text-xs hover:underline font-medium mt-2"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Edit photo
                </button>
              </div>

              {/* Right Side: Form Fields */}
              <div className="flex-1 w-full space-y-4">
                
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Full name
                    </label>
                    <span className="text-[11px] font-bold" style={{ color: "var(--brand-primary)" }}>required</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={email}
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none cursor-not-allowed opacity-75 font-mono"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <p className="text-xs italic mt-1" style={{ color: "var(--text-muted)" }}>
                    Read-only — contact admin to change
                  </p>
                </div>

                {/* Medical Specialty */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Medical specialty
                    </label>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>optional</span>
                  </div>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Cardiology, Oncology"
                    className="w-full h-11 px-4 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

              </div>

            </div>

            {profileSuccessMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

          </div>


          {/* ── SECTION 2 — PASSWORD SECTION ── */}
          <div
            className="rounded-2xl p-6 backdrop-blur-md"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: "1px solid var(--border-color-subtle)" }}>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--text-heading)" }}>
                <Key className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
                <span>Change Password</span>
              </h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {/* Current Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Current password
                  </label>
                  <span className="text-[11px] font-bold" style={{ color: "var(--brand-primary)" }}>required</span>
                </div>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    New password
                  </label>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength Indicator */}
                {newPassword && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-muted)" }}>Password strength:</span>
                      <span className={`font-semibold ${pwStrength.text}`}>{pwStrength.label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 rounded-full transition-all ${
                        pwStrength.score >= 1 ? pwStrength.color : "bg-transparent"
                      }`} />
                      <div className={`h-full flex-1 rounded-full transition-all ${
                        pwStrength.score >= 2 ? pwStrength.color : "bg-transparent"
                      }`} />
                      <div className={`h-full flex-1 rounded-full transition-all ${
                        pwStrength.score >= 3 ? pwStrength.color : "bg-transparent"
                      }`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Confirm new password
                  </label>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm rounded-xl outline-none transition-all"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Messages */}
              {passwordSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isPasswordFormValid}
                  className="px-5 py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: "var(--bg-card-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  Change Password
                </button>
              </div>

            </form>
          </div>


          {/* ── SECTION 3 — DANGER ZONE ── */}
          <div className="rounded-2xl bg-red-500/5 border-l-[3px] border-red-500 border-t border-r border-b border-red-500/20 p-6 backdrop-blur-md mb-8">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
                Danger Zone
              </h2>
            </div>

            <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
              Permanently delete your account and all associated chat history. This action cannot be undone.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteConfirmText("");
              }}
              className="w-full h-11 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete my account</span>
            </button>
          </div>

        </div>

        {/* ── CONFIRMATION MODAL ── */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl p-6 relative shadow-2xl animate-fade-in"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute right-4 top-4 p-1 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-center mb-2" style={{ color: "var(--text-heading)" }}>
                Delete Account Permanently?
              </h3>
              <p className="text-xs text-center mb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                This action is destructive and irreversible. To confirm, please type <span className="font-mono font-bold text-red-400">DELETE</span> below:
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full h-11 px-4 text-sm text-center bg-black/40 border border-red-500/40 rounded-xl outline-none focus:border-red-500 mb-6 font-mono"
                style={{ color: "var(--text-primary)" }}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors"
                  style={{ background: "var(--bg-card-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText.trim() !== "DELETE"}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
