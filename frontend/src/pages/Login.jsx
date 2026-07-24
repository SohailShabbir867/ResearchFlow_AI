import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, ShieldCheck, Zap, FileText,
  Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2,
} from "lucide-react";
import { loginUser, clearAuthError } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const { loading, error: authError } = useSelector(s => s.auth);

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError,   setLocalError]   = useState("");
  const [emailError,   setEmailError]   = useState("");
  const [successMsg,   setSuccessMsg]   = useState("");
  const [unverified,   setUnverified]   = useState(false);

  const from = location.state?.from?.pathname || "/";

  const validateEmail = (val) => {
    if (!val) return "Email address is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLocalError(""); setEmailError(""); setSuccessMsg("");
    dispatch(clearAuthError());
    setUnverified(false);

    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    if (!password) { setLocalError("Please enter your password."); return; }

    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      setSuccessMsg("Signed in successfully! Redirecting…");
      setTimeout(() => navigate(from, { replace: true }), 800);
    } else if (
      result.payload?.toLowerCase?.().includes("verify") ||
      result.payload?.toLowerCase?.().includes("pending")
    ) {
      setUnverified(true);
    }
  };

  const displayError = localError || authError;

  /* ── Shared input style ─────────────────────────────────────────── */
  const inputCls = (hasErr) =>
    `w-full h-11 px-4 text-sm rounded-xl border outline-none transition-all duration-200 ${
      hasErr
        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
        : "border-[#C8C2B8] focus:border-[#8E4E14] focus:ring-2 focus:ring-[rgba(142,78,20,0.12)]"
    }`;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans antialiased"
         style={{ background: "var(--bg-page)" }}>

      {/* ── LEFT PANEL — warm brown brand panel ── */}
      <div
        className="w-full lg:w-[45%] min-h-[360px] lg:min-h-screen relative p-8 lg:p-14 flex flex-col justify-between overflow-hidden"
        style={{ background: "var(--brand-primary)", borderRight: "4px solid var(--brand-dark)" }}
      >
        {/* Subtle texture overlays */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #FFFFFF 0%, transparent 60%)" }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
             style={{ background: "rgba(255,255,255,0.15)", filter: "blur(80px)" }} />

        {/* Logo + theme toggle */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)" }}>
              <Microscope className="w-6 h-6 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-black text-white text-lg tracking-tight">MedResearch AI</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Hero text */}
        <div className="relative z-10 my-10 lg:my-0">
          <h1 className="text-[32px] sm:text-[40px] font-bold text-white leading-tight tracking-tight mb-4">
            AI-Powered<br />
            <span className="opacity-90">Medical Research</span>
          </h1>
          <p className="text-white/80 text-base mb-8 leading-relaxed">
            Ask clinical questions. Get answers from your documents.
          </p>

          <div className="space-y-3">
            {[
              { icon: ShieldCheck, title: "Document Security & Compliance",  desc: "HIPAA-compliant document locking protecting all sensitive clinical files." },
              { icon: Zap,         title: "Lightning Fast Retrieval",         desc: "Sub-second vector query responses across large medical paper libraries."  },
              { icon: FileText,    title: "Verifiable Citations",             desc: "Every insight is directly cited and linked to exact source excerpts."      },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}
                   className="flex items-start gap-3 p-3.5 rounded-xl transition-all group"
                   style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-white/65 text-xs mt-0.5 leading-normal">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-white/55 font-medium tracking-wide">
            Powered by <span className="text-white/80 font-semibold">Qdrant</span> ·{" "}
            <span className="text-white/80 font-semibold">FastEmbed</span> ·{" "}
            <span className="text-white/80 font-semibold">Groq LLaMA 3.3 70B</span>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div
        className="w-full lg:w-[55%] min-h-screen flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16"
        style={{ background: "var(--bg-input-bar)" }}
      >
        <div className="w-full max-w-[420px] mx-auto">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-heading)" }}>
              Welcome back
            </h2>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
              Sign in to your MedResearch account
            </p>
          </div>

          {/* Error Banner */}
          {displayError && !unverified && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="font-medium">{displayError}</p>
            </div>
          )}

          {/* Unverified banner */}
          {unverified && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Email not verified</p>
                <p className="text-amber-700 text-xs mb-2">Check your inbox for the verification link.</p>
                <Link to="/signup" className="text-xs font-semibold text-amber-700 underline">
                  Resend verification email →
                </Link>
              </div>
            </div>
          )}

          {/* Success banner */}
          {successMsg && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="font-medium">{successMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold mb-1.5"
                     style={{ color: "var(--text-secondary)" }}>
                Email address
              </label>
              <input
                id="login-email"
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
                style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                className={inputCls(!!emailError)}
              />
              {emailError && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                  ⚠ {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold"
                       style={{ color: "var(--text-secondary)" }}>
                  Password
                </label>
                <Link to="/forgot-password"
                      className="text-xs font-semibold transition-colors"
                      style={{ color: "var(--brand-primary)" }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
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
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                  className={`${inputCls(false)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full h-12 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--brand-hover)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-primary)")}
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
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border-color-subtle)" }}>
            <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold transition-colors"
                    style={{ color: "var(--brand-primary)" }}>
                Create one
              </Link>
            </p>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--text-disabled)" }}>
              New accounts require email verification before login.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
