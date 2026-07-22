import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope,
  Eye, EyeOff,
  User, Mail, Lock, Stethoscope,
  AlertCircle, CheckCircle2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { signupUser, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

// Password strength checker
function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak",   color: "#EF4444", width: "20%" };
  if (score <= 2) return { label: "Fair",   color: "#F59E0B", width: "45%" };
  if (score <= 3) return { label: "Good",   color: "#3B82F6", width: "65%" };
  if (score <= 4) return { label: "Strong", color: "#10B981", width: "85%" };
  return              { label: "Very Strong", color: "#10B981", width: "100%" };
}

const SPECIALTIES = [
  "Cardiology", "Oncology", "Neurology", "Endocrinology",
  "Radiology", "Pediatrics", "General Medicine", "Surgery",
  "Pharmacology", "Psychiatry", "Other",
];

export default function SignUp() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError, signupDone } = useSelector(s => s.auth);

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", specialty: "",
  });
  const [showPw,        setShowPw]        = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errors,        setErrors]        = useState({});
  const [touched,       setTouched]       = useState({});

  const strength = form.password ? getStrength(form.password) : null;

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
    dispatch(clearAuthError());
  }

  function touch(field) {
    setTouched(prev => ({ ...prev, [field]: true }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = "Full name must be at least 2 characters.";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Please enter a valid email address.";
    if (!form.password || form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTouched({ name: true, email: true, password: true, confirmPassword: true });
      return;
    }
    dispatch(signupUser({
      name:      form.name.trim(),
      email:     form.email.toLowerCase().trim(),
      password:  form.password,
      specialty: form.specialty,
    }));
  }

  // Success state
  if (signupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
        <div className="w-full max-w-md text-center animate-fade-in">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.30)" }}>
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-heading)" }}>
            Check Your Email!
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            We sent a verification link to:
          </p>
          <p className="text-[#E21B70] font-semibold mb-6">{form.email}</p>
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            Click the link in the email to activate your account. The link expires in 24 hours.
            Check your spam folder if you don't see it.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { dispatch(clearFlags()); navigate("/login"); }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" /> Go to Login
            </button>
            <Link to="/login" className="text-sm" style={{ color: "var(--text-muted)" }}>
              Already verified?{" "}
              <span style={{ color: "var(--brand-primary)" }}>Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const field = (id, label, type, placeholder, icon, showToggle) => {
    const hasErr = touched[id] && errors[id];
    return (
      <div key={id}>
        <label htmlFor={id} className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            {icon}
          </span>
          <input
            id={id}
            type={showToggle ? (id === "password" ? (showPw ? "text" : "password") : (showConfirmPw ? "text" : "password")) : type}
            value={form[id]}
            onChange={e => set(id, e.target.value)}
            onBlur={() => touch(id)}
            placeholder={placeholder}
            className="input-base pl-10 pr-10"
            style={{ borderColor: hasErr ? "#EF4444" : undefined }}
          />
          {showToggle && (
            <button
              type="button"
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
              onClick={() => id === "password" ? setShowPw(v => !v) : setShowConfirmPw(v => !v)}
            >
              {(id === "password" ? showPw : showConfirmPw)
                ? <EyeOff className="w-4 h-4" />
                : <Eye    className="w-4 h-4" />}
            </button>
          )}
        </div>
        {hasErr && (
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#EF4444" }}>
            <AlertCircle className="w-3 h-3" /> {errors[id]}
          </p>
        )}
        {/* Password strength bar */}
        {id === "password" && form.password && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
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
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans antialiased" style={{ background: "var(--bg-page)" }}>

      {/* LEFT PANEL */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "radial-gradient(circle at 30% 20%, rgba(226,27,112,0.25) 0%, #0A0614 70%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-[#E21B70]/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#A53860]/10 blur-[100px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center shadow-[0_0_20px_rgba(226,27,112,0.4)]">
            <Microscope className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">MedResearch AI</span>
        </div>

        {/* Text */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Join the Future of<br/>
            <span className="bg-gradient-to-r from-white via-pink-100 to-[#E21B70] bg-clip-text text-transparent">
              Medical Research
            </span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-8">
            Create your account and gain access to AI-powered research tools, instant document Q&A, and verified medical insights.
          </p>
          <ul className="space-y-3">
            {[
              "AI answers from your own documents",
              "Secure, HIPAA-grade document storage",
              "Full citation trail for every response",
              "Role-based access for clinical teams",
            ].map(txt => (
              <li key={txt} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-full bg-[#E21B70]/20 border border-[#E21B70]/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#E21B70]" />
                </div>
                {txt}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-gray-600">
          Powered by Qdrant · FastEmbed · Groq LLaMA 3.3 70B
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div
        className="flex-1 flex flex-col justify-center p-6 sm:p-10 lg:p-14 overflow-y-auto"
        style={{ background: "var(--bg-page)" }}
      >
        <div className="w-full max-w-[480px] mx-auto">

          {/* Mobile logo */}
          <div className="flex items-center justify-between mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center">
                <Microscope className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>MedResearch AI</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Header */}
          <div className="mb-8">
            <div className="hidden lg:flex justify-end mb-4">
              <ThemeToggle />
            </div>
            <h2 className="text-3xl font-bold mb-1.5" style={{ color: "var(--text-heading)" }}>
              Create your account
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "#E21B70" }} className="font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Server error banner */}
          {authError && (
            <div className="mb-5 p-4 rounded-xl flex items-start gap-3 animate-fade-in"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.30)" }}>
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{authError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {field("name",            "Full Name",        "text",     "Dr. John Smith",           <User           className="w-4 h-4" />, false)}
            {field("email",           "Email Address",    "email",    "doctor@hospital.com",      <Mail           className="w-4 h-4" />, false)}
            {field("password",        "Password",         "password", "At least 8 characters",    <Lock           className="w-4 h-4" />, true)}
            {field("confirmPassword", "Confirm Password", "password", "Repeat your password",     <Lock           className="w-4 h-4" />, true)}

            {/* Specialty (optional) */}
            <div>
              <label htmlFor="specialty" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Medical Specialty <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <select
                  id="specialty"
                  value={form.specialty}
                  onChange={e => set("specialty", e.target.value)}
                  className="input-base pl-10 appearance-none"
                >
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Terms note */}
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              By creating an account, you agree to responsible use of the platform.
              Your account requires email verification before you can log in.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </>
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Back link */}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm flex items-center justify-center gap-1.5"
              style={{ color: "var(--text-muted)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
