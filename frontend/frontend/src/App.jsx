// ============================================================
// 🌐 App.jsx — FINAL VERSION (EZA_POST Frontend)
// ============================================================
// Main entry point of the EZA_POST frontend.
// Initializes global contexts, applies theme handling, and 
// mounts all routes with strict mode for React 18+.
// ============================================================

import React from "react";
import AppRouter from "./router/AppRouter";

import { Toaster } from "react-hot-toast"; // ✅ Toast Notifications

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
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <Toaster
          position="top-right"
          reverseOrder={false}
          containerStyle={{
            top: 16,
            right: 16,
          }}
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '600',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              maxWidth: '420px',
            },
            // Success
            success: {
              duration: 3000,
              style: {
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
              },
              iconTheme: {
                primary: '#ffffff',
                secondary: '#10b981',
              },
            },
            // Error
            error: {
              duration: 5000,
              style: {
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: 'none',
              },
              iconTheme: {
                primary: '#ffffff',
                secondary: '#ef4444',
              },
            },
            // Loading
            loading: {
              style: {
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
              },
              iconTheme: {
                primary: '#ffffff',
                secondary: '#3b82f6',
              },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
