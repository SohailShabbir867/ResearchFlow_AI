import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Microscope, AtSign, Lock, Eye, EyeOff, User, Stethoscope,
  AlertCircle, CheckCircle2, ArrowRight,
} from "lucide-react";
import { signupUser, clearAuthError, clearFlags } from "../store/authSlice.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const SPECIALTIES = [
  "Cardiology","Oncology","Neurology","Endocrinology",
  "Radiology","Pediatrics","General Medicine","Surgery",
  "Pharmacology","Psychiatry","Other",
];

export default function SignUp() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError, signupDone } = useSelector(s => s.auth);

  const [form, setForm] = useState({ name:"", email:"", password:"", confirmPassword:"", specialty:"" });
  const [showPw,        setShowPw]        = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [errors,        setErrors]        = useState({});
  const [touched,       setTouched]       = useState({});

  function set(field, val) {
    setForm(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: "" }));
    dispatch(clearAuthError());
  }
  function touch(field) { setTouched(p => ({ ...p, [field]: true })); }

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
      setTouched({ name:true, email:true, password:true, confirmPassword:true });
      return;
    }
    dispatch(signupUser({
      name:      form.name.trim(),
      email:     form.email.toLowerCase().trim(),
      password:  form.password,
      specialty: form.specialty,
    }));
  }

  /* ── Success Screen ─────────────────────────────────────────── */
  if (signupDone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans antialiased"
           style={{ background: "#F4F1EA" }}>
        <div className="w-full max-w-[540px] bg-white rounded-3xl p-8 sm:p-12 text-center shadow-xl border border-[#E6E0D4] animate-fade-in">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-emerald-50 border-2 border-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#012D1D] mb-3">
            Check Your Email!
          </h1>
          <p className="text-sm text-[#70675C] mb-2 font-medium">
            We sent a verification link to:
          </p>
          <p className="font-bold text-[#D87739] mb-6">{form.email}</p>
          <p className="text-xs text-[#70675C] mb-8 leading-relaxed">
            Click the link in the email to activate your account. The link expires in 24 hours. Check your spam folder if you don't see it.
          </p>
          <button
            onClick={() => { dispatch(clearFlags()); navigate("/login"); }}
            className="w-full h-12 rounded-2xl bg-[#012D1D] hover:bg-[#024029] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#012D1D]/20 transition-all"
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 font-sans antialiased"
         style={{ background: "#F4F1EA" }}>

      {/* ── CENTERED TWO-PANEL CARD ── */}
      <div className="w-full max-w-[960px] bg-white rounded-3xl sm:rounded-[28px] overflow-hidden flex flex-col md:flex-row shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-[#E6E0D4]">

        {/* ── LEFT HERO PANEL ── */}
        <div className="w-full md:w-[44%] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden shrink-0"
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
              Join ResearchAI<br />Intelligence.
            </h1>
            <p className="text-sm text-[#3E2010]/80 leading-relaxed font-medium">
              Access real-time AI knowledge streaming or upgrade to Pro to upload private RAG datasets.
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
        <div className="w-full md:w-[56%] p-8 sm:p-10 flex flex-col justify-between bg-white">
          <div>

            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#F0EBE1]">
              <div className="flex items-center gap-8 text-sm font-bold">
                <div className="relative text-[#012D1D]">
                  <span>Sign Up</span>
                  <div className="absolute -bottom-[13px] left-0 right-0 h-[3px] bg-[#D87739] rounded-full" />
                </div>
                <Link to="/login" className="text-[#8C8275] hover:text-[#012D1D] transition-colors">
                  Log In
                </Link>
              </div>
              <ThemeToggle />
            </div>

            {/* Title */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[#012D1D] tracking-tight">
                Create Account
              </h2>
              <p className="text-xs text-[#70675C] mt-1 font-medium">
                Enter your details to register as a clinical user.
              </p>
            </div>

            {/* Banners */}
            {authError && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1">
                  FULL NAME
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8275]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    onBlur={() => touch("name")}
                    placeholder="Dr. Sarah Jenkins"
                    className="w-full h-11 pl-11 pr-4 text-xs font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white focus:ring-2 focus:ring-[#D87739]/15 outline-none transition-all placeholder-[#A09688]"
                  />
                </div>
                {touched.name && errors.name && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">⚠ {errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8275]">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => set("email", e.target.value)}
                    onBlur={() => touch("email")}
                    placeholder="doctor@hospital.com"
                    className="w-full h-11 pl-11 pr-4 text-xs font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white focus:ring-2 focus:ring-[#D87739]/15 outline-none transition-all placeholder-[#A09688]"
                  />
                </div>
                {touched.email && errors.email && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">⚠ {errors.email}</p>
                )}
              </div>

              {/* Specialty & Password grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Specialty */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1">
                    SPECIALTY <span className="text-[#8C8275] font-normal">(OPTIONAL)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8275]">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                    <select
                      value={form.specialty}
                      onChange={e => set("specialty", e.target.value)}
                      className="w-full h-11 pl-10 pr-3 text-xs font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select specialty…</option>
                      {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8275]">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={e => set("password", e.target.value)}
                      onBlur={() => touch("password")}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-9 text-xs font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white outline-none transition-all placeholder-[#A09688]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8275] p-1"
                    >
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#012D1D] mb-1">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8275]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={e => set("confirmPassword", e.target.value)}
                    onBlur={() => touch("confirmPassword")}
                    placeholder="Repeat password"
                    className="w-full h-11 pl-11 pr-11 text-xs font-medium text-[#012D1D] bg-[#F7F5F0] rounded-2xl border border-transparent focus:border-[#D87739] focus:bg-white outline-none transition-all placeholder-[#A09688]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C8275] p-1"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <p className="text-[11px] text-red-500 mt-1 font-medium">⚠ {errors.confirmPassword}</p>
                )}
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-[#012D1D] hover:bg-[#024029] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#012D1D]/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 mt-3"
              >
                {loading ? (
                  <span>Creating account…</span>
                ) : (
                  <span>Register Account →</span>
                )}
              </button>

            </form>
          </div>

          {/* Footer Note */}
          <div className="mt-6 pt-3 text-center border-t border-[#F0EBE1]">
            <p className="text-xs text-[#70675C] font-semibold">
              Already have an account?{" "}
              <Link to="/login" className="font-bold text-[#D87739] hover:underline">
                Log in
              </Link>
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
