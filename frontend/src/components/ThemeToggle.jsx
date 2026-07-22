import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-xs ${
        isLight
          ? "bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
          : "bg-white/5 border-white/10 text-amber-400 hover:bg-white/10"
      } ${className}`}
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {isLight ? (
        <>
          <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" />
          <span className="text-xs font-semibold hidden sm:inline">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-semibold hidden sm:inline">Dark Mode</span>
        </>
      )}
    </button>
  );
}
