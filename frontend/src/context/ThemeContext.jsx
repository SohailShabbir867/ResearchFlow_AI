import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Default to "light" — the new warm brown / beige palette
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("medresearch_theme");
    return saved ? saved : "light";
  });

  useEffect(() => {
    localStorage.setItem("medresearch_theme", theme);
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark-mode", "dark");
      root.classList.remove("light-mode", "light");
    } else {
      root.classList.add("light-mode", "light");
      root.classList.remove("dark-mode", "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: "light", toggleTheme: () => {} };
  }
  return context;
}
