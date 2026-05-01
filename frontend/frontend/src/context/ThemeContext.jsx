// ============================================================
// 🎨 ThemeContext.jsx — Enhanced Dark/Light Theme Manager
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// ✅ Create Context
// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext({
  theme: "dark",
  toggleTheme: () => { },
  setTheme: () => { },
});

export const ThemeProvider = ({ children }) => {
  const getInitialTheme = useCallback(() => {
    // 🧠 Safe check (for SSR)
    if (typeof window === "undefined") return "light";

    const stored = localStorage.getItem("theme");
    if (stored) return stored;

    // 🌙 Match system preference (Default to dark if no preference)
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  }, []);

  const [theme, setTheme] = useState(getInitialTheme);

  // ------------------------------------------------------------
  // ✅ Apply theme to <html> and persist in localStorage
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    // Remove both to reset
    root.classList.remove("light", "dark");
    root.classList.add(theme);

    localStorage.setItem("theme", theme);
  }, [theme]);

  // ------------------------------------------------------------
  // ✅ Sync theme changes across multiple browser tabs
  // ------------------------------------------------------------
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "theme" && e.newValue) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ------------------------------------------------------------
  // ✅ Toggle Theme
  // ------------------------------------------------------------
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // ------------------------------------------------------------
  // ✅ Context Value
  // ------------------------------------------------------------
  const value = { theme, toggleTheme, setTheme };

  // ------------------------------------------------------------
  // ✅ Render Provider
  // ------------------------------------------------------------
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// ✅ Custom Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
