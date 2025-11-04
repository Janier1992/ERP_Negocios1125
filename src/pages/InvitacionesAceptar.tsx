import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { toast } from "sonner";

export default function InvitacionesAceptar() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) return;
    if (isAuthenticated === true && status === "idle") {
      void acceptInvitation();
    }
  }, [isAuthenticated, token]);

  const acceptInvitation = async () => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Token no proporcionado");
      return;
    }
    setStatus("loading");
    try {
      const { data, error } = await supabase.rpc("accept_empleado_invitation", { _token: token });
      if (error) throw error;
      if (String(data) !== "ok") {
        throw new Error("Respuesta inesperada del servidor");
      }
      toast.success("Invitación aceptada. ¡Bienvenido!");
      setStatus("success");
      setTimeout(() => navigate("/configuracion"), 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "No se pudo aceptar la invitación");
      setStatus("error");
    }
  };

  const goToLogin = () => {
    const redirect = encodeURIComponent(`/invitaciones/aceptar?token=${token}`);
    navigate(`/auth?redirect=${redirect}`);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitación</CardTitle>
            <CardDescription>Falta el token de la invitación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Verifica el enlace que recibiste o solicita una nueva invitación.</div>
            <Button onClick={() => navigate("/")}>Ir al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceptar invitación</CardTitle>
          <CardDescription>
            {isAuthenticated ? "Se procesará tu invitación para unirte a la empresa" : "Necesitas iniciar sesión para aceptar la invitación"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para continuar, inicia sesión con tu cuenta. Te redirigiremos de vuelta aquí automáticamente.
              </p>
              <Button onClick={goToLogin}>Iniciar sesión</Button>
            </div>
          ) : status === "loading" || status === "idle" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando invitación...
            </div>
          ) : status === "success" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>¡Listo! Te uniste a la empresa.</span>
              </div>
              <Button onClick={() => navigate("/configuracion")}>Ir al panel</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>{errorMsg || "No se pudo aceptar la invitación"}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void acceptInvitation()}>Reintentar</Button>
                <Button onClick={() => navigate("/auth")}>Ir a inicio de sesión</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}