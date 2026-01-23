#!/usr/bin/env bash
# Attempt to cross-compile Windows executable from Linux
# NOTE: This may not work due to Tauri's Windows-specific requirements
# Recommended: Build on Windows or use CI/CD (GitHub Actions)

set -e

cd "$(dirname "$0")/.."

echo "⚠️  WARNING: Cross-compiling Windows .exe from Linux is not officially supported by Tauri."
echo "   This script attempts it, but may fail due to missing Windows toolchains."
echo "   Recommended alternatives:"
echo "   1. Build on Windows directly"
echo "   2. Use GitHub Actions CI/CD"
echo "   3. Use a Windows VM"
echo ""
read -p "Continue anyway? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# Install mingw-w64 cross-compiler
if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  echo "Installing mingw-w64 cross-compiler..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y mingw-w64
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y mingw64-gcc
  else
    echo "Please install mingw-w64 manually for your distribution"
    exit 1
  fi
fi

# Add Windows target
echo "Adding Windows target to Rust..."
rustup target add x86_64-pc-windows-gnu

# Create cargo config for cross-compilation
mkdir -p .cargo
cat > .cargo/config.toml <<EOF
[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"
EOF

echo ""
echo "Attempting to build Windows executable..."
echo "⚠️  This will likely fail due to Tauri's Windows WebView2 requirements."
echo ""

# Try to build (this will likely fail)
npm run tauri:build:windows || {
  echo ""
  echo "❌ Build failed. Cross-compilation from Linux to Windows is not supported."
  echo ""
  echo "Recommended solutions:"
  echo "1. Build on Windows: Use the build-portable.ps1 script on a Windows machine"
  echo "2. Use GitHub Actions: Set up CI/CD to build Windows binaries automatically"
  echo "3. Use a Windows VM: Run the build in a virtualized Windows environment"
  exit 1
}

echo ""
echo "✅ If build succeeded, find the executable at:"
echo "   src-tauri/target/x86_64-pc-windows-gnu/release/"
