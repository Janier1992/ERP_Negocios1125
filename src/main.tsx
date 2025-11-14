import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redirección en producción al BASE_URL para evitar pantalla en blanco
if (import.meta.env.PROD) {
  const base = import.meta.env.BASE_URL || "/";
  const path = window.location.pathname;
  if (base !== "/" && !path.startsWith(base)) {
    window.location.replace(base);
  }
}

// Registro de Service Worker para PWA (sólo producción)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const swUrl = new URL("sw.js", import.meta.env.BASE_URL).toString();
  navigator.serviceWorker
    .register(swUrl)
    .catch((err) => console.warn("SW registration failed", err));
}

createRoot(document.getElementById("root")!).render(<App />);
