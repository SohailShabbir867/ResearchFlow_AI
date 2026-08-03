import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Sparkles, AtSign, Lock, Eye, EyeOff, User, Stethoscope,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { signupUser, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const shellStyle = { background: "var(--bg-page)", color: "var(--text-primary)" };
const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border-color-subtle)", boxShadow: "var(--shadow-card)" };
const fieldStyle = { background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-input)" };
const softLabelStyle = { color: "var(--text-muted)" };
const strongTextStyle = { color: "var(--text-heading)" };
const brandButtonStyle = { background: "var(--brand-primary)", boxShadow: "var(--shadow-btn)" };

const SPECIALTIES = [
  "Cardiology", "Oncology", "Neurology", "Endocrinology",
  "Radiology", "Pediatrics", "General Medicine", "Surgery",
  "Pharmacology", "Psychiatry", "Other",
];

export default function SignUp() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError, signupDone } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", specialty: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  function set(field, val) {
    setForm((p) => ({ ...p, [field]: val }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
    dispatch(clearAuthError());
  }

  function touch(field) {
    setTouched((p) => ({ ...p, [field]: true }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Full name must be at least 2 characters.";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Please enter a valid email address.";
    if (!form.password || form.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
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
      name: form.name.trim(),
      email: form.email.toLowerCase().trim(),
      password: form.password,
      specialty: form.specialty,
    }));
  }

  if (signupDone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans antialiased" style={shellStyle}>
        <div className="w-full max-w-[540px] rounded-3xl p-8 sm:p-12 text-center animate-fade-in" style={cardStyle}>
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.10)", border: "2px solid rgba(16,185,129,0.25)" }}>
            <CheckCircle2 className="w-10 h-10" style={{ color: "#34D399" }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-3" style={strongTextStyle}>Check Your Email!</h1>
          <p className="text-sm mb-2 font-medium" style={softLabelStyle}>We sent a verification link to:</p>
          <p className="font-bold mb-6" style={{ color: "var(--brand-primary)" }}>{form.email}</p>
          <p className="text-xs mb-8 leading-relaxed" style={softLabelStyle}>
            Click the link in the email to activate your account. The link expires in 24 hours. Check your spam folder if you don't see it.
          </p>
          <button
            onClick={() => { dispatch(clearFlags()); navigate("/login"); }}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={brandButtonStyle}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

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
              Join ResearchFlow AI<br />Intelligence.
            </h1>
            <p className="text-sm text-white/75 leading-relaxed font-medium max-w-sm">
              Access real-time AI security knowledge or upload private RAG datasets for custom ethical hacking research.
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

        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[620px]">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: "var(--border-color-subtle)" }}>
              <div className="flex items-center gap-8 text-sm font-semibold">
                <div className="relative" style={strongTextStyle}>
                  <span>Sign Up</span>
                  <div className="absolute -bottom-[13px] left-0 right-0 h-[3px] rounded-full" style={{ background: "var(--brand-primary)" }} />
                </div>
                <Link to="/login" className="transition-colors" style={softLabelStyle}>Log In</Link>
              </div>
              <ThemeToggle />
            </div>

            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight" style={strongTextStyle}>Create Account</h2>
              <p className="text-xs mt-1 font-medium" style={softLabelStyle}>Enter your details to register as a clinical user.</p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-2xl text-xs font-medium flex items-center gap-2" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#F87171" }} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={strongTextStyle}>FULL NAME</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={softLabelStyle}><User className="w-4 h-4" /></div>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => touch("name")}
                    placeholder="Dr. Sarah Jenkins"
                    className="w-full h-11 pl-11 pr-4 text-xs font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                    style={fieldStyle}
                  />
                </div>
                {touched.name && errors.name && <p className="text-[11px] mt-1 font-medium" style={{ color: "#FCA5A5" }}>⚠ {errors.name}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={strongTextStyle}>EMAIL ADDRESS</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={softLabelStyle}><AtSign className="w-4 h-4" /></div>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    onBlur={() => touch("email")}
                    placeholder="doctor@hospital.com"
                    className="w-full h-11 pl-11 pr-4 text-xs font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                    style={fieldStyle}
                  />
                </div>
                {touched.email && errors.email && <p className="text-[11px] mt-1 font-medium" style={{ color: "#FCA5A5" }}>⚠ {errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={strongTextStyle}>
                    SPECIALTY <span className="font-normal" style={softLabelStyle}>(OPTIONAL)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={softLabelStyle}><Stethoscope className="w-3.5 h-3.5" /></div>
                    <select
                      value={form.specialty}
                      onChange={(e) => set("specialty", e.target.value)}
                      className="w-full h-11 pl-10 pr-3 text-xs font-medium rounded-2xl outline-none transition-all appearance-none cursor-pointer"
                      style={fieldStyle}
                    >
                      <option value="">Select specialty…</option>
                      {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={strongTextStyle}>PASSWORD</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={softLabelStyle}><Lock className="w-3.5 h-3.5" /></div>
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      onBlur={() => touch("password")}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-9 text-xs font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                      style={fieldStyle}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={softLabelStyle}>
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest mb-1" style={strongTextStyle}>CONFIRM PASSWORD</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={softLabelStyle}><Lock className="w-4 h-4" /></div>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    onBlur={() => touch("confirmPassword")}
                    placeholder="Repeat password"
                    className="w-full h-11 pl-11 pr-11 text-xs font-medium rounded-2xl outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:shadow-[0_0_0_3px_var(--brand-glow-subtle)]"
                    style={fieldStyle}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1" style={softLabelStyle}>
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && <p className="text-[11px] mt-1 font-medium" style={{ color: "#FCA5A5" }}>⚠ {errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 mt-3"
                style={brandButtonStyle}
              >
                {loading ? <span>Creating account…</span> : <span>Register Account</span>}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-3 text-center border-t" style={{ borderColor: "var(--border-color-subtle)" }}>
            <p className="text-xs font-semibold" style={softLabelStyle}>
              Already have an account? <Link to="/login" className="font-bold hover:underline" style={{ color: "var(--brand-primary)" }}>Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
