#!/bin/bash
# Copies the app icon and the launch logo from assets/ into the asset catalog.
# Run it after the art in assets/sprites changes. The sprites, atlases,
# manifest, content and fixtures are copied by the build itself (project.yml).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$HERE/../../assets/sprites"
CAT="$HERE/CastleProtect/Resources/Assets.xcassets"
cp "$ASSETS/app_icon-1024.png" "$CAT/AppIcon.appiconset/AppIcon.png"
cp "$ASSETS/app_icon-512.png" "$CAT/LaunchLogo.imageset/LaunchLogo.png"
echo "Icon and launch logo updated from assets/sprites."
