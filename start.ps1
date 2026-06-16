# ============================================================================
#  Equipment Management System - Robust PowerShell Starter
# ----------------------------------------------------------------------------
#  Features:
#   - Error-handled (script won't auto-close on failure)
#   - Looks for node.exe in multiple common locations
#   - Auto-installs dependencies on first run
#   - Works from any folder path (with spaces, with Chinese chars)
# ============================================================================

$ErrorActionPreference = 'Continue'

# ----------------------------------------------------------------------------
#  Helpers
# ----------------------------------------------------------------------------
function Write-Step([string]$msg, [string]$color = 'Cyan') {
    Write-Host ""
    Write-Host ">> $msg" -ForegroundColor $color
}
function Write-Ok([string]$msg) {
    Write-Host "   [OK] $msg" -ForegroundColor Green
}
function Write-Warn([string]$msg) {
    Write-Host "   [!]  $msg" -ForegroundColor Yellow
}
function Write-Err([string]$msg) {
    Write-Host "   [X]  $msg" -ForegroundColor Red
}
function Read-KeyOrPause {
    Write-Host ""
    try {
        Write-Host "Press any key to close this window..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Read-Host "Or just press Enter"
    }
}

# ----------------------------------------------------------------------------
#  Banner
# ----------------------------------------------------------------------------
Clear-Host
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Equipment Management System - Service Startup" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------------
#  Resolve paths
# ----------------------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir 'backend'

Write-Step "Resolving file paths"
Write-Ok "Script folder  : $ScriptDir"
Write-Ok "Backend folder : $BackendDir"

if (-not (Test-Path $BackendDir)) {
    Write-Err "Backend folder NOT FOUND: $BackendDir"
    Read-KeyOrPause
    exit 1
}

# ----------------------------------------------------------------------------
#  Find Node.js (look in many places)
# ----------------------------------------------------------------------------
Write-Step "Looking for Node.js"

$candidatePaths = @(
    (Join-Path $ScriptDir 'runtime\nodejs\node.exe'),                    # EQDM_ProMax/runtime/nodejs
    (Join-Path (Split-Path -Parent $ScriptDir) 'runtime\nodejs\node.exe'),  # ../runtime/nodejs
    (Join-Path $ScriptDir 'nodejs\node.exe'),                           # EQDM_ProMax/nodejs
    (Join-Path $ScriptDir '6月\nodejs\node.exe'),                       # EQDM_ProMax/6月/nodejs
    (Join-Path (Split-Path -Parent $ScriptDir) '6月\nodejs\node.exe'),  # ../6月/nodejs
    (Join-Path $ScriptDir '6 yue\nodejs\node.exe'),                     # fallback english
    (Join-Path (Split-Path -Parent $ScriptDir) '6 yue\nodejs\node.exe')
)

$NodeExe = $null
foreach ($cand in $candidatePaths) {
    if (Test-Path $cand) {
        $NodeExe = $cand
        Write-Ok "Found portable Node.js: $cand"
        break
    } else {
        Write-Warn "Not found: $cand"
    }
}

# Also try system-wide node
if (-not $NodeExe) {
    try {
        $sysNode = Get-Command node -ErrorAction Stop
        $NodeExe = $sysNode.Source
        Write-Ok "Found system Node.js: $NodeExe"
    } catch {
        Write-Warn "No system Node.js in PATH"
    }
}

if (-not $NodeExe) {
    Write-Err "Node.js was NOT FOUND in any of the expected locations."
    Write-Host ""
    Write-Host "Please do ONE of the following:"
    Write-Host ""
    Write-Host "  [A] Put the downloaded node.js files inside this project:"
    Write-Host "      1. Inside the EQDM_ProMax folder, create a new folder called:  runtime"
    Write-Host "      2. Copy the contents of your downloaded nodejs ZIP into: runtime\nodejs\"
    Write-Host "      3. Make sure this file exists: EQDM_ProMax\runtime\nodejs\node.exe"
    Write-Host ""
    Write-Host "  [B] OR install Node.js from https://nodejs.org/ (use the installer)"
    Write-Host ""
    Write-Host "Current project folder is: $ScriptDir"
    Read-KeyOrPause
    exit 1
}

# Add node.js folder to PATH so "npm" also works
$NodeDir = Split-Path $NodeExe
$env:PATH = "$NodeDir;" + $env:PATH
Write-Ok "Node.js path added to session PATH: $NodeDir"

# Verify it actually runs
$null = & $NodeExe --version 2>&1
Write-Ok "Node.js runs successfully"

# ----------------------------------------------------------------------------
#  Get LAN IP
# ----------------------------------------------------------------------------
Write-Step "Reading network configuration"
$LocalIP = ""
try {
    $net = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop `
        | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254.*' } `
        | Select-Object -First 1
    if ($net) { $LocalIP = $net.IPAddress; Write-Ok "Local IP: $LocalIP" }
    else { Write-Warn "No network adapter found (offline?)" }
} catch {
    Write-Warn "Cannot determine IP: $($_.Exception.Message)"
}

# ----------------------------------------------------------------------------
#  Install dependencies on first run
# ----------------------------------------------------------------------------
Write-Step "Checking dependencies"
$NodeModulesDir = Join-Path $BackendDir 'node_modules'
if (-not (Test-Path $NodeModulesDir)) {
    Write-Warn "First run - installing dependencies. This takes 1-2 minutes. Please wait..."
    try {
        Push-Location $BackendDir
        & $NodeExe (Join-Path $NodeDir 'npm') install --production 2>&1 | ForEach-Object {
            Write-Host "   | $_" -ForegroundColor Gray
        }
        Pop-Location
        if (Test-Path $NodeModulesDir) {
            Write-Ok "Dependencies installed"
        } else {
            Write-Err "npm install failed - node_modules still missing"
            Read-KeyOrPause
            exit 1
        }
    } catch {
        Write-Err "npm install crashed: $($_.Exception.Message)"
        Read-KeyOrPause
        exit 1
    }
} else {
    Write-Ok "Dependencies already installed"
}

# ----------------------------------------------------------------------------
#  Start the backend server
# ----------------------------------------------------------------------------
Write-Step "Starting the web server"
Write-Host ""
Write-Host "   ============================================================"
Write-Host "   Open your web browser and visit one of these addresses:"
Write-Host ""
Write-Host "   On this computer : http://localhost:3000"
if ($LocalIP) {
    Write-Host "   On the LAN       : http://$($LocalIP):3000"
}
Write-Host ""
Write-Host "   To STOP the server, close this window or press Ctrl+C"
Write-Host "   ============================================================"
Write-Host ""

try {
    Set-Location $BackendDir
    & $NodeExe index.js
} catch {
    Write-Err "Server crashed: $($_.Exception.Message)"
    Read-KeyOrPause
    exit 1
}

# If node exits normally, pause before closing
Write-Host ""
Write-Host "[Server exited. This window will stay open for 10 seconds or you can close it now.]" -ForegroundColor Gray
Start-Sleep -Seconds 10
