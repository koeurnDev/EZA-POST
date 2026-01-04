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
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
          <Toaster
            position="top-center"
            reverseOrder={false}
            containerStyle={{
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            toastOptions={{
              // Default options
              duration: 4000,
              style: {
                background: 'var(--card-bg)',
                color: 'var(--text)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)',
                maxWidth: '500px',
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
    </React.StrictMode>
  );
}
