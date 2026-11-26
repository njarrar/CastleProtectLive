// One place to get a 2D context for the game's canvases.
//
// WebKit on Linux (WebKitGTK and WPE, which is also the WebKit that Playwright drives in CI)
// draws an accelerated 2D canvas with Skia on the GPU. In that WebKit the Skia GPU resource
// cache gets out of step when the canvas is busy (many sprites, layers and image swaps per
// frame) and the web process aborts in GrResourceCache (a RELEASE assert, on the main thread or
// a SkiaGPUWorker thread): the B2 long-fight crash in webkit-long, docs/review/code/webkit-long-crash.md.
// There the canvases ask for the CPU backend (willReadFrequently), so no canvas work goes
// through Skia's GPU cache. Safari on iPhone, iPad and Mac draws with Core Graphics, not Skia,
// and keeps its normal (accelerated) canvas, as do Chrome and Firefox.

const nav = typeof navigator !== 'undefined' ? navigator : undefined;

/** WebKit on Linux (Skia): not Safari, not Chrome (Android counts as Linux but runs Chrome). */
export const SKIA_WEBKIT = !!nav
  && /AppleWebKit/.test(nav.userAgent) && !/Chrome|Chromium|Edg\//.test(nav.userAgent)
  && /Linux/i.test(nav.platform ?? '') && !/Android/i.test(nav.userAgent);

/** A 2D context: CPU-backed on WebKit/Linux or when `read` is true, the browser's default elsewhere. */
export function ctx2d(c: HTMLCanvasElement, read = false): CanvasRenderingContext2D {
  return c.getContext('2d', SKIA_WEBKIT || read ? { willReadFrequently: true } : undefined)!;
}
