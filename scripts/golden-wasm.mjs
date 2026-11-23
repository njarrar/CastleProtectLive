// Run the core golden replays in WebAssembly under Node and print the hashes.
// Usage: node scripts/golden-wasm.mjs PKG_DIR OUT_FILE
// PKG_DIR is wasm-bindgen output built with `--target nodejs`.
// Contract with core/: castle-wasm exports golden_hashes(), which runs the
// embedded golden replays and returns the same "<name> <hash>" lines that the
// native golden test writes. If the export is missing, this prints a notice
// and writes nothing.
import { createRequire } from "node:module";
import { writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const [pkgDir, outFile] = process.argv.slice(2);
if (!pkgDir || !outFile) {
  console.error("usage: node scripts/golden-wasm.mjs PKG_DIR OUT_FILE");
  process.exit(2);
}

const entry = readdirSync(pkgDir).find((f) => f.endsWith(".js") && !f.endsWith("_bg.js"));
if (!entry) {
  console.error(`No wasm-bindgen JS entry in ${pkgDir}`);
  process.exit(1);
}
const require = createRequire(import.meta.url);
const mod = require(resolve(join(pkgDir, entry)));

if (typeof mod.golden_hashes !== "function") {
  console.error("::error::castle-wasm has no golden_hashes() export.");
  process.exit(1);
}

const lines = String(mod.golden_hashes())
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .sort();
writeFileSync(outFile, lines.join("\n") + "\n");
console.log(lines.join("\n"));
