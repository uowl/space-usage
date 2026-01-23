#!/usr/bin/env bash
# Build using Podman (or Docker) container
# Usage: ./scripts/build-with-podman.sh [linux|windows]

set -e

cd "$(dirname "$0")/.."

PLATFORM="${1:-linux}"

# Detect if podman or docker is available
if command -v podman >/dev/null 2>&1; then
  CONTAINER_CMD="podman"
elif command -v docker >/dev/null 2>&1; then
  CONTAINER_CMD="docker"
else
  echo "❌ Error: Neither podman nor docker found. Please install one of them."
  exit 1
fi

echo "Using: $CONTAINER_CMD"
echo "Building for: $PLATFORM"
echo ""

case "$PLATFORM" in
  linux)
    DOCKERFILE="Dockerfile.linux"
    IMAGE_NAME="space-usage-builder:linux"
    OUTPUT_DIR="src-tauri/target/release/bundle/appimage"
    ;;
  windows)
    DOCKERFILE="Dockerfile.windows"
    IMAGE_NAME="space-usage-builder:windows"
    OUTPUT_DIR="src-tauri/target/release/bundle/portable"
    
    # Check if we're on a Windows host (required for Windows containers)
    if [[ "$(uname -s)" != "MINGW"* ]] && [[ "$(uname -s)" != "MSYS"* ]]; then
      echo "⚠️  WARNING: Building Windows containers on Linux requires special setup."
      echo "   Windows containers typically only work on Windows hosts."
      echo "   Consider using GitHub Actions instead (see README)."
      echo ""
      read -p "Continue anyway? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
    ;;
  *)
    echo "❌ Error: Unknown platform '$PLATFORM'"
    echo "   Use: linux or windows"
    exit 1
    ;;
esac

# Build the container image
echo "Building container image..."
$CONTAINER_CMD build -f "$DOCKERFILE" -t "$IMAGE_NAME" .

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run the build in the container and copy output
echo ""
echo "Running build in container..."
CONTAINER_ID=$($CONTAINER_CMD create "$IMAGE_NAME")

# Copy built files from container
echo "Copying built files..."
$CONTAINER_CMD cp "$CONTAINER_ID:/app/$OUTPUT_DIR/." "$OUTPUT_DIR/"

# Clean up
$CONTAINER_CMD rm "$CONTAINER_ID"

echo ""
echo "✅ Build complete!"
echo "   Output: $OUTPUT_DIR"
if [[ "$PLATFORM" == "linux" ]]; then
  echo "   Make executable: chmod +x $OUTPUT_DIR/*.AppImage"
fi
