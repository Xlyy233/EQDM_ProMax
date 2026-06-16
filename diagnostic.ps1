# ============================================================================
#  DIAGNOSTIC TOOL - Run this to figure out why the system won't start
#  Usage: Right-click -> "Run with PowerShell"
# ============================================================================

$ErrorActionPreference = 'Continue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   EQDM_ProMax DIAGNOSTIC TOOL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "[*] Project folder  : $ScriptDir"

# --- Check backend exists ---
$Backend = Join-Path $ScriptDir 'backend'
if (Test-Path $Backend) { Write-Host "[OK] backend folder exists" -ForegroundColor Green }
else { Write-Host "[X] backend folder MISSING" -ForegroundColor Red }

$IndexJs = Join-Path $Backend 'index.js'
if (Test-Path $IndexJs) { Write-Host "[OK] backend/index.js exists" -ForegroundColor Green }
else { Write-Host "[X] backend/index.js MISSING" -ForegroundColor Red }

$PackageJson = Join-Path $Backend 'package.json'
if (Test-Path $PackageJson) { Write-Host "[OK] backend/package.json exists" -ForegroundColor Green }
else { Write-Host "[X] backend/package.json MISSING" -ForegroundColor Red }

# --- Check webapp-new ---
$Webapp = Join-Path $ScriptDir 'webapp-new\dist'
if (Test-Path $Webapp) { Write-Host "[OK] webapp-new/dist exists (frontend built)" -ForegroundColor Green }
else { Write-Host "[X] webapp-new/dist MISSING (frontend not built)" -ForegroundColor Red }

# --- Check node_modules ---
$NodeModules = Join-Path $Backend 'node_modules'
if (Test-Path $NodeModules) { Write-Host "[OK] backend/node_modules exists (deps installed)" -ForegroundColor Green }
else { Write-Host "[!] backend/node_modules NOT FOUND (first run will install)" -ForegroundColor Yellow }

# --- Scan for node.exe everywhere in this project tree ---
Write-Host ""
Write-Host "[*] Scanning for node.exe in and around this folder..." -ForegroundColor Cyan

$SearchRoots = @(
    $ScriptDir,                             # project root
    (Split-Path -Parent $ScriptDir)         # one level up
)
$FoundNodes = @()
foreach ($root in $SearchRoots) {
    if (Test-Path $root) {
        try {
            Get-ChildItem -Path $root -Filter 'node.exe' -Recurse -Depth 3 -ErrorAction SilentlyContinue | ForEach-Object {
                $FoundNodes += $_.FullName
            }
        } catch { }
    }
}
# also check node_modules/.bin for nvm-style installs
$global:exec = $null
try {
    $sysNode = Get-Command node -ErrorAction Stop
    $FoundNodes += $sysNode.Source
    Write-Host "[OK] System node: $($sysNode.Source)" -ForegroundColor Green
} catch {
    Write-Host "[!] 'node' is NOT in system PATH" -ForegroundColor Yellow
}

if ($FoundNodes.Count -eq 0) {
    Write-Host ""
    Write-Host "[X] No node.exe found anywhere. You MUST install Node.js first." -ForegroundColor Red
    Write-Host "    Download from: https://nodejs.org/"
} else {
    Write-Host ""
    Write-Host "    Found the following node.exe:"
    $FoundNodes | ForEach-Object { Write-Host "     - $_" -ForegroundColor Green }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Press any key to close this window..." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
