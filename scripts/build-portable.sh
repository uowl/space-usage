#!/bin/bash
# Build portable executable for the current platform

set -e

cd "$(dirname "$0")/.."

echo "Building portable executable for $(uname -s)..."

case "$(uname -s)" in
  Linux*)
    echo "Building Linux AppImage..."
    npm run tauri:build:linux
    echo ""
    echo "✅ Built: src-tauri/target/release/bundle/appimage/space-usage-app_*.AppImage"
    echo "   Make it executable: chmod +x src-tauri/target/release/bundle/appimage/*.AppImage"
    ;;
  Darwin*)
    echo "Building macOS .app bundle..."
    npm run tauri:build:macos
    echo ""
    echo "✅ Built: src-tauri/target/release/bundle/macos/Space Usage.app"
    echo "   Drag to Applications folder or run directly"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "Building Windows portable .exe..."
    npm run tauri:build:windows
    echo ""
    echo "✅ Built: src-tauri/target/release/bundle/portable/Space Usage.exe"
    ;;
  *)
    echo "Unknown platform: $(uname -s)"
    echo "Falling back to default build..."
    npm run tauri:build:portable
    ;;
esac
