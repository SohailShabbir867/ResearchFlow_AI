import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, Mail, AlertCircle, CheckCircle2,
  ArrowLeft, Send, Loader2,
} from "lucide-react";
import { forgotPassword, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError, emailSent } = useSelector(s => s.auth);

  const [email, setEmail] = useState("");
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    // Reset state on mount
    dispatch(clearFlags());
  }, [dispatch]);

  function validate() {
    if (!email) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    dispatch(clearAuthError());
    const err = validate();
    if (err) { setLocalErr(err); return; }
    setLocalErr("");
    dispatch(forgotPassword({ email: email.toLowerCase().trim() }));
  }

  const displayError = localErr || authError;

  // ─── Success state ─────────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
        <div className="w-full max-w-md animate-fade-in text-center">
          {/* Envelope animation */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: "rgba(226,27,112,0.15)", border: "2px solid rgba(226,27,112,0.30)" }}>
            <Send className="w-9 h-9 text-[#E21B70]" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-heading)" }}>Reset Email Sent!</h1>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            We sent a password reset link to:
          </p>
          <p className="font-semibold mb-6 text-[#E21B70]">{email}</p>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            Click the link in the email to reset your password. It expires in <strong>1 hour</strong>.
            If you don't see it, check your spam folder.
          </p>

          <div className="glass-card p-5 mb-6 text-left space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>What's next?</p>
            {[
              "Open the email from MedResearch AI",
              "Click the \"Reset My Password\" button",
              "Choose a new strong password",
              "Sign in with your new password",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #E21B70, #A53860)" }}>
                  {i + 1}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { dispatch(clearFlags()); navigate("/login"); }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>

          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            Didn't receive the email?{" "}
            <button
              onClick={() => dispatch(clearFlags())}
              className="font-semibold hover:underline"
              style={{ color: "#E21B70" }}
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ─── Form state ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center shadow-[0_0_14px_rgba(226,27,112,0.3)]">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>MedResearch AI</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(226,27,112,0.12)", border: "1px solid rgba(226,27,112,0.25)" }}>
            <Mail className="w-7 h-7 text-[#E21B70]" />
          </div>

          <h1 className="text-2xl font-bold text-center mb-1.5" style={{ color: "var(--text-heading)" }}>
            Forgot Password?
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
            No worries! Enter your email and we'll send you a reset link.
          </p>

          {/* Error */}
          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl flex items-start gap-2.5 animate-fade-in"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.30)" }}>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{displayError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="input-label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setLocalErr("");
                    dispatch(clearAuthError());
                  }}
                  placeholder="doctor@hospital.com"
                  className="input-base pl-10"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-base"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link…</>
                : <><Send className="w-4 h-4" /> Send Reset Link</>
              }
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm flex items-center justify-center gap-1.5"
            style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
