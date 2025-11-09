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

createRoot(document.getElementById("root")!).render(<App />);
