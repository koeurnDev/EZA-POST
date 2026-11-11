import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ============================================================
// 🛡️ Build Guard: EZA-POST Production Security Guard
// ============================================================
// Ensures development JSX runtime never ships to production,
// and blocks accidental leakage of server-only secrets in bundles.
function forbidDevReactRuntime() {
  const DEV_MARKERS = ["jsxDEV", "react-dom.development"];
  const SERVER_ONLY_MARKERS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "FB_APP_SECRET",
    "TELEGRAM_BOT_TOKEN",
  ];
  return {
    name: "ezapost:forbid-dev-react-runtime",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const offenders = [];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (fileName.endsWith(".map")) continue;
        const source = output.type === "chunk" ? output.code : (typeof output.source === "string" ? output.source : "");
        for (const marker of SERVER_ONLY_MARKERS) {
          if (source.includes(marker)) {
            offenders.push(`${fileName} (server-only marker: ${marker})`);
            break;
          }
        }
        if (output.type !== "chunk") continue;
        for (const marker of DEV_MARKERS) {
          if (source.includes(marker)) {
            offenders.push(`${fileName} (${marker})`);
            break;
          }
        }
      }
      if (offenders.length) {
        this.error(
          "Production bundle check failed: " +
            `${offenders.slice(0, 5).join(", ")}${offenders.length > 5 ? ` (+${offenders.length - 5} more)` : ""}.\n` +
            "Refusing to emit release bundle with development runtime or server secrets."
        );
      }
    },
  };
}

// ============================================================
// ⚙️ VITE CONFIG — HIGH-PERFORMANCE EZA-POST PRODUCTION SETUP
// ============================================================
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (command === "build") {
    process.env.NODE_ENV = "production";
  }

  return {
    plugins: [react(), forbidDevReactRuntime()],

    // 🌐 Dev Server Configuration with Proxy
    server: {
      host: true,
      port: 5173,
      open: true,
      cors: true,
      proxy: {
        "/api/v1": {
          target: "https://eza-post-api.koeurnseab630.workers.dev",
          changeOrigin: true,
          secure: true,
        },
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // ⚙️ High-Speed Mobile & Responsive Chunking Strategy (EZA-POST Spec)
    build: {
      outDir: "dist",
      assetsDir: "assets",
      minify: "esbuild",
      sourcemap: false,
      chunkSizeWarningLimit: 350,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks: (id) => {
            const norm = id.replace(/\\/g, "/");
            if (!norm.includes("node_modules")) return undefined;

            // Core vendor bundles
            if (/node_modules\/(react|react-dom|scheduler)\//.test(norm)) return "react-core";
            if (/node_modules\/react-router(-dom)?\//.test(norm)) return "react-router";
            if (/node_modules\/axios\//.test(norm)) return "network";

            // framer-motion and lucide-react are intentionally unbucketed
            // so tree-shaking keeps only used components per route.
            return undefined;
          },
        },
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },

    optimizeDeps: {
      include: ["react", "react-dom", "axios", "react-router-dom"],
    },

    preview: {
      port: 4173,
      strictPort: true,
      open: true,
    },
  };
});
