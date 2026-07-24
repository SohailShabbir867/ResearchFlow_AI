import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  Plus, 
  Trash2, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Mail, 
  Stethoscope, 
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

  // Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState("Dr. Sohail Shabbir");
  const [email] = useState("sohail.shabbir@medresearch.ai"); // Read-only
  const [specialty, setSpecialty] = useState("Cardiology & Medical AI");
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

  // Calculate Password Strength (0: none, 1: weak, 2: medium, 3: strong)
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

  // Save Profile Changes
  const handleSaveProfile = (e) => {
    if (e) e.preventDefault();
    setProfileSuccessMsg("Profile information updated successfully!");
    setTimeout(() => setProfileSuccessMsg(""), 3000);
  };

  // Change Password Action
  const handleChangePassword = (e) => {
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

    setPasswordSuccessMsg("Password changed successfully!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPasswordSuccessMsg(""), 3000);
  };

  // Permanent Delete Account Action
  const handleConfirmDelete = () => {
    if (deleteConfirmText.trim() === "DELETE") {
      alert("Your account has been deleted. Redirecting to login...");
      navigate("/login");
    }
  };

  const isPasswordFormValid = currentPassword.trim() !== "" && newPassword.trim() !== "" && confirmPassword.trim() !== "";

  return (
    <div className="flex h-screen w-full bg-[#0F0A1E] font-sans antialiased text-gray-100 overflow-hidden selection:bg-[#E21B70]/30 selection:text-white">
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* ── LEFT SIDEBAR (Research Chat Sidebar style) ── */}
      <aside 
        className={`bg-[#0A0614] border-r border-white/10 flex flex-col justify-between transition-all duration-300 z-50 shrink-0 fixed lg:static inset-y-0 left-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarCollapsed ? "w-16" : "w-[280px]"}`}
      >
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(226,27,112,0.3)]">
              <Microscope className="w-5 h-5 stroke-[2.2]" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-white text-base tracking-tight truncate">
                ResearchAI
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => navigate("/")}
            className={`w-full h-11 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#E21B70]/20 hover:opacity-95 active:scale-[0.98] transition-all duration-200 ${
              sidebarCollapsed ? "px-0" : "px-4"
            }`}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            {!sidebarCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Microscope className="w-4 h-4 text-gray-400" />
            {!sidebarCollapsed && <span>Research Chat</span>}
          </button>

          <button
            onClick={() => navigate("/documents")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <FolderOpen className="w-4 h-4 text-gray-400" />
            {!sidebarCollapsed && <span>Document Library</span>}
          </button>

          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            {!sidebarCollapsed && <span>Admin Dashboard</span>}
          </button>
        </div>

        {/* User Footer (HIGHLIGHTED FOR PROFILE) */}
        <div className="p-3 border-t border-white/10 bg-[#0A0614]">
          <div 
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-3 p-2 rounded-xl bg-[#E21B70]/15 border border-[#E21B70]/30 cursor-pointer transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
              SS
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">Dr. Sohail Shabbir</p>
                <p className="text-[10px] text-gray-400 truncate">Clinical Researcher</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <span className="text-xs text-[#E21B70] font-bold">Profile</span>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-y-auto p-6 lg:p-8">
        <div className="max-w-[900px] w-full mx-auto space-y-6">
          
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
                title="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                User Profile
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => navigate("/")}
                className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Chat</span>
              </button>
            </div>
          </div>


          {/* ── SECTION 1 — PROFILE SECTION (Glass Card) ── */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md relative">
            
            {/* Top-Right Save Changes Button */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-[#E21B70]" />
                <span>Personal Information</span>
              </h2>

              <button
                onClick={handleSaveProfile}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-xs shadow-md shadow-[#E21B70]/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>

            {/* Profile Content Layout (Avatar on Left, Form on Right) */}
            <div className="flex flex-col sm:flex-row items-start gap-8">
              
              {/* Left Side: Large 72px Avatar + Edit Photo Label */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative group">
                  <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#E21B70] to-[#A53860] flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-pink-950/30">
                    SS
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => alert("Photo upload dialog opened.")}
                  className="text-xs text-[#E21B70] hover:underline font-medium mt-2"
                >
                  Edit photo
                </button>
              </div>

              {/* Right Side: Form Fields */}
              <div className="flex-1 w-full space-y-4">
                
                {/* Full Name (Editable, required) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Full name
                    </label>
                    <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
                  />
                </div>

                {/* Email Address (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={email}
                    className="w-full h-11 px-4 text-sm text-gray-400 bg-white/5 border border-white/10 rounded-xl outline-none cursor-not-allowed opacity-75 font-mono"
                  />
                  <p className="text-xs text-gray-500 italic mt-1">
                    Read-only — contact admin to change
                  </p>
                </div>

                {/* Medical Specialty (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300">
                      Medical specialty
                    </label>
                    <span className="text-[11px] text-gray-500">optional</span>
                  </div>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Cardiology, Oncology"
                    className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] focus:ring-1 focus:ring-[#E21B70]/20 transition-all"
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


          {/* ── SECTION 2 — PASSWORD SECTION (Glass Card) ── */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Key className="w-5 h-5 text-[#E21B70]" />
                <span>Change Password</span>
              </h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {/* 1. Current Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">
                    Current password
                  </label>
                  <span className="text-[11px] font-bold text-[#E21B70]">required</span>
                </div>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 transition-colors"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. New Password with Strength Indicator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">
                    New password
                  </label>
                  <span className="text-[11px] text-gray-500">optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 transition-colors"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength Bar Indicator */}
                {newPassword && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">Password strength:</span>
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

              {/* 3. Confirm New Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">
                    Confirm new password
                  </label>
                  <span className="text-[11px] text-gray-500">optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-11 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 transition-colors"
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

              {/* Action Button: Disabled until all 3 fields filled */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isPasswordFormValid}
                  className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Change Password
                </button>
              </div>

            </form>
          </div>


          {/* ── SECTION 3 — DANGER ZONE SECTION (Red Tinted Glass Card) ── */}
          <div className="rounded-2xl bg-red-500/5 border-l-[3px] border-red-500 border-t border-r border-b border-red-500/20 p-6 backdrop-blur-md mb-8">
            
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Danger Zone
              </h2>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              Permanently delete your account and all associated chat history. This action cannot be undone.
            </p>

            {/* Dark Red Delete Account Button (NOT Pink) */}
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

        {/* ── CONFIRMATION MODAL FOR ACCOUNT DELETION ── */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#180C14] border border-red-500/30 p-6 relative shadow-2xl animate-fade-in">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white text-center mb-2">
                Delete Account Permanently?
              </h3>
              <p className="text-xs text-gray-300 text-center mb-6 leading-relaxed">
                This action is destructive and irreversible. To confirm, please type <span className="font-mono font-bold text-red-400">DELETE</span> below:
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full h-11 px-4 text-sm text-center text-white bg-black/40 border border-red-500/40 rounded-xl outline-none focus:border-red-500 mb-6 font-mono"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-xs hover:bg-white/10 transition-colors"
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
