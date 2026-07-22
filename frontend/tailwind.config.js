/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: { DEFAULT: "#E21B70", dark: "#3A0519", hover: "#c4155f", deep: "#670D2F" },
        accent:  { DEFAULT: "#A53860", dark: "#8f2d50" },

        // Semantic backgrounds (dark defaults, overridden by CSS vars in light mode)
        page:    "#0F0A1E",
        sidebar: "#0A0614",

        // Status
        success: "#10B981",
        warning: "#F59E0B",
        danger:  "#EF4444",
        info:    "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #E21B70, #A53860)",
        "gradient-dark":    "linear-gradient(135deg, #3A0519, #0F0A1E)",
        "gradient-card":    "linear-gradient(135deg, rgba(226,27,112,0.08), rgba(165,56,96,0.04))",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease forwards",
        "slide-in":   "slideInLeft 0.3s ease forwards",
        "slide-right":"slideInRight 0.3s ease forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "spin-slow":  "spinSlow 3s linear infinite",
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0, transform: "translateY(8px)" },   to: { opacity: 1, transform: "translateY(0)" } },
        slideInLeft:  { from: { opacity: 0, transform: "translateX(-20px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        slideInRight: { from: { opacity: 0, transform: "translateX(20px)" },  to: { opacity: 1, transform: "translateX(0)" } },
        pulseGlow:    { "0%,100%": { boxShadow: "0 0 20px rgba(226,27,112,0.2)" }, "50%": { boxShadow: "0 0 40px rgba(226,27,112,0.4)" } },
        spinSlow:     { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
      },
      boxShadow: {
        "glow-primary": "0 0 40px rgba(226,27,112,0.25)",
        "glow-sm":      "0 0 20px rgba(226,27,112,0.15)",
        "card":         "0 4px 24px rgba(0,0,0,0.4)",
        "card-light":   "0 2px 12px rgba(15,23,42,0.08)",
        "modal":        "0 20px 60px rgba(0,0,0,0.6)",
        "btn-primary":  "0 4px 16px rgba(226,27,112,0.30)",
      },
    },
  },
  plugins: [],
};
