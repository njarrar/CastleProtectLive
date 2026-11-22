#!/bin/bash
# Xcode build phase: makes the CastleCoreFFI Swift module from the core's C
# header when Frameworks/CastleCore.xcframework is present, and links the
# static library. Without the XCFramework it writes nothing, `canImport`
# turns false, and the app builds with the stand-in core.
set -euo pipefail

OUT="${BUILT_PRODUCTS_DIR}/CastleCoreFFI"
XC="${SRCROOT}/Frameworks/CastleCore.xcframework"
rm -rf "$OUT"

if [ ! -d "$XC" ]; then
  echo "note: ${XC} not found; building with the stand-in core."
  exit 0
fi

if [ "${PLATFORM_NAME:-iphonesimulator}" = "iphonesimulator" ]; then
  SLICE="$(find "$XC" -mindepth 1 -maxdepth 1 -type d -name 'ios-*-simulator' | head -n1 || true)"
else
  SLICE="$(find "$XC" -mindepth 1 -maxdepth 1 -type d -name 'ios-*' ! -name '*-simulator' | head -n1 || true)"
fi
HEADER="$(find "${SLICE:-/nonexistent}" -name castle_core.h 2>/dev/null | head -n1 || true)"
LIB="$(find "${SLICE:-/nonexistent}" -maxdepth 1 -name 'lib*.a' 2>/dev/null | head -n1 || true)"
if [ -z "$HEADER" ] || [ -z "$LIB" ]; then
  echo "warning: CastleCore.xcframework has no slice for ${PLATFORM_NAME:-?} with castle_core.h and a .a; using the stand-in core."
  exit 0
fi

mkdir -p "$OUT"
cp "$HEADER" "$OUT/castle_core.h"
cp "$LIB" "$OUT/libcastle_ffi.a"
cat > "$OUT/module.modulemap" <<MAP
module CastleCoreFFI {
  header "castle_core.h"
  link "castle_ffi"
  export *
}
MAP
echo "Linking the real core from ${SLICE}"
