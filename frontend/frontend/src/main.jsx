// ============================================================
// ⚛️ index.jsx — React App Entry Point (Vite + React 18)
// ============================================================

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ✅ Mount React App safely
const rootElement = document.getElementById("root");

// 🧠 Guard (prevents duplicate mounting)
if (!rootElement) {
  console.error("❌ Root element not found in index.html");
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// 🧹 Optional: Hot Module Replacement (HMR)
if (import.meta.hot) {
  import.meta.hot.accept();
}
