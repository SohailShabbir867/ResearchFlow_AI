import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope,
  ShieldCheck,
  Zap,
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { loginUser, clearAuthError } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Login() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useDispatch();

  const { loading, error: authError } = useSelector(s => s.auth);

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const from = location.state?.from?.pathname || "/";

  const validateEmail = (val) => {
    if (!val) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLocalError("");
    setEmailError("");
    setSuccessMsg("");
    dispatch(clearAuthError());

    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    if (!password) { setLocalError("Please enter your password."); return; }

    const result = await dispatch(loginUser({ email, password }));

    if (loginUser.fulfilled.match(result)) {
      setSuccessMsg("Signed in successfully! Redirecting…");
      setTimeout(() => navigate(from, { replace: true }), 800);
    }
    // authError is set in Redux state if rejected
  };

  const displayError = localError || authError;

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row font-sans antialiased"
      style={{ background: "var(--bg-page)" }}
    >
      {/* ── LEFT PANEL ── */}
      <div
        className="w-full lg:w-1/2 min-h-[420px] lg:min-h-screen relative p-8 lg:p-14 flex flex-col justify-between overflow-hidden"
        style={{
          background: "radial-gradient(circle at 25% 25%, rgba(226,27,112,0.22) 0%, #0A0614 75%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Glow blobs */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#E21B70]/20 blur-[100px] pointer-events-none" aria-hidden />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-[#E21B70]/15 blur-[120px] pointer-events-none" aria-hidden />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-[#3A0519]/40 blur-[80px] pointer-events-none" aria-hidden />

        {/* Logo + theme toggle */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center shadow-[0_0_20px_rgba(226,27,112,0.4)]">
              <Microscope className="w-6 h-6 text-white stroke-[2.2]" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">MedResearch AI</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Hero */}
        <div className="relative z-10 my-10 lg:my-0 max-w-xl">
          <h1 className="text-[36px] sm:text-[40px] font-bold text-white leading-[1.15] tracking-tight mb-4">
            AI-Powered<br />
            <span className="bg-gradient-to-r from-white via-pink-100 to-[#E21B70] bg-clip-text text-transparent">
              Medical Research
            </span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
            Ask clinical questions. Get answers from your documents.
          </p>

          <div className="space-y-3.5">
            {[
              { icon: ShieldCheck, title: "Document Security & Compliance",   desc: "HIPAA-compliant document locking protecting all sensitive clinical files." },
              { icon: Zap,         title: "Lightning Fast Retrieval",          desc: "Sub-second vector query responses across large medical paper libraries."  },
              { icon: FileText,    title: "Verifiable Citations",              desc: "Every insight is directly cited and linked to exact source excerpts."      },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#E21B70]/15 border border-[#E21B70]/30 flex items-center justify-center text-[#E21B70] shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">{title}</h2>
                  <p className="text-gray-400 text-xs mt-0.5 leading-normal">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4">
          <p className="text-xs text-gray-500 font-medium tracking-wide">
            Powered by <span className="text-gray-400 font-semibold">Qdrant</span> ·{" "}
            <span className="text-gray-400 font-semibold">FastEmbed</span> ·{" "}
            <span className="text-gray-400 font-semibold">Groq LLaMA 3.3 70B</span>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="w-full lg:w-1/2 min-h-screen flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16"
        style={{ background: "#FFFFFF" }}
      >
        <div className="w-full max-w-[420px] mx-auto">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1.5">Sign in to your account to continue</p>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{displayError}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="email-input" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                  if (localError) setLocalError("");
                  dispatch(clearAuthError());
                }}
                placeholder="doctor@hospital.com"
                className={`w-full h-11 px-4 text-gray-900 bg-white text-sm rounded-[10px] border transition-all duration-200 outline-none ${
                  emailError
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-gray-300 focus:border-[#E21B70] focus:ring-2 focus:ring-[#E21B70]/20"
                }`}
              />
              {emailError && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                  <span>⚠</span> {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password-input" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => { e.preventDefault(); alert("Contact your administrator to reset your password."); }}
                  className="text-xs font-semibold text-[#E21B70] hover:text-[#A53860] hover:underline transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError("");
                    dispatch(clearAuthError());
                  }}
                  placeholder="••••••••"
                  className="w-full h-11 pl-4 pr-11 text-gray-900 bg-white text-sm rounded-[10px] border border-gray-300 focus:border-[#E21B70] focus:ring-2 focus:ring-[#E21B70]/20 transition-all duration-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-base shadow-md shadow-[#E21B70]/25 hover:opacity-95 hover:shadow-lg hover:shadow-[#E21B70]/35 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Don't have an account?{" "}
              <span className="font-semibold text-gray-600">Contact your administrator</span>
            </p>
            <p className="text-[11px] text-gray-300 mt-2">
              Self-registration is disabled. Accounts are created by administrators only.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
