import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [show, setShow]     = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!form.email || !form.password) { setError("All fields are required."); return; }
    setLoading(true);
    try {
      await axios.post("/api/auth/login", form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0F0A1E]">

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between
                      bg-gradient-to-br from-[#0A0614] via-[#1a0822] to-[#0F0A1E]
                      border-r border-white/5 p-12 relative overflow-hidden">

        {/* Decorative blobs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full
                        bg-[#E21B70]/10 blur-3xl pointer-events-none"/>
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full
                        bg-[#A53860]/10 blur-3xl pointer-events-none"/>

        {/* Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-primary
                          flex items-center justify-center glow-sm text-xl">
            🔬
          </div>
          <div>
            <p className="font-bold text-white">MedResearch AI</p>
            <p className="text-xs text-gray-500">Medical Intelligence Platform</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            AI-Powered<br/>
            <span className="gradient-text">Medical Research</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Ask clinical questions.<br/>
            Get answers from your documents.
          </p>

          {/* Features */}
          {[
            { icon: "🔒", title: "Document-strict answers", desc: "AI only responds from your uploaded medical documents" },
            { icon: "⚡", title: "Sub-second retrieval", desc: "Hybrid search across thousands of medical documents instantly" },
            { icon: "📄", title: "Cited sources", desc: "Every answer shows exactly which document it came from" },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10
                              flex items-center justify-center text-lg shrink-0">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="z-10">
          <p className="text-xs text-gray-600">
            Powered by Qdrant · FastEmbed · Groq LLaMA 3.3 70B
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              🔬
            </div>
            <p className="font-bold text-white">MedResearch AI</p>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-gray-400 mb-8">Sign in to your account to continue</p>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6
                            bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
              <span>⚠</span>{error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            <div>
              <label className="input-label">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({...p, email: e.target.value}))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="doctor@hospital.com"
                className="input-base"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="input-label mb-0">Password</label>
                <button className="text-xs text-[#E21B70] hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({...p, password: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className="input-base pr-12"
                />
                <button onClick={() => setShow(!show)}
                        className="absolute right-4 top-1/2 -translate-y-1/2
                                   text-gray-500 hover:text-gray-300 transition-colors text-sm">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary w-full mt-8 flex items-center justify-center gap-2 py-3 text-base">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in...</>
              : "Sign in"}
          </button>

          <p className="text-center text-xs text-gray-600 mt-6">
            Don't have an account?{" "}
            <span className="text-[#E21B70] cursor-pointer hover:underline">
              Contact your administrator
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
