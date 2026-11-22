#!/usr/bin/env bash
# Build core/castle-ffi as a static library for iOS device and simulator and
# wrap both in an XCFramework. macOS only (needs Xcode).
# Usage: scripts/build-xcframework.sh [--dev]
# Env: FFI_CRATE (default castle-ffi), XCFRAMEWORK_OUT (default
#      apps/ios/Frameworks/CastleCore.xcframework), FFI_MODULE (default
#      CastleCoreFFI, the Swift module name when no module.modulemap is given),
#      IPHONEOS_DEPLOYMENT_TARGET (default 16.0).
# Headers come from core/castle-ffi/include (castle_core.h). If that folder has
# no module.modulemap, one is generated so Swift can `import CastleCoreFFI`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="$ROOT/core"
CRATE="${FFI_CRATE:-castle-ffi}"
LIB="lib${CRATE//-/_}.a"
OUT="${XCFRAMEWORK_OUT:-$ROOT/apps/ios/Frameworks/CastleCore.xcframework}"
MODULE="${FFI_MODULE:-CastleCoreFFI}"
INCLUDE_DIR="$CORE/$CRATE/include"
export IPHONEOS_DEPLOYMENT_TARGET="${IPHONEOS_DEPLOYMENT_TARGET:-16.0}"
PROFILE="release"
PROFILE_FLAG="--release"

if [ "${1:-}" = "--dev" ]; then
  PROFILE="debug"
  PROFILE_FLAG=""
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "build-xcframework.sh needs macOS with Xcode." >&2
  exit 1
fi
if [ ! -f "$CORE/Cargo.toml" ]; then
  echo "No core/Cargo.toml yet, nothing to build."
  exit 0
fi
if [ ! -d "$INCLUDE_DIR" ]; then
  echo "Missing $INCLUDE_DIR (expected castle_core.h there)." >&2
  exit 1
fi

TARGETS=(aarch64-apple-ios aarch64-apple-ios-sim)
rustup target add "${TARGETS[@]}"

for t in "${TARGETS[@]}"; do
  # shellcheck disable=SC2086
  cargo build --manifest-path "$CORE/Cargo.toml" -p "$CRATE" --target "$t" $PROFILE_FLAG
done

TARGET_DIR="${CARGO_TARGET_DIR:-$CORE/target}"
STAGE="$TARGET_DIR/xcframework-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE/headers"
cp -R "$INCLUDE_DIR/." "$STAGE/headers/"
if [ ! -f "$STAGE/headers/module.modulemap" ]; then
  {
    echo "module $MODULE {"
    for h in "$STAGE"/headers/*.h; do
      echo "  header \"$(basename "$h")\""
    done
    echo "  export *"
    echo "}"
  } > "$STAGE/headers/module.modulemap"
fi

args=(-create-xcframework)
for t in "${TARGETS[@]}"; do
  lib_path="$TARGET_DIR/$t/$PROFILE/$LIB"
  if [ ! -f "$lib_path" ]; then
    echo "Missing $lib_path. Does $CRATE list staticlib in crate-type?" >&2
    exit 1
  fi
  args+=(-library "$lib_path" -headers "$STAGE/headers")
done

rm -rf "$OUT"
mkdir -p "$(dirname "$OUT")"
xcodebuild "${args[@]}" -output "$OUT"
echo "XCFramework at $OUT"
