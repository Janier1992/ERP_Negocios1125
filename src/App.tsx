import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Ventas from "./pages/Ventas";
import Proveedores from "./pages/Proveedores";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Alertas from "./pages/Alertas";
import Configuracion from "./pages/Configuracion";
import Clientes from "./pages/Clientes";
import Finanzas from "./pages/Finanzas";
import InvitacionesAceptar from "./pages/InvitacionesAceptar";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/invitaciones/aceptar" element={<InvitacionesAceptar />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/alertas" element={<Alertas />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/finanzas" element={<Finanzas />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
