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
    .then((registration) => {
      // Buscar actualizaciones periódicamente y al volver a la pestaña
      const checkUpdate = () => registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkUpdate();
      });
      setInterval(checkUpdate, 60 * 60 * 1000);

      // Auto-actualización: promover el SW nuevo
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            registration.active?.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // Recargar cuando el nuevo SW tome control
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    })
    .catch((err) => console.warn("SW registration failed", err));
}

createRoot(document.getElementById("root")!).render(<App />);
