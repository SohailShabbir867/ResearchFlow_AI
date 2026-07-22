import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Load saved theme or default to "dark"
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("medresearch_theme");
    return saved ? saved : "dark";
  });

  useEffect(() => {
    localStorage.setItem("medresearch_theme", theme);
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-mode");
      root.classList.remove("dark-mode");
    } else {
      root.classList.add("dark-mode");
      root.classList.remove("light-mode");
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
    // Fallback if rendered outside ThemeProvider
    return { theme: "dark", toggleTheme: () => {} };
  }
  return context;
}
