#!/usr/bin/env bash
# Build core/castle-ffi as .so files for Android with cargo-ndk.
# Usage: scripts/build-android-libs.sh [--dev]
# Needs ANDROID_NDK_HOME (or ANDROID_NDK_ROOT) pointing at NDK r27 or newer.
# Env: FFI_CRATE (default castle-ffi), JNI_LIBS_DIR (default
#      apps/android/app/src/main/jniLibs), ANDROID_API (default 26 = Android 8),
#      ANDROID_ABIS (default "arm64-v8a armeabi-v7a x86_64").
# Libraries are linked with 16 KB page alignment, which Google Play requires.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="$ROOT/core"
CRATE="${FFI_CRATE:-castle-ffi}"
OUT_DIR="${JNI_LIBS_DIR:-$ROOT/apps/android/app/src/main/jniLibs}"
API="${ANDROID_API:-26}"
ABIS="${ANDROID_ABIS:-arm64-v8a armeabi-v7a x86_64}"
CARGO_NDK_VERSION="4.1.2"
PROFILE_FLAG="--release"
PROFILE="release"

if [ "${1:-}" = "--dev" ]; then
  PROFILE_FLAG=""
  PROFILE="debug"
fi

if [ ! -f "$CORE/Cargo.toml" ]; then
  echo "No core/Cargo.toml yet, nothing to build."
  exit 0
fi

export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [ -z "$ANDROID_NDK_HOME" ] || [ ! -d "$ANDROID_NDK_HOME" ]; then
  echo "Set ANDROID_NDK_HOME to an NDK r27 or newer." >&2
  exit 1
fi

have_ndk=""
if command -v cargo-ndk >/dev/null 2>&1; then
  have_ndk="$(cargo ndk --version 2>/dev/null | awk '{print $2}')"
fi
if [ "$have_ndk" != "$CARGO_NDK_VERSION" ]; then
  echo "Installing cargo-ndk $CARGO_NDK_VERSION (found: ${have_ndk:-none})"
  cargo install cargo-ndk --version "$CARGO_NDK_VERSION" --locked --force
fi

targets=()
ndk_args=()
for abi in $ABIS; do
  case "$abi" in
    arm64-v8a) targets+=(aarch64-linux-android) ;;
    armeabi-v7a) targets+=(armv7-linux-androideabi) ;;
    x86_64) targets+=(x86_64-linux-android) ;;
    x86) targets+=(i686-linux-android) ;;
    *) echo "Unknown ABI $abi" >&2; exit 2 ;;
  esac
  ndk_args+=(-t "$abi")
done
rustup target add "${targets[@]}"

# 16 KB pages: NDK r28+ does this by default, the flag makes it explicit for r27.
export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=-Wl,-z,max-page-size=16384"

mkdir -p "$OUT_DIR"
# shellcheck disable=SC2086
cargo ndk "${ndk_args[@]}" -P "$API" -o "$OUT_DIR" \
  build --manifest-path "$CORE/Cargo.toml" -p "$CRATE" $PROFILE_FLAG

echo "Built $PROFILE libraries:"
find "$OUT_DIR" -name '*.so' -exec ls -l {} \;

# Check 16 KB alignment of each LOAD segment on 64-bit ABIs.
readelf_bin="$(find "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt" -name llvm-readelf -type f 2>/dev/null | head -n1 || true)"
if [ -n "$readelf_bin" ]; then
  bad=0
  for so in "$OUT_DIR"/arm64-v8a/*.so "$OUT_DIR"/x86_64/*.so; do
    [ -f "$so" ] || continue
    if "$readelf_bin" -lW "$so" | awk '$1=="LOAD" {print $NF}' | grep -qv '^0x4000$\|^0x10000$'; then
      echo "Not 16 KB aligned: $so" >&2
      bad=1
    fi
  done
  if [ "$bad" -ne 0 ]; then
    exit 1
  fi
  echo "16 KB page alignment OK."
fi
