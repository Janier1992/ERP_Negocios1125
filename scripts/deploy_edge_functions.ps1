# Script para desplegar funciones Edge de Supabase
# Requiere: Supabase CLI instalado y configurado

Write-Host "🚀 Desplegando funciones Edge de Supabase..." -ForegroundColor Green

# Verificar que Supabase CLI esté instalado
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI encontrado: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Supabase CLI no está instalado." -ForegroundColor Red
    Write-Host "Instala Supabase CLI desde: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "supabase/functions")) {
    Write-Host "❌ Error: No se encontró el directorio supabase/functions" -ForegroundColor Red
    Write-Host "Asegúrate de ejecutar este script desde la raíz del proyecto" -ForegroundColor Yellow
    exit 1
}

# Verificar configuración de Supabase
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "❌ Error: No se encontró supabase/config.toml" -ForegroundColor Red
    Write-Host "Ejecuta 'supabase init' primero" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Funciones encontradas:" -ForegroundColor Cyan
Get-ChildItem "supabase/functions" -Directory | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}

# Leer project ref
$projectRef = (Get-Content "supabase/config.toml" | Select-String -Pattern 'project_id\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value })
Write-Host "\n📦 Proyecto: $projectRef" -ForegroundColor Cyan

# Verificar secretos requeridos
Write-Host "🔎 Verificando secretos de funciones (prod)..." -ForegroundColor Yellow
$secretsList = supabase secrets list --project-ref $projectRef --env prod
if (-not ($secretsList -match 'SUPABASE_SERVICE_ROLE_KEY') -or -not ($secretsList -match 'SUPABASE_URL')) {
    Write-Host "⚠️  Faltan secretos SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Yellow
    Write-Host "Ejecuta: pwsh .\\scripts\\set_supabase_secrets.ps1" -ForegroundColor Yellow
}

# Desplegar todas las funciones
Write-Host "`n🔄 Desplegando funciones..." -ForegroundColor Yellow

try {
    # Desplegar admin-create-user
    Write-Host "Desplegando admin-create-user..." -ForegroundColor Cyan
    supabase functions deploy admin-create-user
    
    # Desplegar bootstrap-empresa
    Write-Host "Desplegando bootstrap-empresa..." -ForegroundColor Cyan
    supabase functions deploy bootstrap-empresa
    
    # Desplegar send-invitation
    Write-Host "Desplegando send-invitation..." -ForegroundColor Cyan
    supabase functions deploy send-invitation
    
    Write-Host "`n✅ Todas las funciones desplegadas exitosamente!" -ForegroundColor Green
    
    # Mostrar información de las funciones
    Write-Host "`n📊 Estado de las funciones:" -ForegroundColor Cyan
    supabase functions list
    
} catch {
    Write-Host "❌ Error durante el despliegue: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n🔧 Pasos para solucionar:" -ForegroundColor Yellow
    Write-Host "1. Verifica que estés autenticado: supabase auth login" -ForegroundColor White
    Write-Host "2. Verifica la configuración del proyecto: supabase projects list" -ForegroundColor White
    Write-Host "3. Asegúrate de que el proyecto esté vinculado: supabase link --project-ref TU_PROJECT_REF" -ForegroundColor White
    exit 1
}

Write-Host "`n🎉 Despliegue completado!" -ForegroundColor Green
Write-Host "Las funciones Edge ahora están disponibles en tu proyecto de Supabase." -ForegroundColor White
Write-Host "`nPuedes probar el registro de usuarios en la aplicación." -ForegroundColor Cyan