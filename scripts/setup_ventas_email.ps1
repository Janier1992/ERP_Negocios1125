<#!
.SYNOPSIS
Configura secretos, despliega la función Edge y aplica la migración para envío de correos de confirmación de ventas en Supabase.

.DESCRIPTION
Lee valores desde .env.secrets (si existe) o los solicita por consola. Enlaza el proyecto de Supabase, define secretos requeridos, despliega la función Edge send-sale-confirmation y aplica la migración supabase\migrations\20251106_200_setup_ventas_email_trigger.sql.
#>

param(
  [string]$ProjectRef,
  [string]$MigrationFile = "supabase\migrations\20251106_200_setup_ventas_email_trigger.sql",
  [string]$SupabaseUrl,
  [string]$SupabaseServiceRoleKey,
  [string]$ResendApiKey,
  [string]$MailFrom
)

function Exit-OnError($Message) {
  Write-Host "[ERROR] $Message" -ForegroundColor Red
  exit 1
}

function Ensure-SupabaseCLI {
  try {
    & supabase --version | Out-Null
  } catch {
    Exit-OnError "Supabase CLI no está disponible. Instálalo con: npm i -g supabase"
  }
}

function Get-ProjectRef {
  if ($ProjectRef) { return $ProjectRef }
  $configPath = "supabase\config.toml"
  if (-not (Test-Path $configPath)) { Exit-OnError "No se encontró $configPath. Define -ProjectRef manualmente." }
  $content = Get-Content $configPath
  foreach ($line in $content) {
    if ($line -match 'project_id\s*=\s*"(.*?)"') {
      return $Matches[1]
    }
  }
  Exit-OnError "No pude extraer project_id de $configPath. Define -ProjectRef manualmente."
}

function Load-EnvSecrets {
  $envFile = ".env.secrets"
  if (Test-Path $envFile) {
    Write-Host "Leyendo $envFile..." -ForegroundColor Cyan
    $lines = Get-Content $envFile
    foreach ($l in $lines) {
      if ($l -match '^\s*#') { continue }
      if ($l -match '^\s*$') { continue }
      $kv = $l -split '=', 2
      if ($kv.Length -eq 2) {
        $key = $kv[0].Trim()
        $val = $kv[1].Trim()
        switch ($key) {
          "SUPABASE_URL" { if (-not $SupabaseUrl) { $SupabaseUrl = $val } }
          "SUPABASE_SERVICE_ROLE_KEY" { if (-not $SupabaseServiceRoleKey) { $SupabaseServiceRoleKey = $val } }
          "RESEND_API_KEY" { if (-not $ResendApiKey) { $ResendApiKey = $val } }
          "MAIL_FROM" { if (-not $MailFrom) { $MailFrom = $val } }
        }
      }
    }
  }
}

function Prompt-ForMissing {
  if (-not $SupabaseUrl) {
    $SupabaseUrl = Read-Host "SUPABASE_URL (https://xxxxx.supabase.co)"
  }
  if (-not $SupabaseServiceRoleKey) {
    $secure = Read-Host "SUPABASE_SERVICE_ROLE_KEY" -AsSecureString
    $SupabaseServiceRoleKey = (New-Object System.Net.NetworkCredential("", $secure)).Password
  }
  if (-not $ResendApiKey) {
    $secure = Read-Host "RESEND_API_KEY" -AsSecureString
    $ResendApiKey = (New-Object System.Net.NetworkCredential("", $secure)).Password
  }
  if (-not $MailFrom) {
    $MailFrom = Read-Host "MAIL_FROM (no-reply@tu-dominio.com)"
  }
}

function Run-Command($cmd, $args) {
  Write-Host "→ $cmd $($args -join ' ')" -ForegroundColor DarkGray
  & $cmd @args
  if ($LASTEXITCODE -ne 0) {
    Exit-OnError "Fallo ejecutando: $cmd $($args -join ' ')"
  }
}

# main
Ensure-SupabaseCLI

$ref = Get-ProjectRef
Write-Host "Usando Project Ref: $ref" -ForegroundColor Green

Load-EnvSecrets
Prompt-ForMissing

# Login + link
Write-Host "Autenticando y enlazando proyecto..." -ForegroundColor Cyan
Run-Command "supabase" @("auth","login")
Run-Command "supabase" @("link","--project-ref",$ref)

# Set secrets
Write-Host "Definiendo secretos..." -ForegroundColor Cyan
Run-Command "supabase" @("secrets","set",
  "SUPABASE_URL=$SupabaseUrl",
  "SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey",
  "RESEND_API_KEY=$ResendApiKey",
  "MAIL_FROM=$MailFrom",
  "--project-ref",$ref
)

# Deploy function
$funcDir = "supabase\functions\send-sale-confirmation"
if (-not (Test-Path $funcDir)) {
  Exit-OnError "No se encontró $funcDir. Asegúrate de tener la función Edge en el repo."
}
Write-Host "Desplegando función Edge send-sale-confirmation..." -ForegroundColor Cyan
Run-Command "supabase" @("functions","deploy","send-sale-confirmation","--project-ref",$ref)

# Apply migration
if (-not (Test-Path $MigrationFile)) {
  Exit-OnError "No se encontró la migración: $MigrationFile"
}
Write-Host "Aplicando migración: $MigrationFile" -ForegroundColor Cyan
Run-Command "supabase" @("db","execute","--file",$MigrationFile,"--project-ref",$ref)

# Verify
Write-Host "Verificando funciones y secretos..." -ForegroundColor Cyan
Run-Command "supabase" @("functions","list","--project-ref",$ref)
Run-Command "supabase" @("secrets","list","--project-ref",$ref)

Write-Host "Listo. Registra una venta para probar el envío de correo." -ForegroundColor Green
Write-Host "Si algo falla, revisa permisos del proyecto y logs de la función." -ForegroundColor Yellow