import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ============================================================
// ⚙️ VITE CONFIG — FINAL PRODUCTION VERSION for EZA_POST
// ============================================================
// Includes React plugin, path aliases, CORS proxy to backend,
// optimized builds, and static asset settings.
// ============================================================

export default defineConfig({
  plugins: [react()],

  // 🌐 Dev Server Configuration
  server: {
    host: true,              // allow access via network (0.0.0.0)
    port: 5173,              // frontend port
    open: true,              // auto open in browser
    cors: true,              // allow cross-origin
    proxy: {
      "/api": {
        target: "http://localhost:5000", // backend server
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ⚙️ Build Configuration
  build: {
    outDir: "dist",          // output directory for build
    assetsDir: "assets",     // sub-folder for static assets
    minify: "esbuild",       // fast minification
    sourcemap: false,        // disable for production
    chunkSizeWarningLimit: 600, // prevents warnings for large chunks
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },

  // 🧭 Module Resolution
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // shortcut for imports
    },
  },

  // ⚡ Optimize Dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "axios", "react-router-dom"],
  },

  // 🌈 Preview Configuration (for production preview)
  preview: {
    port: 4173,
    strictPort: true,
    open: true,
  },
});
