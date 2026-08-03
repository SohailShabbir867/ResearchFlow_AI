import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          reactVendor: ["react", "react-dom", "react-router-dom"],
          reduxVendor: ["@reduxjs/toolkit", "react-redux"],
          icons: ["lucide-react"],
          syntaxHighlighter: ["react-syntax-highlighter"],
        }
      }
    }
  }
});
