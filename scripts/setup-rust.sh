#!/usr/bin/env bash
# Install the pinned Rust toolchain plus any extra targets.
# Usage: scripts/setup-rust.sh [target ...]
# The version comes from core/rust-toolchain.toml when that file exists,
# else from RUST_VERSION, else the pin below. Works in CI and locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PINNED="1.99.1"
TOOLCHAIN="${RUST_VERSION:-$PINNED}"

if [ -f "$ROOT/core/rust-toolchain.toml" ]; then
  from_file="$(sed -n 's/^[[:space:]]*channel[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/core/rust-toolchain.toml" | head -n1)"
  if [ -n "$from_file" ]; then
    TOOLCHAIN="$from_file"
  fi
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup not found. Install it from https://rustup.rs first." >&2
  exit 1
fi

args=(toolchain install "$TOOLCHAIN" --profile minimal --component rustfmt --component clippy --no-self-update)
if [ "$#" -gt 0 ]; then
  args+=(--target "$(IFS=,; echo "$*")")
fi
rustup "${args[@]}"
rustup default "$TOOLCHAIN"
rustc --version
cargo --version
