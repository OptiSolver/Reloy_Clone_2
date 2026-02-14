# Script de recuperacion del proyecto LOOP
# Limpia dependencias y reinstala todo

Write-Host "Limpiando node_modules y caches..." -ForegroundColor Cyan

# Funcion para borrar directorios
function Remove-Dir($path) {
    if (Test-Path $path) {
        Write-Host "   Eliminando $path..."
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Remove-Dir "node_modules"
Remove-Dir "pnpm-lock.yaml"
Remove-Dir "apps/web/node_modules"
Remove-Dir "apps/web/.next"
Remove-Dir "packages/core/node_modules"
Remove-Dir "packages/core/dist"
Remove-Dir "packages/db/node_modules"

Write-Host "Instalando dependencias con pnpm..." -ForegroundColor Cyan
pnpm install --no-frozen-lockfile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en pnpm install" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Green
Set-Location apps/web
pnpm dev
