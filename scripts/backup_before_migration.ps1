Param(
  [string]$OutputDir = "backups",
  [string]$Tag = "pre_finanzas_v1_0_0"
)

Write-Host "== Backup previo a migración =="

# Verifica supabase CLI
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $cli) {
  Write-Error "Supabase CLI no encontrado. Instalar: https://supabase.com/docs/guides/cli"
  exit 1
}

# Crear directorio de salida
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path "$root\.." | Select-Object -ExpandProperty Path
$backupDir = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

# Archivo de backup con timestamp
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir ("${Tag}_" + $ts + ".sql")

Write-Host "Creando backup en $backupFile"

# Ejecuta dump de la base local
# Nota: requiere tener configurado el proyecto con supabase CLI (`supabase init`) y servicio corriendo (`supabase start`)
supabase db dump -f $backupFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Fallo al crear backup"
  exit $LASTEXITCODE
}

Write-Host "Backup completado: $backupFile"