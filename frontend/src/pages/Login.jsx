import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, AtSign, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2,
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans antialiased"
         style={{ background: "#F4F1EA" }}>

      {/* ── CENTERED TWO-PANEL CARD (Matching Reference Image) ── */}
      <div className="w-full max-w-[960px] bg-white rounded-3xl sm:rounded-[28px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-[#E6E0D4]">

        {/* ── LEFT HERO PANEL (Terracotta / Brown) ── */}
        <div className="w-full md:w-[46%] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden shrink-0"
             style={{ background: "linear-gradient(145deg, #F09154 0%, #D87739 60%, #B85F26 100%)" }}>

          {/* Top Logo */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#012D1D] text-white shadow-md">
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#012D1D] font-serif">
              ResearchAI
            </span>
          </div>

          {/* Hero Content */}
          <div className="my-8 sm:my-12 relative z-10">
            <h1 className="text-3xl sm:text-4xl font-bold font-serif leading-[1.2] text-[#012D1D] mb-3">
              AI-Powered<br />Research Assistant.
            </h1>
            <p className="text-sm text-[#3E2010]/80 leading-relaxed font-medium">
              Chat with up-to-date real-time intelligence or upload custom RAG datasets for private document analysis.
            </p>
          </div>

          {/* Bottom Illustration Circle */}
          <div className="relative z-10 flex justify-center mt-2">
            <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full p-2.5 bg-white/30 backdrop-blur-sm shadow-xl flex items-center justify-center">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#FFF8EE] border-4 border-white flex items-center justify-center shadow-inner">
                <img
                  src="/doctor_avatar.png"
                  alt="Doctor Illustration"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="w-full md:w-[54%] p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>

            {/* Top Navigation Tabs (Sign Up | Log In) */}
            <div className="flex items-center justify-between mb-8 pb-3 border-b border-[#F0EBE1]">
              <div className="flex items-center gap-8 text-sm font-bold">
                <Link to="/signup" className="text-[#8C8275] hover:text-[#012D1D] transition-colors">
                  Sign Up
                </Link>
                <div className="relative text-[#012D1D]">
                  <span>Log In</span>
                  <div className="absolute -bottom-[13px] left-0 right-0 h-[3px] bg-[#D87739] rounded-full" />
                </div>
              </div>
              <ThemeToggle />
            </div>

            {/* Title & Subtitle */}
            <div className="mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold font-serif text-[#012D1D] tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-[#70675C] mt-1.5 font-medium">
                Access your personalized clinical research dashboard.
              </p>
            </div>

            {/* Banners */}
            {displayError && !unverified && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {unverified && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Email not verified</p>
                  <p className="mt-0.5">Please check your inbox for the activation link.</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Email field */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1.5">
                  EMAIL OR PHONE NUMBER
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8275]">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                      if (localError) setLocalError("");
                      dispatch(clearAuthError());
                    }}
                    placeholder="Enter Your Email"
                    className="w-full h-12 pl-11 pr-4 text-sm font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white focus:ring-2 focus:ring-[#D87739]/15 outline-none transition-all placeholder-[#A09688]"
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-500 mt-1 font-medium">⚠ {emailError}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest text-[#012D1D]">
                    PASSWORD
                  </label>
                  <Link to="/forgot-password" className="text-xs font-bold text-[#D87739] hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8275]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (localError) setLocalError("");
                      dispatch(clearAuthError());
                    }}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 text-sm font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white focus:ring-2 focus:ring-[#D87739]/15 outline-none transition-all placeholder-[#A09688]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C8275] hover:text-[#012D1D] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Button (Dark Forest Green / Brown Pill) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-[#012D1D] hover:bg-[#024029] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#012D1D]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 mt-2"
              >
                {loading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <span>Log In →</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-4 text-center border-t border-[#F0EBE1]">
            <p className="text-xs text-[#70675C] font-semibold">
              New here?{" "}
              <Link to="/signup" className="font-bold text-[#D87739] hover:underline">
                Create an account
              </Link>
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
