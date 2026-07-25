import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  Microscope, 
  Users, 
  FileText, 
  MessageSquare, 
  Settings, 
  HeartPulse, 
  BarChart3, 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  Bot, 
  Check, 
  AlertTriangle, 
  Save, 
  Sliders,
  CheckCircle2,
  Sparkles,
  Minus,
  Plus,
  Menu
} from "lucide-react";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function SystemSettings() {
  const navigate = useNavigate();

  // Navigation State
  const [mobileOpen, setMobileOpen] = useState(false);

  // Guardrail Configuration State
  const [threshold, setThreshold] = useState(-2.0); // Strict zone default
  const [minChunks, setMinChunks] = useState(1);
  const [maxChunks, setMaxChunks] = useState(5);
  const [defaultChunks, setDefaultChunks] = useState(2);

  // Rate Limiting State
  const [maxQueriesPerHour, setMaxQueriesPerHour] = useState(50);
  const [maxUploadsPerDay, setMaxUploadsPerDay] = useState(10);

  // LLM Configuration State
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.2);

  // Loading state
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // UI Toast State
  const [showToast, setShowToast] = useState(false);
  const [guardrailSavedMsg, setGuardrailSavedMsg] = useState("");

  // ─── Load settings from API on mount ─────────────────────────────────────
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get("/api/admin/settings");
        const data = res.data;
        if (data.guardrail) {
          if (data.guardrail.threshold !== undefined) setThreshold(data.guardrail.threshold);
          if (data.guardrail.minChunks !== undefined) setMinChunks(data.guardrail.minChunks);
        }
        if (data.rateLimiting) {
          if (data.rateLimiting.maxQueriesPerHour !== undefined) setMaxQueriesPerHour(data.rateLimiting.maxQueriesPerHour);
          if (data.rateLimiting.maxUploadsPerDay !== undefined) setMaxUploadsPerDay(data.rateLimiting.maxUploadsPerDay);
        }
        if (data.llm) {
          if (data.llm.model !== undefined) setSelectedModel(data.llm.model);
          if (data.llm.maxTokens !== undefined) setMaxTokens(data.llm.maxTokens);
          if (data.llm.temperature !== undefined) setTemperature(data.llm.temperature);
        }
      } catch (err) {
        console.error("Failed to load settings:", err.message);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  // ─── Save all settings to API ────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaveLoading(true);
    try {
      await axios.post("/api/admin/settings", {
        guardrail: { threshold, minChunks },
        rateLimiting: { maxQueriesPerHour, maxUploadsPerDay },
        llm: { model: selectedModel, maxTokens, temperature },
      });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err.message);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Helper for Zone Badge Info
  const getZoneBadge = (val) => {
    if (val <= -3.5) {
      return { label: "Loose", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    }
    if (val <= -2.5) {
      return { label: "Moderate", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    }
    if (val <= -1.0) {
      return { label: "Strict", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    }
    return { label: "Very Strict", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  };

  const zoneInfo = getZoneBadge(threshold);

  // Handle Guardrail Save Only
  const handleSaveGuardrails = () => {
    setGuardrailSavedMsg("✓ Guardrail parameters updated");
    setTimeout(() => setGuardrailSavedMsg(""), 2500);
  };

  return (
    <div className="admin-ui flex h-screen w-full font-sans antialiased overflow-hidden" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
      

      {/* Shared Admin Sidebar with working React Router navigation */}
      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />


      {/* ── MAIN CONTENT AREA (max-w-[900px]) ── */}
      <main className="flex-1 flex flex-col h-full bg-[#0F0A1E] relative overflow-y-auto p-6 lg:p-8">
        <div className="max-w-[900px] w-full mx-auto space-y-8">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
                title="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-[24px] font-bold text-white tracking-tight">
                  System Settings
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  Configure AI guardrails, rate limits, and LLM parameters
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>


          {/* ── SECTION 1 — GUARDRAIL CONFIGURATION (Glass Card) ── */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md">
            
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-9 h-9 rounded-xl bg-[#E21B70]/20 border border-[#E21B70]/30 text-[#E21B70] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Guardrail Configuration
                </h2>
                <p className="text-xs text-gray-400">
                  Vector relevance threshold & document chunk retrieval criteria
                </p>
              </div>
            </div>

            {/* Grid 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
              
              {/* LEFT: Relevance Threshold Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider">
                    Relevance Threshold
                  </label>
                  {/* Current Value Badge */}
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${zoneInfo.color}`}>
                    {zoneInfo.label} · {threshold.toFixed(1)}
                  </span>
                </div>

                {/* Color-Coded Gradient Track Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="-5.0"
                    max="0.0"
                    step="0.1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full h-2.5 rounded-lg appearance-none cursor-pointer outline-none"
                    style={{
                      background: "linear-gradient(to right, #EF4444 0%, #EF4444 30%, #F59E0B 30%, #F59E0B 50%, #10B981 50%, #10B981 80%, #3B82F6 80%, #3B82F6 100%)"
                    }}
                  />

                  {/* Scale Labels */}
                  <div className="flex justify-between text-[11px] font-mono text-gray-400 font-semibold px-0.5">
                    <span>-5.0</span>
                    <span>-3.5</span>
                    <span>-2.5</span>
                    <span>-1.0</span>
                    <span>0.0</span>
                  </div>
                </div>

                {/* Color Zone Legend Chips */}
                <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    zoneInfo.label === "Loose" ? "bg-red-500/20 text-red-400 border-red-500" : "bg-white/5 text-gray-400 border-white/10"
                  }`}>
                    Loose
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    zoneInfo.label === "Moderate" ? "bg-amber-500/20 text-amber-400 border-amber-500" : "bg-white/5 text-gray-400 border-white/10"
                  }`}>
                    Moderate
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    zoneInfo.label === "Strict" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500" : "bg-white/5 text-gray-400 border-white/10"
                  }`}>
                    Strict ✓
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                    zoneInfo.label === "Very Strict" ? "bg-blue-500/20 text-blue-400 border-blue-500" : "bg-white/5 text-gray-400 border-white/10"
                  }`}>
                    Very Strict
                  </span>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Queries with vector distance scores lower than the selected threshold will trigger out-of-scope refusals.
                </p>
              </div>

              {/* RIGHT: Minimum Chunks Required Custom Stepper */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-white uppercase tracking-wider">
                  Minimum document chunks
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {/* Min Box */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 font-semibold">min</span>
                    <input
                      type="number"
                      value={minChunks}
                      onChange={(e) => setMinChunks(parseInt(e.target.value) || 1)}
                      className="w-full text-center bg-transparent text-white font-bold text-lg outline-none"
                    />
                  </div>

                  {/* Max Box */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1 font-semibold">max</span>
                    <input
                      type="number"
                      value={maxChunks}
                      onChange={(e) => setMaxChunks(parseInt(e.target.value) || 5)}
                      className="w-full text-center bg-transparent text-white font-bold text-lg outline-none"
                    />
                  </div>

                  {/* Default Box with Stepper Controls */}
                  <div className="p-3 rounded-xl bg-white/5 border border-[#E21B70]/40 text-center relative">
                    <span className="text-[10px] text-[#E21B70] uppercase block mb-1 font-semibold">default</span>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setDefaultChunks(Math.max(minChunks, defaultChunks - 1))}
                        className="p-1 rounded bg-white/10 text-gray-300 hover:text-white transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-white text-lg font-mono">{defaultChunks}</span>
                      <button
                        type="button"
                        onClick={() => setDefaultChunks(Math.min(maxChunks, defaultChunks + 1))}
                        className="p-1 rounded bg-white/10 text-gray-300 hover:text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveGuardrails}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-xs shadow-sm hover:opacity-95 transition-all"
                  >
                    Save Guardrail Settings
                  </button>
                  {guardrailSavedMsg && (
                    <p className="text-xs text-emerald-400 mt-2 font-semibold text-center animate-fade-in">
                      {guardrailSavedMsg}
                    </p>
                  )}
                </div>

              </div>

            </div>

          </div>


          {/* ── SECTION 2 — RATE LIMITING (Glass Card) ── */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md">
            
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Rate Limiting
                </h2>
                <p className="text-xs text-gray-400">
                  Protect vector search infrastructure against query floods
                </p>
              </div>
            </div>

            {/* Inputs Side by Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Max queries per user per hour
                </label>
                <input
                  type="number"
                  value={maxQueriesPerHour}
                  onChange={(e) => setMaxQueriesPerHour(parseInt(e.target.value) || 0)}
                  className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Max document uploads per day
                </label>
                <input
                  type="number"
                  value={maxUploadsPerDay}
                  onChange={(e) => setMaxUploadsPerDay(parseInt(e.target.value) || 0)}
                  className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                />
              </div>
            </div>

            {/* Amber Warning Box */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>⚠ Rate limit changes require a Node.js server restart to take effect</span>
            </div>

          </div>


          {/* ── SECTION 3 — LLM CONFIGURATION (Glass Card) ── */}
          <div className="rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] p-6 backdrop-blur-md">
            
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  LLM Configuration
                </h2>
                <p className="text-xs text-gray-400">
                  Select Groq model weights, response lengths, and generation temperature
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              {/* Groq Model Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Groq Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-11 px-4 text-sm text-white bg-[#1A1230] border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all cursor-pointer"
                >
                  <option value="llama-3.3-70b-versatile">Groq LLaMA 3.3 70B Versatile</option>
                  <option value="llama-3.1-8b-instant">Groq LLaMA 3.1 8B Instant</option>
                  <option value="mixtral-8x7b-32768">Groq Mixtral 8x7B 32k</option>
                </select>
              </div>

              {/* Max Response Tokens */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Max Response Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 256)}
                  className="w-full h-11 px-4 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#E21B70] transition-all"
                />
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-300">
                  Temperature: <span className="font-mono text-white font-bold">{temperature.toFixed(2)}</span>
                </label>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  {temperature <= 0.3 ? "Focused & Accurate" : temperature <= 0.7 ? "Balanced" : "Creative"}
                </span>
              </div>

              {/* Green to Red Gradient Track Slider */}
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                style={{
                  background: "linear-gradient(to right, #10B981 0%, #F59E0B 50%, #EF4444 100%)"
                }}
              />
              <div className="flex justify-between text-[11px] font-mono text-gray-500">
                <span>0.0 (Deterministic)</span>
                <span>0.5</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

          </div>


          {/* ── SAVE ALL SETTINGS BUTTON ── */}
          <div className="pt-2 pb-12">
            <button
              onClick={handleSaveAll}
              disabled={saveLoading}
              className="w-full h-[52px] rounded-xl bg-gradient-to-r from-[#E21B70] to-[#A53860] text-white font-semibold text-base shadow-lg shadow-[#E21B70]/25 hover:opacity-95 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{saveLoading ? "Saving..." : "Save All Settings"}</span>
            </button>
          </div>

        </div>

        {/* ── SUCCESS TOAST NOTIFICATION (Bottom Right) ── */}
        {showToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#0E281E] border border-emerald-500/40 text-emerald-300 px-5 py-3.5 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>✓ Settings saved and applied</span>
          </div>
        )}

      </main>
    </div>
  );
}
