#!/usr/bin/env bash
# Run the core golden replay test and write its hashes to a file.
# Usage: scripts/run-golden.sh OUT_FILE
# Contract with core/: the castle-core test whose name contains "golden" runs
# every recorded battle and, when CASTLE_GOLDEN_OUT is set, writes one line per
# battle to that file: "<replay name> <final hash>". The test also checks the
# hashes against the expected values checked in under core/.
# If the test writes nothing, OUT_FILE is left absent and the caller skips the
# cross-platform compare.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: run-golden.sh OUT_FILE}"
mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
rm -f "$OUT"

if [ ! -f "$ROOT/core/Cargo.toml" ]; then
  echo "No core/Cargo.toml yet, nothing to run."
  exit 0
fi

CASTLE_GOLDEN_OUT="$OUT" cargo test --manifest-path "$ROOT/core/Cargo.toml" \
  -p castle-core --release golden -- --nocapture

if [ -f "$OUT" ]; then
  LC_ALL=C sort -o "$OUT" "$OUT"
  echo "Golden hashes:"
  cat "$OUT"
else
  echo "The golden test did not write CASTLE_GOLDEN_OUT."
fi
