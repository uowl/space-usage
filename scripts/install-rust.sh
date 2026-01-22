#!/usr/bin/env bash
set -euo pipefail

if command -v cargo >/dev/null 2>&1; then
  echo "cargo already installed: $(cargo --version)"
  exit 0
fi

echo "Installing Rust via rustup..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

echo
echo "Rust installed. In a new shell, verify with:"
echo "  cargo --version"

