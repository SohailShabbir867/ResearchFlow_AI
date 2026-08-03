import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, Lock, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2, ArrowRight, ShieldCheck,
} from "lucide-react";
import { resetPassword, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",       color: "#EF4444", width: "20%" };
  if (score <= 2) return { label: "Fair",        color: "#F59E0B", width: "45%" };
  if (score <= 3) return { label: "Good",        color: "#3B82F6", width: "65%" };
  if (score <= 4) return { label: "Strong",      color: "#10B981", width: "85%" };
  return              { label: "Very Strong",    color: "#10B981", width: "100%" };
}

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { loading, error: authError, resetDone } = useSelector(s => s.auth);

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localErr,    setLocalErr]    = useState("");
  const [countdown,   setCountdown]   = useState(null);

  const strength = password ? getStrength(password) : null;

  useEffect(() => {
    dispatch(clearFlags());
  }, [dispatch]);

  // Auto-redirect countdown after success
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate("/login"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  function validate() {
    if (!password || password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm)             return "Passwords do not match.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    dispatch(clearAuthError());
    const err = validate();
    if (err) { setLocalErr(err); return; }
    setLocalErr("");

    const result = await dispatch(resetPassword({ token, password }));
    if (resetPassword.fulfilled.match(result)) {
      setCountdown(5);
    }
  }

  const displayError = localErr || authError;

  // ─── Success ───
  if (resetDone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.30)" }}>
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
            Password Reset!
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            Your password has been changed successfully.
          </p>
          {countdown !== null && (
            <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
              Redirecting to login in <span className="font-bold" style={{ color: "var(--brand-primary)" }}>{countdown}s</span>…
            </p>
          )}
          <button
            onClick={() => navigate("/login")}
            className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
          >
            <ArrowRight className="w-4 h-4" /> Sign In Now
          </button>
        </div>
      </div>
    );
  }

  // ─── Form ───
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-primary)" }}>
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
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(142,78,20,0.10)", border: "1px solid rgba(142,78,20,0.20)" }}>
            <ShieldCheck className="w-7 h-7" style={{ color: "var(--brand-primary)" }} />
          </div>

          <h1 className="text-2xl font-bold text-center mb-1.5" style={{ color: "var(--text-heading)" }}>
            Set New Password
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
            Choose a strong password for your account.
          </p>

          {/* Error */}
          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl flex items-start gap-2.5 animate-fade-in"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{displayError}</p>
                {displayError.toLowerCase().includes("expired") && (
                  <Link to="/forgot-password" className="text-xs mt-1 block font-semibold hover:underline" style={{ color: "var(--brand-primary)" }}>
                    Request a new reset link →
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* New password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  id="new-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLocalErr(""); dispatch(clearAuthError()); }}
                  placeholder="At least 8 characters"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                  className="w-full h-11 pl-10 pr-10 text-sm rounded-xl outline-none transition-all duration-200"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {strength && (
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span style={{ color: "var(--text-muted)" }}>Strength</span>
                    <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: strength.width, background: strength.color }} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setLocalErr(""); }}
                  placeholder="Repeat new password"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
                  className="w-full h-11 pl-10 pr-10 text-sm rounded-xl outline-none transition-all duration-200"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Match indicator */}
              {confirm && (
                <p className="text-xs mt-1 flex items-center gap-1"
                  style={{ color: confirm === password ? "#10B981" : "#EF4444" }}>
                  {confirm === password
                    ? <><CheckCircle2 className="w-3 h-3" /> Passwords match</>
                    : <><AlertCircle className="w-3 h-3" /> Passwords don't match</>}
                </p>
              )}
            </div>

            {/* Password rules */}
            <div className="p-3.5 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color-subtle)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Password Requirements
              </p>
              {[
                ["At least 8 characters",   password.length >= 8],
                ["At least one uppercase",  /[A-Z]/.test(password)],
                ["At least one number",     /[0-9]/.test(password)],
                ["At least one symbol",     /[^A-Za-z0-9]/.test(password)],
              ].map(([rule, met]) => (
                <div key={rule} className="flex items-center gap-2 mb-1">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${met ? "bg-emerald-500/20" : ""}`}
                    style={{ border: `1px solid ${met ? "#10B981" : "var(--border-color)"}` }}>
                    {met && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </div>
                  <span className="text-[11px]" style={{ color: met ? "#10B981" : "var(--text-muted)" }}>
                    {rule}
                  </span>
                </div>
              ))}
            </div>

            <button
              id="reset-submit-btn"
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
                : <><ShieldCheck className="w-4 h-4" /> Reset Password</>
              }
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm" style={{ color: "var(--text-muted)" }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
