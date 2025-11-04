# Troubleshooting: PGRST205 (Schema Cache)

Cuando el API devuelve errores como:

```
Error fetching profile: {code: PGRST205, message: "Could not find the table 'public.profiles' in the schema cache"}
```

significa que PostgREST aún no ha sincronizado el esquema (tablas/funciones recién creadas) o esas tablas no existen en el proyecto remoto.

## Cómo resolver

- Confirma que las migraciones han sido ejecutadas en el proyecto correcto.
  - Vía CLI: `supabase link --project-ref <project>` y `supabase db push`.
  - Vía Editor SQL: ejecuta los bloques necesarios (tablas y funciones).
- Fuerza la recarga del esquema:
  - En el Editor SQL ejecuta: `SELECT pg_notify('pgrst', 'reload schema');`
  - Espera unos segundos y vuelve a intentar.

## Cambios realizados en el código

- Se agregó la RPC `public.bootstrap_empresa_for_user` (SECURITY DEFINER) para crear empresa y vincular perfil/roles.
- Se creó la función Edge `bootstrap-empresa` como fallback cuando el cache impide usar la RPC.
- El hook `useUserProfile` gestiona PGRST205 sin bloquear la app y guía al usuario desde la pantalla de autenticación.
- La creación de empresa se realiza mediante RPC; si falla por cache, se usa la función Edge `bootstrap-empresa`.

## Consideraciones

- La función Edge requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` configurados.
- La app intenta primero la RPC y, si detecta PGRST205, usa el fallback por Edge.
- Verifica que `profiles` existe y el trigger `handle_new_user` está creado; de lo contrario, empuja las migraciones.