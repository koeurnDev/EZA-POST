// ============================================================
// 🌐 App.jsx — FINAL VERSION (EZA_POST Frontend)
// ============================================================
// Main entry point of the EZA_POST frontend.
// Initializes global contexts, applies theme handling, and 
// mounts all routes with strict mode for React 18+.
// ============================================================

import React from "react";
import AppRouter from "./router/AppRouter";
import PostComposer from "./pages/PostComposer";

// ✅ Global Context Providers
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// ✅ Global Styles (Tailwind or App.css)
import "./index.css"; // Ensure global styles or Tailwind are configured here

// ============================================================
// ✅ Main App Component
// ============================================================
export default function App() {
  return (
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
