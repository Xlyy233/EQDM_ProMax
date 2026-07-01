# EQDM_ProMax - Smart Publisher
# Auto-detects project root, skips webapp-new/node_modules, recursively packages directories

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir.TrimEnd('\')

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   EQDM_ProMax Publisher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $projectRoot" -ForegroundColor Gray

$dateStamp = Get-Date -Format "yyyyMMdd"
$zipName = "EQDM_ProMax_$dateStamp.zip"
$zipPath = Join-Path $projectRoot $zipName

Write-Host "Output:  $zipPath" -ForegroundColor Gray
Write-Host ""

# Build flat list of all files to include (recursive for directories)
$includeFiles = @()
$skipFolders = @('node_modules', '.git', 'data', 'uploads', 'logs')
$skipExtensions = @('.zip', '.log')

function Add-FolderContents($folderPath, $basePath) {
    Get-ChildItem -Path $folderPath -Force | ForEach-Object {
        if ($skipFolders -contains $_.Name) {
            return
        }
        if ($skipExtensions -contains $_.Extension.ToLower()) {
            return
        }
        if ($_.PSIsContainer) {
            Add-FolderContents $_.FullName $basePath
        } else {
            $relPath = $_.FullName.Substring($basePath.Length + 1)
            $script:includeFiles += @{ FullPath = $_.FullName; RelativePath = $relPath }
        }
    }
}

Get-ChildItem -Path $projectRoot -Force | ForEach-Object {
    if ($_.Name -eq 'webapp-new') {
        Write-Host "  [webapp-new/]" -ForegroundColor Cyan
        Get-ChildItem -Path $_.FullName -Force | ForEach-Object {
            if ($_.Name -ne 'node_modules') {
                if ($_.PSIsContainer) {
                    Write-Host "    [+] $($_.Name)/" -ForegroundColor Green
                    Add-FolderContents $_.FullName $projectRoot
                } else {
                    Write-Host "    [+] $($_.Name)" -ForegroundColor Green
                    $script:includeFiles += @{ FullPath = $_.FullName; RelativePath = $_.Name }
                }
            } else {
                Write-Host "    [---] $($_.Name)/  (skipped - not needed in prod)" -ForegroundColor Yellow
            }
        }
    } else {
        if ($skipExtensions -contains $_.Extension.ToLower()) {
            return
        }
        if ($_.PSIsContainer) {
            if ($skipFolders -contains $_.Name) {
                Write-Host "  [---] $($_.Name)/  (skipped)" -ForegroundColor Yellow
            } else {
                Write-Host "  [+]  $($_.Name)/" -ForegroundColor Green
                Add-FolderContents $_.FullName $projectRoot
            }
        } else {
            Write-Host "  [+]  $($_.Name)" -ForegroundColor Green
            $script:includeFiles += @{ FullPath = $_.FullName; RelativePath = $_.Name }
        }
    }
}

if ($includeFiles.Count -eq 0) {
    Write-Host "[ERROR] Nothing to package!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Packaging $($includeFiles.Count) files..." -ForegroundColor Cyan

# Create zip
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

try {
    $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    $archive = [System.IO.Compression.ZipFile]::Open($zipPath, 'create')

    foreach ($file in $includeFiles) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullPath, $file.RelativePath, $compressionLevel) | Out-Null
    }

    $archive.Dispose()

    $size = (Get-Item $zipPath).Length
    $sizeMB = [math]::Round($size / 1MB, 1)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   Done! Package created successfully" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  File: $zipName"
    Write-Host "  Size: $sizeMB MB"
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
