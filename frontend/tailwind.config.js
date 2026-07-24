/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand colors — warm brown (buttons)
        primary: { DEFAULT: "#8E4E14", dark: "#5C3009", hover: "#7A4210", deep: "#3D1F08", light: "#A05A18" },
        accent:  { DEFAULT: "#A05A18", dark: "#7A4210" },

        // Semantic backgrounds (dark defaults, overridden by CSS vars in light mode)
        page:    "#212121",
        sidebar: "#171717",

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
        "gradient-primary": "linear-gradient(135deg, #8E4E14, #5C3009)",
        "gradient-dark":    "linear-gradient(135deg, #171717, #212121)",
        "gradient-card":    "linear-gradient(135deg, rgba(142,78,20,0.08), rgba(92,48,9,0.04))",
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
        pulseGlow:    { "0%,100%": { boxShadow: "0 0 20px rgba(142,78,20,0.2)" }, "50%": { boxShadow: "0 0 40px rgba(142,78,20,0.4)" } },
        spinSlow:     { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
      },
      boxShadow: {
        "glow-primary": "0 0 40px rgba(142,78,20,0.25)",
        "glow-sm":      "0 0 20px rgba(142,78,20,0.15)",
        "card":         "0 4px 24px rgba(0,0,0,0.4)",
        "card-light":   "0 2px 12px rgba(15,23,42,0.08)",
        "modal":        "0 20px 60px rgba(0,0,0,0.6)",
        "btn-primary":  "0 4px 16px rgba(142,78,20,0.30)",
      },
    },
  },
  plugins: [],
};
