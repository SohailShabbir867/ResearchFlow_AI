import React from "react";

const VARIANTS = {
  primary: "bg-[var(--bg-badge)] text-[var(--brand-primary)] border border-[var(--border-color)]",
  success: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  error:   "bg-red-500/15 text-red-500 border border-red-500/30",
  info:    "bg-blue-500/15 text-blue-500 border border-blue-500/30",
  purple:  "bg-purple-500/15 text-purple-500 border border-purple-500/30",
  ghost:   "",
};

export default function Badge({ children, variant = "ghost", className = "" }) {
  const variantClass = VARIANTS[variant] || VARIANTS.ghost;

  // Ghost uses CSS variables for theme-awareness
  const ghostStyle = variant === "ghost" ? {
    backgroundColor: "var(--bg-badge)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-color)",
  } : {};

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantClass} ${className}`}
      style={ghostStyle}
    >
      {children}
    </span>
  );
}
