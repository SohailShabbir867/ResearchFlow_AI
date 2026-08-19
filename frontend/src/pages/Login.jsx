import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  Sparkles, AtSign, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Loader2,
} from "lucide-react";
import { loginUser, clearAuthError } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const shellStyle = { background: "var(--bg-page)", color: "var(--text-primary)" };
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border-color-subtle)", boxShadow: "var(--shadow-card)" };
const fieldStyle = { background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" };
const softLabelStyle = { color: "var(--text-muted)" };
const strongTextStyle = { color: "var(--text-heading)" };
const brandButtonStyle = { background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { loading, error: authError } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState("");

  const from = location.state?.from?.pathname || "/";

  const validateEmail = (val) => {
    if (!val) return "Email address is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLocalError("");
    setEmailError("");
    setSuccessMsg("");
    dispatch(clearAuthError());
    setUnverified(false);

    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }

    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      setSuccessMsg("Signed in successfully! Redirecting…");
      setTimeout(() => navigate(from, { replace: true }), 800);
    } else if (result.payload?.toLowerCase?.().includes("verify") || result.payload?.toLowerCase?.().includes("pending")) {
      setUnverified(true);
      setResendDone(false);
      setResendError("");
    }
  };

  const handleResend = async () => {
    if (!email || resendLoading || resendDone) return;
    setResendLoading(true);
    setResendError("");
    try {
      await axios.post("/api/auth/resend-verification", { email });
      setResendDone(true);
    } catch (err) {
      setResendError(err.response?.data?.error || "Failed to resend. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans antialiased" style={shellStyle}>
      <div className="w-full max-w-[1040px] overflow-hidden rounded-[28px] border flex flex-col lg:grid lg:grid-cols-[0.95fr_1.05fr]" style={cardStyle}>
        <div className="relative overflow-hidden p-8 sm:p-10 flex flex-col justify-between min-h-[280px] lg:min-h-full" style={{ background: "linear-gradient(160deg, rgba(142,78,20,0.96) 0%, rgba(61,31,8,0.98) 100%)" }}>
          <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at top right, rgba(255,255,255,0.15), transparent 45%), radial-gradient(circle at bottom left, rgba(255,255,255,0.08), transparent 40%)" }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.12)] border border-white/10 text-white shadow-md">
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-lg tracking-tight text-white font-serif">ResearchFlow AI</span>
          </div>
          <div className="relative z-10 my-10 sm:my-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60 mb-3">Ethical Hacking workspace</p>
            <h1 className="text-3xl sm:text-4xl font-bold font-serif leading-[1.15] text-white mb-4">
              AI-Powered<br />Research Assistant.
            </h1>
            <p className="text-sm text-white/75 leading-relaxed font-medium max-w-sm">
              Chat with up-to-date ethical hacking intelligence or upload custom RAG datasets for private security research.
            </p>
          </div>
          <div className="relative z-10 flex justify-center mt-2">
            <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full p-2.5 bg-white/10 backdrop-blur-md shadow-xl flex items-center justify-center border border-white/10">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#1F1F1F] border-4 border-white/10 flex items-center justify-center shadow-inner">
                <img src="/doctor_avatar.png" alt="Doctor Illustration" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[520px]">
          <div>
            <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: "var(--border-color-subtle)" }}>
              <div className="flex items-center gap-8 text-sm font-semibold">
                <Link to="/signup" className="transition-colors" style={softLabelStyle}>Sign Up</Link>
                <div className="relative" style={strongTextStyle}>
                  <span>Log In</span>
                  <div className="absolute -bottom-[13px] left-0 right-0 h-[3px] rounded-full" style={{ background: "var(--brand-primary)" }} />
                </div>
              </div>
              <ThemeToggle />
            </div>

            <div className="mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold font-serif tracking-tight" style={strongTextStyle}>Welcome Back</h2>
              <p className="text-xs sm:text-sm mt-1.5 font-medium" style={softLabelStyle}>Access your personalized clinical research dashboard.</p>
            </div>

            {displayError && !unverified && (
              <div className="mb-5 p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2.5" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#F87171" }} />
                <span>{displayError}</span>
              </div>
            )}

            {unverified && (
              <div className="mb-5 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,0.30)" }}>
                {/* Warning header */}
                <div className="p-3.5 flex items-start gap-2.5" style={{ background: "rgba(245,158,11,0.10)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#FCD34D" }}>Email not verified</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(252,211,77,0.75)" }}>
                      Check your inbox for the activation link, or resend it below.
                    </p>
                  </div>
                </div>
                {/* Resend action */}
                <div className="px-3.5 py-3" style={{ background: "rgba(245,158,11,0.05)", borderTop: "1px solid rgba(245,158,11,0.15)" }}>
                  {resendDone ? (
                    <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#6EE7B7" }}>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verification email sent! Check your inbox.</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendLoading || !email}
                        className="flex items-center gap-2 text-xs font-bold rounded-xl px-3 py-2 transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" }}
                      >
                        {resendLoading
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Sending…</span></>
                          : <><Mail className="w-3.5 h-3.5" /><span>Resend Verification Email</span></>}
                      </button>
                      {!email && <p className="text-[10px] mt-1.5" style={{ color: "rgba(252,211,77,0.55)" }}>Enter your email above first</p>}
                      {resendError && <p className="text-[10px] mt-1.5 font-medium" style={{ color: "#FCA5A5" }}>{resendError}</p>}
                    </>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5" style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#A7F3D0" }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#34D399" }} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5" style={strongTextStyle}>EMAIL OR PHONE NUMBER</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={softLabelStyle}>
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
                    placeholder="Enter your email"
                    className="w-full h-12 pl-11 pr-4 text-sm font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                    style={fieldStyle}
                  />
                </div>
                {emailError && <p className="text-xs mt-1 font-medium" style={{ color: "#FCA5A5" }}>⚠ {emailError}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-widest" style={strongTextStyle}>PASSWORD</label>
                  <Link to="/forgot-password" className="text-xs font-bold hover:underline" style={{ color: "var(--brand-primary)" }}>Forgot Password?</Link>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={softLabelStyle}>
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
                    className="w-full h-12 pl-11 pr-11 text-sm font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                    style={fieldStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1" style={softLabelStyle}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 mt-2"
                style={brandButtonStyle}
              >
                {loading ? <span>Signing in…</span> : <span>Log In</span>}
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 text-center border-t" style={{ borderColor: "var(--border-color-subtle)" }}>
            <p className="text-xs font-semibold" style={softLabelStyle}>
              New here? <Link to="/signup" className="font-bold hover:underline" style={{ color: "var(--brand-primary)" }}>Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
