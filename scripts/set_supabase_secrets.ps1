# Configura secretos necesarios para funciones Edge de Supabase
# Requiere: Supabase CLI autenticada y proyecto vinculado

param(
  [string]$SupabaseUrl,
  [string]$ServiceRoleKey,
  [string]$ResendApiKey,
  [string]$MailFrom,
  [string]$Env = "prod"
)

Write-Host "🔐 Configurando secretos para funciones Edge..." -ForegroundColor Green

# Verificar CLI
try { $supabaseVersion = supabase --version } catch {
  Write-Host "❌ Supabase CLI no está instalado." -ForegroundColor Red
  exit 1
}

# Obtener project ref
if (-not (Test-Path "supabase/config.toml")) {
  Write-Host "❌ No se encontró supabase/config.toml" -ForegroundColor Red
  exit 1
}
$projectRef = (Get-Content "supabase/config.toml" | Select-String -Pattern 'project_id\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value })
if (-not $projectRef) {
  Write-Host "❌ No se pudo leer project_id en supabase/config.toml" -ForegroundColor Red
  exit 1
}

# Intentar leer secretos desde .env.secrets si no se pasan por parámetro
if (Test-Path ".env.secrets") {
  $lines = Get-Content ".env.secrets"
  foreach ($line in $lines) {
    if (-not $SupabaseUrl -and ($line -match '^SUPABASE_URL=(.+)$')) { $SupabaseUrl = $Matches[1].Trim() }
    if (-not $ServiceRoleKey -and ($line -match '^SUPABASE_SERVICE_ROLE_KEY=(.+)$')) { $ServiceRoleKey = $Matches[1].Trim() }
    if (-not $ResendApiKey -and ($line -match '^RESEND_API_KEY=(.+)$')) { $ResendApiKey = $Matches[1].Trim() }
    if (-not $MailFrom -and ($line -match '^MAIL_FROM=(.+)$')) { $MailFrom = $Matches[1].Trim() }
  }
}

# Si aún faltan, pedirlos por prompt seguro
if (-not $SupabaseUrl) {
  $SupabaseUrl = Read-Host "Ingresa SUPABASE_URL (https://xxxx.supabase.co)"
}
if (-not $ServiceRoleKey) {
  $ServiceRoleKey = Read-Host "Ingresa SUPABASE_SERVICE_ROLE_KEY" -AsSecureString | ForEach-Object { [System.Net.NetworkCredential]::new("", $_).Password }
}

# Preguntar por secretos de correo si faltan
if (-not $ResendApiKey) {
  $ResendApiKey = Read-Host "Ingresa RESEND_API_KEY (si usarás Resend)"
}
if (-not $MailFrom) {
  $MailFrom = Read-Host "Ingresa MAIL_FROM (ej. no-reply@minogocioerp.com)"
}

if (-not $SupabaseUrl -or -not $ServiceRoleKey) {
  Write-Host "❌ Faltan valores de secretos básicos (SUPABASE_URL / SERVICE_ROLE_KEY)" -ForegroundColor Red
  exit 1
}

Write-Host "📦 Proyecto: $projectRef | Entorno: $Env" -ForegroundColor Cyan

# Establecer secretos a nivel de proyecto para funciones Edge
Write-Host "🧪 Listando secretos actuales..." -ForegroundColor Yellow
supabase secrets list --project-ref $projectRef --env $Env | Out-Host

Write-Host "🔧 Estableciendo secretos SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY..." -ForegroundColor Yellow
supabase secrets set SUPABASE_URL=$SupabaseUrl SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey --project-ref $projectRef --env $Env

# Establecer secretos de correo si existen
if ($ResendApiKey) {
  Write-Host "🔧 Estableciendo secreto RESEND_API_KEY..." -ForegroundColor Yellow
  supabase secrets set RESEND_API_KEY=$ResendApiKey --project-ref $projectRef --env $Env
}
if ($MailFrom) {
  Write-Host "🔧 Estableciendo secreto MAIL_FROM..." -ForegroundColor Yellow
  supabase secrets set MAIL_FROM=$MailFrom --project-ref $projectRef --env $Env
}

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Error al establecer secretos" -ForegroundColor Red
  exit 1
}

Write-Host "✅ Secretos configurados correctamente." -ForegroundColor Green
Write-Host "Sugerencia: ejecuta ahora scripts/deploy_edge_functions.ps1 para redeploy." -ForegroundColor Cyan