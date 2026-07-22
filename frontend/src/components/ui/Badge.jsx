const variants = {
  primary: "bg-[#E21B70]/20 text-[#E21B70] border border-[#E21B70]/30",
  success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  error:   "bg-red-500/20 text-red-400 border border-red-500/30",
  info:    "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  ghost:   "bg-white/10 text-gray-300 border border-white/10",
  purple:  "bg-purple-500/20 text-purple-400 border border-purple-500/30",
};

export default function Badge({ children, variant = "ghost", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                      text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
