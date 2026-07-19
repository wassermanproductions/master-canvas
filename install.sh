#!/usr/bin/env bash
# Master Canvas macOS installer
#
# Downloads the latest release and installs it to /Applications, bypassing
# the Gatekeeper "app is damaged" false alarm that macOS shows for
# browser-downloaded unsigned apps (terminal downloads aren't quarantined).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/wassermanproductions/master-canvas/main/install.sh | bash
set -euo pipefail

REPO="wassermanproductions/master-canvas"

if [ "$(uname -m)" != "arm64" ]; then
  echo "Master Canvas for macOS currently ships for Apple Silicon (M1–M4) only." >&2
  echo "On Intel Macs, build from source — see the README." >&2
  exit 1
fi

echo "Finding the latest Master Canvas release..."
URL="$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=20" \
  | grep -o 'https://[^"]*mac-arm64\.dmg' | head -1)"
if [ -z "$URL" ]; then
  echo "Could not find a macOS download — see https://github.com/$REPO/releases" >&2
  exit 1
fi

DEST="/Applications"
if [ ! -w "$DEST" ]; then
  DEST="$HOME/Applications"
  mkdir -p "$DEST"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Master Canvas..."
curl -fL --progress-bar "$URL" -o "$TMP/master-canvas.dmg"

echo "Installing to $DEST..."
MNT="$(hdiutil attach "$TMP/master-canvas.dmg" -nobrowse | awk -F'\t' '/\/Volumes\//{print $3; exit}')"
rm -rf "$DEST/Master Canvas.app"
ditto "$MNT/Master Canvas.app" "$DEST/Master Canvas.app"
hdiutil detach "$MNT" -quiet
xattr -cr "$DEST/Master Canvas.app" 2>/dev/null || true

echo "✓ Master Canvas installed — launching."
open "$DEST/Master Canvas.app"
