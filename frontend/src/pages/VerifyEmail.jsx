import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Microscope, CheckCircle2, XCircle, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import axios from "axios";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [status,       setStatus]       = useState("loading"); // loading | success | expired | error
  const [message,      setMessage]      = useState("");
  const [email,        setEmail]        = useState("");
  const [resendEmail,  setResendEmail]  = useState("");
  const [resending,    setResending]    = useState(false);
  const [resendMsg,    setResendMsg]    = useState("");
  const [resendError,  setResendError]  = useState("");
  const [countdown,    setCountdown]    = useState(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token found."); return; }

    axios.get(`/api/auth/verify-email/${token}`)
      .then(res => {
        setStatus(res.data.alreadyVerified ? "already" : "success");
        setMessage(res.data.message);
        setCountdown(5);
      })
      .catch(err => {
        const data = err.response?.data;
        if (data?.expired) {
          setStatus("expired");
          setEmail(data.email || "");
        } else {
          setStatus("error");
        }
        setMessage(data?.error || "Verification failed.");
      });
  }, [token]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate("/login"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  async function handleResend() {
    const target = resendEmail || email;
    if (!target) { setResendError("Please enter your email address."); return; }
    setResending(true);
    setResendError("");
    setResendMsg("");
    try {
      const res = await axios.post("/api/auth/resend-verification", { email: target });
      setResendMsg(res.data.message);
    } catch (err) {
      setResendError(err.response?.data?.error || "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const Card = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
               style={{ background: "var(--brand-primary)" }}>
            <Microscope className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <span className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>ResearchFlow AI</span>
        </div>
        <div className="p-8 rounded-2xl text-center" style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color-subtle)",
          boxShadow: "var(--shadow-card)"
        }}>
          {children}
        </div>
      </div>
    </div>
  );

  if (status === "loading") return (
    <Card>
      <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: "var(--brand-primary)" }} />
      <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
        Verifying your email…
      </h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Please wait a moment.</p>
    </Card>
  );

  if (status === "success" || status === "already") return (
    <Card>
      <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.30)" }}>
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>
        {status === "already" ? "Already Verified!" : "Email Verified!"}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {message} {status === "success" && "You can now log in and start your research."}
      </p>
      {countdown !== null && (
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Redirecting to login in <span className="font-bold" style={{ color: "var(--brand-primary)" }}>{countdown}s</span>…
        </p>
      )}
      <button onClick={() => navigate("/login")}
              className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" }}>
        <ArrowRight className="w-4 h-4" /> Sign In Now
      </button>
    </Card>
  );

  if (status === "expired") return (
    <Card>
      <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{ background: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.30)" }}>
        <RefreshCw className="w-8 h-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Link Expired</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Your verification link has expired. Request a new one below — it's valid for 24 hours.
      </p>
      {resendMsg ? (
        <div className="p-4 rounded-xl mb-4 text-sm font-medium text-emerald-600"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)" }}>
          ✅ {resendMsg}
        </div>
      ) : (
        <div className="space-y-3 text-left">
          <input
            type="email"
            placeholder={email || "your@email.com"}
            value={resendEmail}
            onChange={e => setResendEmail(e.target.value)}
            style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" }}
            className="w-full h-11 px-4 text-sm rounded-xl outline-none"
          />
          {resendError && <p className="text-xs text-red-500">{resendError}</p>}
          <button onClick={handleResend} disabled={resending}
                  className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{ background: "var(--brand-primary)" }}>
            {resending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><RefreshCw className="w-4 h-4" /> Resend Verification Email</>}
          </button>
        </div>
      )}
      <Link to="/login" className="block mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Back to Login</Link>
    </Card>
  );

  return (
    <Card>
      <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{ background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.30)" }}>
        <XCircle className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Verification Failed</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {message || "This verification link is invalid or has already been used."}
      </p>
      <div className="space-y-3">
        <Link to="/signup" className="w-full text-center block py-2.5 text-sm font-semibold rounded-xl text-white"
              style={{ background: "var(--brand-primary)" }}>
          Create a New Account
        </Link>
        <Link to="/login" className="block text-sm text-center" style={{ color: "var(--text-muted)" }}>
          Back to Login
        </Link>
      </div>
    </Card>
  );
}
