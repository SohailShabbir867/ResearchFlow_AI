import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Microscope, Mail, AlertCircle, ArrowLeft, Send, Loader2 } from "lucide-react";
import { forgotPassword, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError, emailSent } = useSelector(s => s.auth);

  const [email, setEmail] = useState("");
  const [localErr, setLocalErr] = useState("");

  useEffect(() => { dispatch(clearFlags()); }, [dispatch]);

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

  /* ── Success state ── */
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
           style={{ background: "var(--bg-page)" }}>
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
               style={{ background: "rgba(142,78,20,0.12)", border: "2px solid rgba(142,78,20,0.25)" }}>
            <Send className="w-9 h-9" style={{ color: "var(--brand-primary)" }} />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-heading)" }}>
            Reset Email Sent!
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            We sent a password reset link to:
          </p>
          <p className="font-semibold mb-6" style={{ color: "var(--brand-primary)" }}>{email}</p>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            Click the link in the email to reset your password. It expires in <strong>1 hour</strong>.
            Check your spam folder if you don't see it.
          </p>

          <div className="p-5 mb-6 text-left space-y-2 rounded-xl"
               style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              What's next?
            </p>
            {[
              "Open the email from ResearchFlow AI",
              "Click the \"Reset My Password\" button",
              "Choose a new strong password",
              "Sign in with your new password",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                     style={{ background: "var(--brand-primary)" }}>
                  {i + 1}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{step}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { dispatch(clearFlags()); navigate("/login"); }}
            className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>

          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            Didn't receive the email?{" "}
            <button
              onClick={() => dispatch(clearFlags())}
              className="font-semibold hover:underline transition-colors"
              style={{ color: "var(--brand-primary)" }}
            >
              Try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  /* ── Form state ── */
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "var(--brand-primary)" }}>
              <Microscope className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>ResearchFlow AI</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Card */}
        <div className="p-8 rounded-2xl" style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color-subtle)",
          boxShadow: "var(--shadow-card)"
        }}>
          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center"
               style={{ background: "rgba(142,78,20,0.10)", border: "1px solid rgba(142,78,20,0.20)" }}>
            <Mail className="w-7 h-7" style={{ color: "var(--brand-primary)" }} />
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
                 style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{displayError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-semibold mb-1.5"
                     style={{ color: "var(--text-secondary)" }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--text-muted)" }} />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLocalErr(""); dispatch(clearAuthError()); }}
                  placeholder="doctor@hospital.com"
                  autoFocus
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                  className="w-full h-11 pl-10 pr-4 text-sm rounded-xl outline-none transition-all duration-200"
                  onFocus={e => { e.currentTarget.style.borderColor = "var(--brand-primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-glow-subtle)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "var(--border-input)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            <button
              id="forgot-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--brand-hover)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-primary)")}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link…</>
                : <><Send className="w-4 h-4" /> Send Reset Link</>}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm flex items-center justify-center gap-1.5 transition-colors"
                style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
