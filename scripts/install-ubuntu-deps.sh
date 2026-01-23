#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not found. This script is for Ubuntu/Debian."
  exit 1
fi

echo "Installing Ubuntu/Debian system dependencies for Tauri (GTK/WebKitGTK/GLib/Cairo)..."

sudo apt-get update

sudo apt-get install -y \
  gcc g++ make pkg-config \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libglib2.0-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libgdk-pixbuf2.0-dev \
  libatk1.0-dev

echo
echo "Done. Now run:"
echo "  npm run tauri:dev"
echo "  or"
echo "  bash scripts/build-portable.sh"
