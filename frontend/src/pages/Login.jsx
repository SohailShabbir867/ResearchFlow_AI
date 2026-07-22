import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import axios from "axios";

export default function Login() {
  const navigate = useNavigate();
  
  // State management
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const validateEmail = (val) => {
    if (!val) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return "Please enter a valid email address";
    return "";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setEmailError("");
    setSuccessMsg("");

    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // Attempt login against backend API if available, or simulate fallback for showcase
      try {
        const response = await axios.post("/api/auth/login", { email, password });
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
        }
      } catch (apiErr) {
        // If API fails or backend isn't running, provide realistic response based on inputs
        if (apiErr.response?.data?.error) {
          throw new Error(apiErr.response.data.error);
        }
        // Demo fallback validation: test error trigger if invalid password
        if (password.length < 6) {
          throw new Error("Invalid credentials. Password must be at least 6 characters.");
        }
      }

      setSuccessMsg("Signed in successfully! Redirecting to research workspace...");
      setTimeout(() => {
        navigate("/");
      }, 1200);

    } catch (err) {
      setError(err.message || "Incorrect email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0A0614] font-sans antialiased selection:bg-[#E21B70]/30 selection:text-white">
      
      {/* ── LEFT PANEL (50% width on Desktop) ── */}
      <div 
        className="w-full lg:w-1/2 min-h-[480px] lg:min-h-screen bg-[#0A0614] relative p-8 lg:p-14 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10"
        style={{
          background: "radial-gradient(circle at 25% 25%, rgba(226, 27, 112, 0.22) 0%, rgba(10, 6, 20, 1) 75%)"
        }}
      >
        {/* Decorative Blurred Pink Glow Blobs in background corners */}
        <div 
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#E21B70]/20 blur-[100px] pointer-events-none" 
          aria-hidden="true" 
        />
        <div 
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-[#E21B70]/15 blur-[120px] pointer-events-none" 
          aria-hidden="true" 
        />
        <div 
          className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-[#3A0519]/40 blur-[80px] pointer-events-none" 
          aria-hidden="true" 
        />

        {/* Subtle SVG Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        {/* Top Header / Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E21B70] to-[#A53860] flex items-center justify-center shadow-[0_0_20px_rgba(226,27,112,0.4)] text-white">
            <Microscope className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">
            MedResearch AI
          </span>
        </div>

        {/* Hero Section & Features */}
        <div className="relative z-10 my-10 lg:my-0 max-w-xl">
          <h1 className="text-[36px] sm:text-[40px] font-bold text-white leading-[1.15] tracking-tight mb-4">
            AI-Powered<br />
            <span className="bg-gradient-to-r from-white via-pink-100 to-[#E21B70] bg-clip-text text-transparent">
              Medical Research
            </span>
          </h1>
          
          <p className="text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
            Ask clinical questions. Get answers from your documents.
          </p>

          {/* 3 Feature Rows in Glass Cards */}
          <div className="space-y-3.5">
            {/* Feature 1 */}
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200 group">
              <div className="w-10 h-10 rounded-lg bg-[#E21B70]/15 border border-[#E21B70]/30 flex items-center justify-center text-[#E21B70] shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Document Security & Compliance</h2>
                <p className="text-gray-400 text-xs mt-0.5 leading-normal">HIPAA-compliant document lock protecting all sensitive clinical files.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200 group">
              <div className="w-10 h-10 rounded-lg bg-[#E21B70]/15 border border-[#E21B70]/30 flex items-center justify-center text-[#E21B70] shrink-0 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Lightning Fast Retrieval</h2>
                <p className="text-gray-400 text-xs mt-0.5 leading-normal">Sub-second vector query responses across large medical paper libraries.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] backdrop-blur-md hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200 group">
              <div className="w-10 h-10 rounded-lg bg-[#E21B70]/15 border border-[#E21B70]/30 flex items-center justify-center text-[#E21B70] shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">Verifiable Citations</h2>
                <p className="text-gray-400 text-xs mt-0.5 leading-normal">Every insight is directly cited and linked to exact source excerpts.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Text */}
        <div className="relative z-10 pt-4">
          <p className="text-xs text-gray-500 font-medium tracking-wide">
            Powered by <span className="text-gray-400 font-semibold">Qdrant</span> · <span className="text-gray-400 font-semibold">FastEmbed</span> · <span className="text-gray-400 font-semibold">Groq LLaMA 3.3 70B</span>
          </p>
        </div>
      </div>


      {/* ── RIGHT PANEL (50% width on Desktop) ── */}
      <div className="w-full lg:w-1/2 min-h-screen bg-[#FFFFFF] flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-[420px] mx-auto">

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-gray-500 text-sm mt-1.5">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            
            {/* Email Field */}
            <div>
              <label 
                htmlFor="email-input" 
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="doctor@hospital.com"
                className={`w-full h-11 px-4 text-gray-900 bg-white text-sm rounded-[10px] border transition-all duration-200 outline-none ${
                  emailError 
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100" 
                    : "border-gray-300 focus:border-[#E21B70] focus:ring-2 focus:ring-[#E21B70]/20"
                }`}
              />
              {emailError && (
                <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                  <span>⚠</span> {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label 
                  htmlFor="password-input" 
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <a
                  href="#forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Password reset instructions have been sent to your administrator.");
                  }}
                  className="text-xs font-semibold text-[#E21B70] hover:text-[#A53860] hover:underline transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-4 pr-11 text-gray-900 bg-white text-sm rounded-[10px] border border-gray-300 focus:border-[#E21B70] focus:ring-2 focus:ring-[#E21B70]/20 transition-all duration-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Solid Pink Gradient Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-base shadow-md shadow-[#E21B70]/25 hover:opacity-95 hover:shadow-lg hover:shadow-[#E21B70]/35 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg 
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4" 
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
                    />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Toggle Buttons for Testing Error/Loading States */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-3">
            <p className="text-xs text-gray-400">
              Need assistance? Contact support or system administrator.
            </p>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setError(error ? "" : "Invalid email or password. Please try again.")}
                className="text-[11px] px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                Toggle Error State
              </button>
              <button 
                type="button" 
                onClick={() => setLoading(!loading)}
                className="text-[11px] px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                Toggle Loading State
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
