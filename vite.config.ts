import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import viteCompression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  // Nota: El navegador ignora 'frame-ancestors' cuando se entrega vía <meta>.
  // Para evitar advertencias en consola, omitimos 'frame-ancestors' de la meta CSP.
  // En producción, configúralo vía cabecera HTTP (por ejemplo, en el servidor web).
  const devCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co ws:; font-src 'self' data:; worker-src 'self'; base-uri 'self'; form-action 'self'";
  const prodCsp = "default-src 'self'; script-src 'self' https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co; font-src 'self' data:; worker-src 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

  const baseFromEnv = process.env.VITE_BASE;
  return ({
  // Base ajustable por entorno. En Vercel debe ser "/".
  base: baseFromEnv ?? "/",
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
    // Genera archivos comprimidos (.br y .gz) para servidores que soporten compresión estática
    viteCompression({
      verbose: false,
      disable: isDev,
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
    }),
    viteCompression({
      verbose: false,
      disable: isDev,
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssCodeSplit: true,
    sourcemap: false,
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
