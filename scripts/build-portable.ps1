# Build portable executable for Windows
# Run from PowerShell in the project root

Set-Location $PSScriptRoot\..

Write-Host "Building Windows portable .exe..." -ForegroundColor Cyan

npm run tauri:build:windows

Write-Host ""
Write-Host "✅ Built: src-tauri\target\release\bundle\portable\Space Usage.exe" -ForegroundColor Green
Write-Host "   Run directly - no installation needed!" -ForegroundColor Yellow
