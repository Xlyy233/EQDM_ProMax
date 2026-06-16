@echo off
chcp 65001 >nul
title Equipment Management System - Service Start

rem ============================================================
rem  This batch file calls start.ps1 through PowerShell
rem  It does not rely on complex path detection here
rem  If it fails, PAUSE so the user can see the error
rem ============================================================

cd /d "%~dp0"

echo.
echo [1] Starting Equipment Management System...
echo [2] Looking for PowerShell...

where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell not found on this system
    echo Please ask your IT department to install PowerShell
    pause
    exit /b 1
)

echo [3] Running start.ps1...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

set LAST_ERROR=%errorlevel%
if %LAST_ERROR% neq 0 (
    echo.
    echo [ERROR] Script failed with error code %LAST_ERROR%
    echo Please send this window screenshot to the developer
    echo.
) else (
    echo.
    echo [DONE] Server process ended
)

pause
