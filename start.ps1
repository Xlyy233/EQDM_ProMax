# ============================================================================
#  EQDM ProMax - Server Startup
# ============================================================================
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'EQDM ProMax Server'

# --- Resolve paths ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir 'backend'

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Equipment Management System - Service Startup" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Script : $ScriptDir" -ForegroundColor Gray
Write-Host "   Backend: $BackendDir" -ForegroundColor Gray

if (-not (Test-Path $BackendDir)) {
    Write-Host "   [ERROR] Backend folder not found: $BackendDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Find Node.js ---
Write-Host ""
Write-Host ">> Looking for Node.js..." -ForegroundColor Cyan

$NodeExe = $null
$candidates = @(
    (Join-Path $ScriptDir 'runtime\nodejs\node.exe'),
    (Join-Path (Split-Path -Parent $ScriptDir) 'runtime\nodejs\node.exe'),
    (Join-Path $ScriptDir 'nodejs\node.exe'),
    (Join-Path $ScriptDir '6月\nodejs\node.exe'),
    (Join-Path (Split-Path -Parent $ScriptDir) '6月\nodejs\node.exe'),
    (Join-Path $ScriptDir '6 yue\nodejs\node.exe'),
    (Join-Path (Split-Path -Parent $ScriptDir) '6 yue\nodejs\node.exe')
)

foreach ($c in $candidates) {
    if (Test-Path $c) {
        $NodeExe = $c
        Write-Host "   [OK] Portable: $c" -ForegroundColor Green
        break
    }
}

if (-not $NodeExe) {
    try {
        $NodeExe = (Get-Command node -ErrorAction Stop).Source
        Write-Host "   [OK] System: $NodeExe" -ForegroundColor Green
    } catch {
        Write-Host "   [ERROR] Node.js not found!" -ForegroundColor Red
        Write-Host "   Please put node.exe in: $ScriptDir\runtime\nodejs\" -ForegroundColor Gray
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Add Node.js dir to PATH
$NodeDir = Split-Path $NodeExe
$env:PATH = "$NodeDir;$env:PATH"

# Verify Node.js works
$null = & $NodeExe --version 2>&1
Write-Host "   [OK] Node.js verified" -ForegroundColor Green

# --- Install dependencies if needed ---
Write-Host ""
Write-Host ">> Checking dependencies..." -ForegroundColor Cyan
$NodeModules = Join-Path $BackendDir 'node_modules'

if (-not (Test-Path $NodeModules)) {
    Write-Host "   Installing dependencies, please wait..." -ForegroundColor Yellow
    $npm = Join-Path $NodeDir 'npm'
    if (-not (Test-Path "$npm.cmd")) { $npm = "$npm.cmd" }
    $installLog = & $NodeExe $npm install --production 2>&1
    if (Test-Path $NodeModules) {
        Write-Host "   [OK] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] npm install failed" -ForegroundColor Red
        Write-Host "   $installLog" -ForegroundColor Gray
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "   [OK] Dependencies ready" -ForegroundColor Green
}

# --- Get LAN IP ---
Write-Host ""
Write-Host ">> Network info..." -ForegroundColor Cyan
$LocalIP = ''

# 过滤虚拟网卡，优先取真实物理网卡（不放在 try/catch 里，PS 5.1 解析会出错）
$virtualPatterns = @('Loopback', 'vEthernet', 'VirtualBox', 'VMware', 'VPN', 'Bluetooth', 'Teredo', 'Tunnel', 'Pseudo', 'Hyper-V')
$adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $ip = $_.IPAddress
        $alias = $_.InterfaceAlias
        if ($ip -like '169.254.*' -or $ip -like '127.*') { return $false }
        foreach ($pat in $virtualPatterns) {
            if ($alias -match $pat) { return $false }
        }
        return $true
    } |
    Sort-Object InterfaceMetric

if ($adapters) {
    $LocalIP = $adapters[0].IPAddress
    Write-Host "   [OK] LAN IP: $LocalIP ($($adapters[0].InterfaceAlias))" -ForegroundColor Green
    if ($adapters.Count -gt 1) {
        for ($i = 1; $i -lt $adapters.Count; $i++) {
            Write-Host "        Also: $($adapters[$i].IPAddress) ($($adapters[$i].InterfaceAlias))" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   [!]  No LAN IP detected" -ForegroundColor Yellow
}

# --- Start the server ---
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Open your browser and visit:"
Write-Host ""
Write-Host "   This PC : http://localhost:3000" -ForegroundColor Green
if ($LocalIP) {
    Write-Host "   LAN     : http://${LocalIP}:3000" -ForegroundColor Green
}
Write-Host ""
Write-Host "   Close this window to STOP the server" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Use .NET Process class directly (more reliable than Start-Process cmdlet)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $NodeExe
$psi.Arguments = 'index.js'
$psi.WorkingDirectory = $BackendDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

try {
    $process = [System.Diagnostics.Process]::Start($psi)
    
    if (-not $process -or -not $process.Id) {
        Write-Host "   [ERROR] Failed to start server" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "   [Server started] PID: $($process.Id)" -ForegroundColor Green
    Write-Host "   [Press Enter to stop the server]" -ForegroundColor Gray
    Write-Host ""
    
    Read-Host
    
    Write-Host ""
    Write-Host "   Stopping server..." -ForegroundColor Yellow
    $process.Kill()
    $process.WaitForExit(5000) | Out-Null
    Write-Host "   [Server stopped]" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($process -and -not $process.HasExited) {
        $process.Kill()
    }
    if ($process) { $process.Dispose() }
}

Write-Host ""
Write-Host "Press Enter to close this window..." -ForegroundColor Gray
Read-Host