@echo off
chcp 65001 >nul 2>&1
title EQDM_ProMax - Release Tool

cd /d "%~dp0"

echo.
echo ========================================
echo    EQDM_ProMax Release Tool
echo ========================================
echo.

:: Step 1: Build frontend
echo [1/3] Building frontend...
echo.
cd webapp-new
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Frontend built successfully
echo [3/3] Packaging...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_publish.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Packaging failed!
    pause
    exit /b 1
)

echo.
echo Next steps:
echo  1. Copy the .zip file to the public computer
echo  2. Extract and overwrite the old EQDM_ProMax folder
echo  3. Run start.bat on the public computer
echo.
pause
