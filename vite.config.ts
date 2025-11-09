import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const devCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co ws:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
  const prodCsp = "default-src 'self'; script-src 'self' https://*.supabase.co; style-src 'self'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

  return ({
  // Para despliegue en GitHub Pages (proyecto MiNegocio-ERP)
  // En producción, asegura rutas correctas: janier1992.github.io/MiNegocio-ERP/
  base: mode === "production" ? "/MiNegocio-ERP/" : "/",
  server: {
    host: true,
    port: 8080,
    strictPort: false,
  },
  plugins: [
    react(),
    {
      name: "inject-csp-meta",
      transformIndexHtml() {
        const content = isDev ? devCsp : prodCsp;
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content,
            },
            injectTo: "head",
          },
        ];
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase/supabase-js")) return "supabase";
            if (id.includes("react") || id.includes("react-dom")) return "react";
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("lucide-react")) return "icons";
          }
          return null;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    css: true,
  },
  });
});
