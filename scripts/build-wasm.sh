#!/usr/bin/env bash
# Build core/castle-wasm to WebAssembly and run wasm-bindgen on it.
# Usage: scripts/build-wasm.sh [--out DIR] [--target web|nodejs|bundler] [--dev]
# Env: WASM_CRATE (default castle-wasm), WASM_OUT_DIR (default core/castle-wasm/pkg,
#      where apps/web/vite.config.ts looks for it),
#      WASM_BINDGEN_VERSION (used only when core/Cargo.lock has no wasm-bindgen),
#      WASM_OPT=0 to skip wasm-opt.
# wasm-bindgen-cli must match the wasm-bindgen crate in Cargo.lock exactly,
# so the lock file wins over the pin below.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="$ROOT/core"
CRATE="${WASM_CRATE:-castle-wasm}"
OUT_DIR="${WASM_OUT_DIR:-$CORE/castle-wasm/pkg}"
BINDGEN_TARGET="web"
PROFILE="release"
PINNED_BINDGEN="0.2.130"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="$2"; shift 2 ;;
    --target) BINDGEN_TARGET="$2"; shift 2 ;;
    --dev) PROFILE="debug"; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$CORE/Cargo.toml" ]; then
  echo "No core/Cargo.toml yet, nothing to build."
  exit 0
fi

lock_version=""
if [ -f "$CORE/Cargo.lock" ]; then
  lock_version="$(awk '/^name = "wasm-bindgen"$/ {getline; gsub(/version = |"/, ""); print; exit}' "$CORE/Cargo.lock")"
fi
BINDGEN_VERSION="${lock_version:-${WASM_BINDGEN_VERSION:-$PINNED_BINDGEN}}"

have_version=""
if command -v wasm-bindgen >/dev/null 2>&1; then
  have_version="$(wasm-bindgen --version | awk '{print $2}')"
fi
if [ "$have_version" != "$BINDGEN_VERSION" ]; then
  echo "Installing wasm-bindgen-cli $BINDGEN_VERSION (found: ${have_version:-none})"
  cargo install wasm-bindgen-cli --version "$BINDGEN_VERSION" --locked --force
fi

rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

cargo_args=(build --manifest-path "$CORE/Cargo.toml" -p "$CRATE" --target wasm32-unknown-unknown)
if [ "$PROFILE" = "release" ]; then
  cargo_args+=(--release)
fi
cargo "${cargo_args[@]}"

TARGET_DIR="${CARGO_TARGET_DIR:-$CORE/target}"
WASM_FILE="$TARGET_DIR/wasm32-unknown-unknown/$PROFILE/${CRATE//-/_}.wasm"
if [ ! -f "$WASM_FILE" ]; then
  echo "Expected $WASM_FILE but it is missing. Is $CRATE a cdylib?" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
wasm-bindgen "$WASM_FILE" --out-dir "$OUT_DIR" --target "$BINDGEN_TARGET"

# Older wasm-opt (binaryen 108, the ubuntu-24.04 apt package) breaks the externref table that
# wasm-bindgen emits, and the core then fails to load in the browser. Skip it rather than ship that.
MIN_WASM_OPT=123
if [ "${WASM_OPT:-1}" != "0" ] && [ "$PROFILE" = "release" ] && command -v wasm-opt >/dev/null 2>&1; then
  opt_version="$(wasm-opt --version | grep -oE '[0-9]+' | head -1)"
  if [ "${opt_version:-0}" -lt "$MIN_WASM_OPT" ]; then
    echo "wasm-opt version ${opt_version:-unknown} is older than $MIN_WASM_OPT, skipping it." >&2
    WASM_OPT=0
  fi
fi
if [ "${WASM_OPT:-1}" != "0" ] && [ "$PROFILE" = "release" ] && command -v wasm-opt >/dev/null 2>&1; then
  for f in "$OUT_DIR"/*_bg.wasm; do
    if wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int \
         --enable-sign-ext --enable-mutable-globals --enable-reference-types \
         --enable-multivalue "$f" -o "$f.opt"; then
      mv "$f.opt" "$f"
    else
      echo "wasm-opt failed on $f, keeping the plain build." >&2
      rm -f "$f.opt"
    fi
  done
fi

echo "Wasm output in $OUT_DIR:"
ls -l "$OUT_DIR"
