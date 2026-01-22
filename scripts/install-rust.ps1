$ErrorActionPreference = "Stop"

if (Get-Command cargo -ErrorAction SilentlyContinue) {
  Write-Host "cargo already installed: $(cargo --version)"
  exit 0
}

Write-Host "Installing Rust via rustup..."
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
& "$env:TEMP\rustup-init.exe" -y

Write-Host ""
Write-Host "Rust installed. Open a new PowerShell and verify with:"
Write-Host "  cargo --version"

