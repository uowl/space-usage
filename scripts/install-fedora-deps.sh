#!/usr/bin/env bash
set -euo pipefail

if ! command -v dnf >/dev/null 2>&1; then
  echo "dnf not found. This script is for Fedora."
  exit 1
fi

echo "Installing Fedora system dependencies for Tauri (GTK/WebKitGTK/GLib/Cairo)..."

sudo dnf install -y \
  gcc gcc-c++ make pkgconf-pkg-config \
  gtk3-devel webkit2gtk4.1-devel \
  glib2-devel cairo-devel pango-devel gdk-pixbuf2-devel atk-devel \
  libsoup3-devel javascriptcoregtk4.1-devel \
  openssl-devel

echo
echo "Done. Now run:"
echo "  npm run tauri:dev"

