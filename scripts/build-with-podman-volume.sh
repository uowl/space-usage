#!/usr/bin/env bash
# Build using Podman/Docker with volume mounts (faster, no copying)
# Usage: ./scripts/build-with-podman-volume.sh [linux|windows]

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
    BUILD_CMD="npm run tauri:build:linux"
    OUTPUT_DIR="src-tauri/target/release/bundle/appimage"
    ;;
  windows)
    echo "⚠️  WARNING: Windows containers require Windows host."
    echo "   For Linux hosts, use GitHub Actions (see README)."
    exit 1
    ;;
  *)
    echo "❌ Error: Unknown platform '$PLATFORM'"
    echo "   Use: linux"
    exit 1
    ;;
esac

# Build the container image (if not exists)
if ! $CONTAINER_CMD image exists "$IMAGE_NAME" 2>/dev/null; then
  echo "Building container image (this may take a while)..."
  $CONTAINER_CMD build -f "$DOCKERFILE" -t "$IMAGE_NAME" .
  echo ""
fi

# Run the build with volume mount
echo "Running build in container (using volume mount)..."
$CONTAINER_CMD run --rm \
  -v "$(pwd):/app" \
  -w /app \
  -e CARGO_HOME=/app/.cargo \
  -e RUSTUP_HOME=/app/.rustup \
  "$IMAGE_NAME" \
  bash -c "source \$HOME/.cargo/env && $BUILD_CMD"

echo ""
echo "✅ Build complete!"
echo "   Output: $OUTPUT_DIR"
if [[ "$PLATFORM" == "linux" ]]; then
  echo "   Make executable: chmod +x $OUTPUT_DIR/*.AppImage"
fi
