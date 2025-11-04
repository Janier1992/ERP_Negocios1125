import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/newClient";
import { validateEmail, validatePassword, adminCreateUser } from "@/services/users";
import { resendSignupConfirmationWithRetry } from "@/services/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectParam = params.get("redirect");
  const redirectPath = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(redirectPath);
      }
    };
    checkUser();
  }, [navigate, redirectPath]);

  useEffect(() => {
    // Detectar flujo de recuperación desde el enlace de correo
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setIsLogin(true);
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const type = params.get("type");
    if (type === "recovery") {
      setRecoveryMode(true);
      setIsLogin(true);
    }
  }, [location.search]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("confirm") || msg.includes("not confirmed")) {
            toast.error("Debes confirmar tu correo antes de iniciar sesión");
            setPendingConfirmation(true);
            return;
          }
          throw error;
        }

        toast.success("Inicio de sesión exitoso");
        navigate(redirectPath);
      } else {
        // Registro: crear cuenta y empresa en un solo paso usando función Edge
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedPassword = password.trim();
        const trimmedFullName = fullName.trim();
        const trimmedBusinessName = businessName.trim();

        if (!trimmedBusinessName || trimmedBusinessName.length < 2) {
          throw new Error("El nombre del negocio es obligatorio y debe tener al menos 2 caracteres");
        }
        if (!trimmedFullName || trimmedFullName.length < 2) {
          throw new Error("El nombre completo es obligatorio y debe tener al menos 2 caracteres");
        }
        if (!validateEmail(trimmedEmail)) {
          throw new Error("Correo inválido");
        }
        if (!validatePassword(trimmedPassword)) {
          throw new Error("La contraseña debe tener mínimo 8 caracteres y 1 número");
        }

        try {
          const res = await adminCreateUser(
            trimmedEmail,
            trimmedPassword,
            trimmedFullName || null,
            ["admin"],
            null,
            trimmedBusinessName || null,
          );
          if (res?.ok) {
            // Iniciar sesión inmediatamente y navegar. Activamos estado de hidratación post‑creación.
            const { error: loginErr } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
            if (loginErr) throw loginErr;
            toast.success("Cuenta y empresa creadas. Sesión iniciada");
            navigate(redirectPath, { state: { hydratingEmpresa: true, postCreate: true } });
            return;
          }
        } catch (bootErr: any) {
          const emsg = String(bootErr?.message || bootErr?.error || "").toLowerCase();
          const isEdgeDown = emsg.includes("err_failed") || emsg.includes("failed to fetch") || emsg.includes("fetch") || emsg.includes("network");
          if (isEdgeDown) {
            toast.info("No se pudo conectar con la función de registro (Edge). Usaremos el registro estándar.");
          }
          // Fallback a signUp estándar si la función no está disponible
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
            options: {
              emailRedirectTo: `${SITE_URL}/auth`,
              data: {
                full_name: trimmedFullName,
                business_name: trimmedBusinessName,
              },
            },
          });
          if (error) throw error;
          if (data?.session) {
            // Si la sesión está activa, intentar crear empresa vía RPC/Edge
            try {
              const svc = await import("@/services/company");
              try {
                await svc.bootstrapEmpresaRpc({ nombre: trimmedBusinessName, descripcion: null });
              } catch (e: any) {
                const msg = String(e?.message || "").toLowerCase();
                const isSchemaCache = msg.includes("schema cache") || (e?.code === "PGRST205");
                if (isSchemaCache) {
                  await svc.bootstrapEmpresaEdge({ nombre: trimmedBusinessName, descripcion: null });
                } else {
                  throw e;
                }
              }
              toast.success("Cuenta y empresa creadas");
              navigate(redirectPath, { state: { hydratingEmpresa: true, postCreate: true } });
            } catch (e: any) {
              toast.success("Cuenta creada exitosamente");
              navigate(redirectPath);
            }
          } else {
            // Enviar confirmación con reintentos para mejorar confiabilidad
            const resend = await resendSignupConfirmationWithRetry(trimmedEmail, 3, 600);
            if (resend.ok) {
              toast.success("Registro iniciado. Hemos reenviado el correo de confirmación.");
            } else {
              const low = String(resend.error || "").toLowerCase();
              if (/redirect.*(invalid|not allowed|accepted)/i.test(low)) {
                toast.error("Dominio de redirección no permitido. Añade http://localhost:8080 en Authentication → URL Configuration → Additional Redirect URLs.");
              } else if (/smtp|provider|unauthorized|forbidden/i.test(low)) {
                toast.error("Servicio de correo no configurado o sin permisos en Supabase. Revisa SMTP/Proveedor en Authentication → Email.");
              } else {
                toast.info("Registro iniciado. Revisa tu correo para confirmar la cuenta (puede tardar unos minutos).");
              }
            }
            setIsLogin(true);
            setPendingConfirmation(true);
          }
        }
      }
    } catch (error: any) {
      const msg = String(error?.message || "");
      const low = msg.toLowerCase();
      if (low.includes("database error saving new user")) {
        // Intentar flujo de bootstrap vía función admin-create-user
        try {
          const res = await adminCreateUser(
            email.trim().toLowerCase(),
            password.trim(),
            fullName.trim() || null,
            ["admin"],
            null,
            businessName.trim() || null,
          );
          if (res?.ok) {
            // Iniciar sesión inmediatamente
            const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: password.trim() });
            if (loginErr) throw loginErr;
            toast.success("Cuenta creada exitosamente (bootstrap) y sesión iniciada");
            navigate(redirectPath);
            return;
          }
        } catch (bootErr: any) {
          const bmsg = String(bootErr?.message || bootErr?.error || "");
          toast.error(
            bmsg ||
              "No se pudo crear la cuenta. Verifica que el correo no exista y que el dominio de redirección esté permitido en Supabase (añade http://localhost:8080 en Authentication → URL Configuration).",
          );
        }
      } else if (/redirect.*(invalid|not allowed|accepted)/i.test(msg)) {
        toast.error("Dominio de redirección no permitido en Supabase. Añade http://localhost:8080 en Authentication → URL Configuration → Additional Redirect URLs.");
      } else if (/already|exist/i.test(low)) {
        toast.error("El correo ya está registrado. Prueba con otro correo o inicia sesión.");
      } else if (/network|failed to fetch|err_failed/i.test(low)) {
        toast.error("No se pudo conectar al servicio de autenticación. Revisa tu conexión o intenta nuevamente.");
      } else {
        toast.error(msg || "Ocurrió un error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error("Ingresa tu correo para reenviar la confirmación");
      return;
    }
    setResendLoading(true);
    try {
      const resend = await resendSignupConfirmationWithRetry(email, 3, 600);
      if (resend.ok) {
        toast.success("Correo de confirmación reenviado");
      } else {
        const msg = String(resend.error || "");
        const friendly = /redirect.*(invalid|not allowed|accepted)/i.test(msg)
          ? "Dominio de redirección no permitido. Añade http://localhost:8080 en Authentication → URL Configuration."
          : /smtp|provider|unauthorized|forbidden/i.test(msg)
          ? "Servicio de correo no configurado o sin permisos en Supabase. Revisa SMTP/Proveedor en Authentication → Email."
          : msg || "No se pudo reenviar el correo";
        toast.error(friendly);
      }
    } catch (err: any) {
      toast.error(err.message || "No se pudo reenviar el correo");
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetRequest = async () => {
    if (!validateEmail(email)) {
      toast.error("Ingresa un correo válido para recuperar contraseña");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?redirect=${redirectPath}`,
      });
      if (error) throw error;
      toast.success("Te enviamos un enlace para recuperar tu contraseña");
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /redirect.*invalid/i.test(msg)
        ? "URL de redirección no permitida. Añade http://localhost:8080 en Authentication → URL Configuration."
        : msg || "No se pudo iniciar la recuperación";
      toast.error(friendly);
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!validatePassword(newPassword)) {
      toast.error("La nueva contraseña debe tener mínimo 8 caracteres y 1 número");
      return;
    }
    if (newPassword !== newPassword2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Contraseña actualizada. Ahora puedes iniciar sesión");
      setRecoveryMode(false);
      setIsLogin(true);
      setNewPassword("");
      setNewPassword2("");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar la contraseña");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? "Ingresa tus credenciales para acceder al sistema"
              : "Completa el formulario para crear tu cuenta"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Nombre del negocio</Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Ej. Ferretería La Esquina"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || (!isLogin && (!validateEmail(email) || !validatePassword(password)))}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                isLogin ? "Iniciar Sesión" : "Crear Cuenta"
              )}
            </Button>
          </form>

          {isLogin && !recoveryMode && (
            <div className="mt-3 text-center text-sm">
              <button
                type="button"
                onClick={handleResetRequest}
                className="text-primary hover:underline"
                disabled={resetLoading || !validateEmail(email || "")}
                title={!email ? "Ingresa tu correo arriba para recuperar" : "Enviar enlace de recuperación"}
              >
                {resetLoading ? "Enviando enlace…" : "¿Olvidaste tu contraseña? Recuperar"}
              </button>
            </div>
          )}

          {recoveryMode && (
            <div className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                />
              </div>
              <div className="space-y-2 mt-2">
                <Label htmlFor="newPassword2">Confirmar contraseña</Label>
                <Input
                  id="newPassword2"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  minLength={8}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={handleUpdatePassword} disabled={resetLoading} className="flex-1">
                  {resetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Actualizando…
                    </>
                  ) : (
                    "Actualizar contraseña"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setRecoveryMode(false)} disabled={resetLoading}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {pendingConfirmation && (
            <div className="mt-4 text-center text-sm">
              <p className="text-muted-foreground">
                Debes confirmar tu correo para acceder. Si no lo recibiste, puedes reenviarlo.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleResend}
                disabled={resendLoading || !email}
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Reenviar correo de confirmación"
                )}
              </Button>
            </div>
          )}
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin 
                ? "¿No tienes cuenta? Regístrate" 
                : "¿Ya tienes cuenta? Inicia sesión"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}