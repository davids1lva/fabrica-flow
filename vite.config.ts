import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const demo = loadEnv(mode, process.cwd(), "").VITE_PUBLIC_DEMO === "true";
  return {
    base: demo ? "/fabrica-flow/" : "/",
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      proxy: { "/api": "http://127.0.0.1:3001" },
    },
    build: { outDir: demo ? "docs" : "dist" },
  };
});
