import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

const GLOW_COLORS = {
  pink:    "var(--brand-glow-subtle)",
  blue:    "rgba(59, 130, 246, 0.25)",
  green:   "rgba(16, 185, 129, 0.25)",
  amber:   "rgba(245, 158, 11, 0.25)",
  purple:  "rgba(139, 92, 246, 0.25)",
  red:     "rgba(239, 68, 68, 0.25)",
  teal:    "rgba(20, 184, 166, 0.25)",
};

const ICON_BG = {
  pink:    "var(--bg-badge)",
  blue:    "rgba(59, 130, 246, 0.15)",
  green:   "rgba(16, 185, 129, 0.15)",
  amber:   "rgba(245, 158, 11, 0.15)",
  purple:  "rgba(139, 92, 246, 0.15)",
  red:     "rgba(239, 68, 68, 0.15)",
  teal:    "rgba(20, 184, 166, 0.15)",
};

const ICON_COLOR = {
  pink:    "var(--brand-primary)",
  blue:    "#3B82F6",
  green:   "#10B981",
  amber:   "#F59E0B",
  purple:  "#8B5CF6",
  red:     "#EF4444",
  teal:    "#14B8A6",
};

export default function StatCard({ icon: Icon, label, value, sub, color = "pink", trend }) {
  const glow = GLOW_COLORS[color] || GLOW_COLORS.pink;
  const iconBg = ICON_BG[color] || ICON_BG.pink;
  const iconColor = ICON_COLOR[color] || ICON_COLOR.pink;

  return (
    <div className="stat-card relative overflow-hidden">
      {/* Glow blob top-right */}
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
        style={{
          background: glow,
          filter: "blur(32px)",
          transform: "translate(30%, -30%)",
        }}
      />

      <div className="relative z-10">
        {/* Icon + trend */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: iconBg }}
          >
            {Icon && <Icon className="w-5 h-5" style={{ color: iconColor }} />}
          </div>

          {trend !== undefined && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
              style={{
                background: trend >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: trend >= 0 ? "#10B981" : "#EF4444",
              }}
            >
              {trend >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />
              }
              {Math.abs(trend)}%
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-3xl font-bold mb-0.5" style={{ color: "var(--text-heading)" }}>
          {value ?? "—"}
        </p>

        {/* Label */}
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>

        {/* Sub text */}
        {sub && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
