#!/bin/bash
# Xcode build phase: makes the CastleCoreFFI Swift module from the core's C
# header when Frameworks/CastleCore.xcframework is present, and links the
# static library. Without the XCFramework a Debug build writes nothing,
# `canImport` turns false, and the app builds with the stand-in core. A
# Release build fails instead: it must never ship the stand-in.
set -euo pipefail

OUT="${BUILT_PRODUCTS_DIR}/CastleCoreFFI"
XC="${SRCROOT}/Frameworks/CastleCore.xcframework"

missing() {
  rm -rf "$OUT"
  if [ "${CONFIGURATION:-Debug}" != "Debug" ]; then
    echo "error: $1 A ${CONFIGURATION} build needs the real core. Run scripts/build-xcframework.sh."
    exit 1
  fi
  echo "warning: $1 Building with the stand-in core (Debug only)."
  exit 0
}

if [ ! -d "$XC" ]; then
  missing "${XC} not found."
fi

if [ "${PLATFORM_NAME:-iphonesimulator}" = "iphonesimulator" ]; then
  SLICE="$(find "$XC" -mindepth 1 -maxdepth 1 -type d -name 'ios-*-simulator' | head -n1 || true)"
else
  SLICE="$(find "$XC" -mindepth 1 -maxdepth 1 -type d -name 'ios-*' ! -name '*-simulator' | head -n1 || true)"
fi
HEADER="$(find "${SLICE:-/nonexistent}" -name castle_core.h 2>/dev/null | head -n1 || true)"
LIB="$(find "${SLICE:-/nonexistent}" -maxdepth 1 -name 'lib*.a' 2>/dev/null | head -n1 || true)"
if [ -z "$HEADER" ] || [ -z "$LIB" ]; then
  missing "CastleCore.xcframework has no slice for ${PLATFORM_NAME:-?} with castle_core.h and a .a."
fi

mkdir -p "$OUT"
# Copy only when changed, so an unchanged core does not force a relink.
cmp -s "$HEADER" "$OUT/castle_core.h" || cp "$HEADER" "$OUT/castle_core.h"
cmp -s "$LIB" "$OUT/libcastle_ffi.a" || cp "$LIB" "$OUT/libcastle_ffi.a"
MAP_TEXT='module CastleCoreFFI {
  header "castle_core.h"
  link "castle_ffi"
  export *
}'
if [ ! -f "$OUT/module.modulemap" ] || [ "$(cat "$OUT/module.modulemap")" != "$MAP_TEXT" ]; then
  printf '%s\n' "$MAP_TEXT" > "$OUT/module.modulemap"
fi
echo "Linking the real core from ${SLICE}"
