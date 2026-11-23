package games.castleprotect.battle

import android.content.ComponentCallbacks2
import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * A least recently used map bounded by a cost (bytes for bitmaps). Pure, so it is unit
 * tested. Not thread safe: the caller locks.
 */
class CostLru<K, V>(var budget: Long, private val cost: (V) -> Long) {
    private val map = LinkedHashMap<K, V>(64, 0.75f, true)
    var total = 0L
        private set
    val size: Int get() = map.size

    operator fun get(k: K): V? = map[k]
    fun containsKey(k: K) = map.containsKey(k)

    /** Puts [v] and drops the oldest entries over the budget. Returns how many were dropped. */
    fun put(k: K, v: V): Int {
        map.put(k, v)?.let { total -= cost(it) }
        total += cost(v)
        var dropped = 0
        val it = map.entries.iterator()
        while (total > budget && map.size > 1 && it.hasNext()) {
            val e = it.next()
            if (e.key == k) continue
            total -= cost(e.value); it.remove(); dropped++
        }
        return dropped
    }

    fun removeIf(test: (K, V) -> Boolean): Int {
        var n = 0
        val it = map.entries.iterator()
        while (it.hasNext()) { val e = it.next(); if (test(e.key, e.value)) { total -= cost(e.value); it.remove(); n++ } }
        return n
    }

    fun clear() { map.clear(); total = 0 }
}

/** One overlay sprite composited on top of an aliased/deduplicated base frame (--v2 atlas). */
data class SpriteOverlay(
    val sprite: String,
    /** Offset in @1x px relative to the base sprite's anchor. */
    val dx: Float,
    val dy: Float,
    /** Rotation in degrees around the overlay's own anchor. */
    val rot: Float = 0f,
    /** Scale multiplier relative to the base sprite draw scale. */
    val scale: Float = 1f,
)

/** One packed frame inside an atlas page (pixel coordinates in the page bitmap). */
class AtlasFrame(
    val page: String,
    val x: Int,
    val y: Int,
    val w: Int,
    val h: Int,
    /** Scale factor of this frame's trim/sourceSize coordinates (1 for oversampled @1x chars in --v2 @2x, else page scale). */
    val frameScale: Float,
    /** Optional alpha-trimmed bbox [tx, ty, tw, th] within [sourceW, sourceH] (in [frameScale] px). */
    val trim: IntArray? = null,
    val sourceW: Int = w,
    val sourceH: Int = h,
)

/**
 * Pure-Kotlin parser and lookup index for legacy AND --v2 trimmed/deduplicated sprite atlases
 * (`atlas/castle@2x.json` or `atlas/castle@1x.json`). Zero Android dependencies so it is unit tested.
 */
class AtlasIndex(
    val scale: Int,
    val v2: Boolean,
    val trimmed: Boolean,
    val frames: Map<String, AtlasFrame>,
    val aliases: Map<String, String>,
    val overlays: Map<String, List<SpriteOverlay>>,
) {
    fun resolveName(name: String): String = aliases[name] ?: name
    fun overlaysFor(name: String): List<SpriteOverlay> = overlays[name] ?: emptyList()
    fun frameFor(name: String): AtlasFrame? = frames[resolveName(name)]
    val isEmpty: Boolean get() = frames.isEmpty()

    companion object {
        val EMPTY = AtlasIndex(2, false, false, emptyMap(), emptyMap(), emptyMap())

        /** Parses `castle@2x.json` / `castle@1x.json` and every page JSON it references. */
        fun parse(indexJson: String, readPage: (String) -> String?): AtlasIndex {
            val root = JSONObject(indexJson)
            val atlasScale = root.optInt("scale", 2).coerceAtLeast(1)
            val v2 = root.optBoolean("v2", false)
            val trimmed = root.optBoolean("trimmed", false)
            val aliases = HashMap<String, String>()
            root.optJSONObject("aliases")?.let { obj ->
                for (k in obj.keys()) {
                    val v = obj.optString(k)
                    if (v.isNotEmpty()) aliases[k] = v
                }
            }
            val overlays = HashMap<String, List<SpriteOverlay>>()
            root.optJSONObject("overlays")?.let { obj ->
                for (k in obj.keys()) {
                    val arr = obj.optJSONArray(k) ?: continue
                    val list = ArrayList<SpriteOverlay>(arr.length())
                    for (i in 0 until arr.length()) {
                        val o = arr.optJSONObject(i) ?: continue
                        val sp = o.optString("sprite")
                        if (sp.isEmpty()) continue
                        list.add(
                            SpriteOverlay(
                                sprite = sp,
                                dx = o.optDouble("dx", 0.0).toFloat(),
                                dy = o.optDouble("dy", 0.0).toFloat(),
                                rot = o.optDouble("rot", 0.0).toFloat(),
                                scale = o.optDouble("scale", 1.0).toFloat(),
                            ),
                        )
                    }
                    if (list.isNotEmpty()) overlays[k] = list
                }
            }
            val frames = HashMap<String, AtlasFrame>()
            val pages = root.optJSONArray("pages")
            if (pages != null) {
                for (i in 0 until pages.length()) {
                    val pageFile = pages.optString(i)
                    if (pageFile.isEmpty()) continue
                    val pageText = readPage(pageFile) ?: continue
                    val pg = JSONObject(pageText)
                    val img = pg.optString("image")
                    if (img.isEmpty()) continue
                    val pageScale = pg.optInt("scale", atlasScale).coerceAtLeast(1)
                    val frObj = pg.optJSONObject("frames") ?: continue
                    for (name in frObj.keys()) {
                        val fo = frObj.optJSONObject(name) ?: continue
                        val x = fo.optInt("x", 0)
                        val y = fo.optInt("y", 0)
                        val w = fo.optInt("w", 0)
                        val h = fo.optInt("h", 0)
                        if (w <= 0 || h <= 0) continue
                        val fScale = fo.optDouble("scale", pageScale.toDouble()).toFloat().coerceAtLeast(0.5f)
                        val trimArr = fo.optJSONArray("trim")?.let { ta ->
                            if (ta.length() >= 4) intArrayOf(ta.optInt(0), ta.optInt(1), ta.optInt(2), ta.optInt(3)) else null
                        }
                        val srcArr = fo.optJSONArray("sourceSize")
                        val sw = srcArr?.optInt(0, w) ?: w
                        val sh = srcArr?.optInt(1, h) ?: h
                        frames[name] = AtlasFrame(img, x, y, w, h, fScale, trimArr, sw, sh)
                    }
                }
            }
            return AtlasIndex(atlasScale, v2, trimmed, frames, aliases, overlays)
        }

        /**
         * Computes destination bounds `[left, top, right, bottom]` for a sprite anchored at ([sx], [sy])
         * at draw scale [u] (screen px per @1x px), honoring alpha-bbox [trim] and [frameScale] with zero drift.
         */
        fun trimmedBounds(
            ax: Float, ay: Float, w: Float, h: Float,
            trim: IntArray?, frameScale: Float,
            sx: Float, sy: Float, u: Float,
            out: FloatArray,
        ) {
            if (trim != null && trim.size >= 4 && frameScale > 0f) {
                val left = sx + (trim[0] / frameScale - ax) * u
                val top = sy + (trim[1] / frameScale - ay) * u
                out[0] = left
                out[1] = top
                out[2] = left + (trim[2] / frameScale) * u
                out[3] = top + (trim[3] / frameScale) * u
            } else {
                out[0] = sx - ax * u
                out[1] = sy - ay * u
                out[2] = sx + (w - ax) * u
                out[3] = sy + (h - ay) * u
            }
        }
    }
}

/**
 * Sprites from the shared assets/ folder, which the Gradle task copyCastleAssets
 * copies into the APK at build time (either legacy individual @2x PNGs or a --v2
 * single-page trimmed & deduplicated atlas plus non-atlas backgrounds).
 *
 * Sizes and anchors come from manifest.json (w, h, anchor in px at @1x; one sim
 * cell is 1 px at @1x). A missing sprite gives null and the caller draws a shape.
 *
 * Memory (review M5, review 2 N-M10):
 * - The index is built on a worker thread. Background layers are decoded at half size
 *   and the opaque sky as RGB_565.
 * - [prefetch] decodes a battle's sprites on a worker before they are first drawn, so
 *   the first fire, hit and collapse do not decode on the render thread.
 * - The cache is bounded by bytes (least recently used goes first).
 * - A decode that failed (also out of memory) is not cached, so it is tried again.
 * - [trim]: hidden drops the backgrounds; running low drops only what was not drawn in
 *   the last few seconds; a background trim level drops everything.
 */
class Sprites(private val assets: AssetManager, budgetBytes: Long = 64L shl 20) : SpriteSource {
    /** Size and anchor in @1x px, from the top left. */
    class Meta(val w: Float, val h: Float, val ax: Float, val ay: Float)
    class Sprite(
        val bmp: Bitmap,
        val meta: Meta,
        val src: Rect? = null,
        val trim: IntArray? = null,
        val frameScale: Float = 2f,
        val sourceW: Int = (meta.w * 2f).roundToInt(),
        val sourceH: Int = (meta.h * 2f).roundToInt(),
        val overlays: List<SpriteOverlay> = emptyList(),
    ) {
        @Volatile var usedAt = 0L
        /** Cached standalone bitmap for Compose Image thumbnails when sliced from an atlas or carrying overlays. */
        @Volatile var uiBmp: Bitmap? = null
    }

    private val files = HashMap<String, String>()
    private val metas = HashMap<String, Meta>()
    private var atlas: AtlasIndex = AtlasIndex.EMPTY
    private val atlasPages = HashMap<String, Bitmap>()
    private val cache = CostLru<String, Sprite>(budgetBytes) { sp ->
        // Atlas slices share a single page bitmap in [atlasPages]; avoid double-counting page bytes per slice.
        if (sp.src != null) 256L else sp.bmp.allocationByteCount.toLong()
    }
    private val missing = HashSet<String>()
    @Volatile private var ready = false
    private val lock = Object()
    /** Bumped when the index becomes ready or bitmaps are dropped, so holders look them up again. */
    @Volatile override var generation = 0
        private set
    private val _version = MutableStateFlow(0)
    /** Thread-safe Compose-observable generation bumped on ready and trim (Android-M4). */
    val version: StateFlow<Int> get() = _version

    private fun bumpGeneration() {
        generation++
        _version.value = generation
    }

    init {
        Thread({
            val f = HashMap<String, String>(); val m = HashMap<String, Meta>()
            var loadedAtlas = AtlasIndex.EMPTY
            try {
                for (name in assets.list("sprites") ?: emptyArray()) {
                    if (name.endsWith("@2x.png")) f[name.removeSuffix("@2x.png")] = "sprites/$name"
                }
                val root = JSONObject(assets.open("manifest.json").bufferedReader().use { it.readText() })
                val a = root.optJSONArray("sprites")
                if (a != null) for (i in 0 until a.length()) {
                    val s = a.optJSONObject(i) ?: continue
                    val an = s.optJSONArray("anchor")
                    m[s.optString("name")] = Meta(
                        s.optDouble("w", 16.0).toFloat(), s.optDouble("h", 16.0).toFloat(),
                        an?.optDouble(0, 0.0)?.toFloat() ?: 0f, an?.optDouble(1, 0.0)?.toFloat() ?: 0f,
                    )
                }
                // Try --v2 / trimmed / packed atlas index (castle@2x.json, fallback castle@1x.json).
                val atlasFiles = (assets.list("atlas") ?: emptyArray()).toSet()
                val idxFile = when {
                    "castle@2x.json" in atlasFiles -> "castle@2x.json"
                    "castle@1x.json" in atlasFiles -> "castle@1x.json"
                    else -> null
                }
                if (idxFile != null) {
                    val idxText = assets.open("atlas/$idxFile").bufferedReader().use { it.readText() }
                    loadedAtlas = AtlasIndex.parse(idxText) { pg ->
                        try { assets.open("atlas/$pg").bufferedReader().use { it.readText() } } catch (e: Exception) { null }
                    }
                }
            } catch (e: Exception) {
                // No assets in this build: every lookup falls back to shapes.
            }
            synchronized(lock) {
                files.putAll(f); metas.putAll(m); atlas = loadedAtlas
                ready = true; bumpGeneration(); lock.notifyAll()
            }
        }, "sprites-index").start()
    }

    /** Waits (briefly) for the index. The render thread calls this once before its first frame. */
    fun awaitIndex(ms: Long = 2000) {
        synchronized(lock) { if (!ready) try { lock.wait(ms) } catch (e: InterruptedException) { } }
    }

    /** Non-blocking cache lookup for Compose UI thread (never decodes PNGs on the main thread, Android-M4). */
    fun getCached(name: String): Sprite? = synchronized(lock) {
        if (!ready) return null
        cache[name]?.also { it.usedAt = now() }
    }

    /** Non-blocking UI bitmap lookup for Compose main thread (never decodes PNGs or composites on UI thread). */
    fun getCachedUiBitmap(name: String): Bitmap? {
        val sp = getCached(name) ?: return null
        return if (sp.src == null && sp.overlays.isEmpty()) sp.bmp else sp.uiBmp
    }

    /** Returns overlays configured for [name] in a --v2 deduplicated atlas, or empty. */
    fun overlaysFor(name: String): List<SpriteOverlay> = synchronized(lock) { atlas.overlaysFor(name) }

    override fun get(name: String): Sprite? {
        val frame: AtlasFrame?
        val resolvedName: String
        val ovs: List<SpriteOverlay>
        val filePath: String?
        synchronized(lock) {
            if (!ready) return null
            cache[name]?.let { it.usedAt = now(); return it }
            if (name in missing) return null
            resolvedName = atlas.resolveName(name)
            ovs = atlas.overlaysFor(name)
            frame = atlas.frames[resolvedName]
            filePath = files[name] ?: files[resolvedName]
            if (frame == null && filePath == null) {
                missing.add(name)
                return null
            }
        }
        val sp: Sprite = if (frame != null) {
            val pageBmp = decodeAtlasPage(frame.page) ?: return null
            val meta = synchronized(lock) { metas[name] ?: metas[resolvedName] }
                ?: Meta(frame.sourceW / frame.frameScale, frame.sourceH / frame.frameScale, 0f, 0f)
            Sprite(
                bmp = pageBmp,
                meta = meta,
                src = Rect(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h),
                trim = frame.trim,
                frameScale = frame.frameScale,
                sourceW = frame.sourceW,
                sourceH = frame.sourceH,
                overlays = ovs,
            )
        } else {
            val bmp = decode(name, filePath!!) ?: return null // not cached: tried again next time
            val meta = synchronized(lock) { metas[name] ?: metas[resolvedName] }
                ?: Meta(bmp.width / 2f, bmp.height / 2f, 0f, 0f)
            Sprite(bmp, meta, overlays = ovs)
        }
        sp.usedAt = now()
        synchronized(lock) {
            cache[name]?.let { return it } // another thread decoded it first
            if (cache.put(name, sp) > 0) bumpGeneration()
        }
        return sp
    }

    /** First hit of two names (the second is a fallback). */
    fun get(name: String, fallback: String): Sprite? = get(name) ?: get(fallback)

    /** Decodes, on a worker thread, every sprite whose name starts with one of [prefixes] (a battle's set). */
    fun prefetch(prefixes: List<String>) {
        Thread({
            awaitIndex()
            val names = synchronized(lock) {
                val all = HashSet<String>(files.keys)
                all.addAll(atlas.frames.keys)
                all.addAll(atlas.aliases.keys)
                all.filter { n -> prefixes.any { n.startsWith(it) } }
            }
            for (n in names) { if (synchronized(lock) { cache.containsKey(n) }) continue; get(n) }
        }, "sprites-prefetch").also { it.priority = Thread.MIN_PRIORITY }.start()
    }

    private fun decodeAtlasPage(pageImage: String): Bitmap? {
        synchronized(lock) { atlasPages[pageImage]?.let { return it } }
        val decoded = try {
            assets.open("atlas/$pageImage").use { BitmapFactory.decodeStream(it) }
        } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null } ?: return null
        synchronized(lock) {
            atlasPages[pageImage]?.let { return it }
            atlasPages[pageImage] = decoded
        }
        return decoded
    }

    private fun decode(name: String, path: String): Bitmap? = try {
        val o = BitmapFactory.Options()
        if (name.startsWith("bg_")) {
            o.inSampleSize = 2
            if (name.endsWith("_sky")) o.inPreferredConfig = Bitmap.Config.RGB_565
        }
        assets.open(path).use { BitmapFactory.decodeStream(it, null, o) }
    } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null }

    // ---- Canvas & Compose draw helpers (supports legacy PNGs and --v2 trimmed/deduped atlases) ----

    /** Draws one sprite frame (without overlays) anchored at ([sx], [sy]) at scale [u] (px per @1x px). */
    private fun drawSingleAnchored(c: Canvas, sp: Sprite, sx: Float, sy: Float, u: Float, dst: RectF, paint: Paint) {
        val m = sp.meta
        val t = sp.trim
        val fs = sp.frameScale
        if (t != null && t.size >= 4 && fs > 0f) {
            val left = sx + (t[0] / fs - m.ax) * u
            val top = sy + (t[1] / fs - m.ay) * u
            dst.set(left, top, left + (t[2] / fs) * u, top + (t[3] / fs) * u)
        } else {
            dst.set(sx - m.ax * u, sy - m.ay * u, sx + (m.w - m.ax) * u, sy + (m.h - m.ay) * u)
        }
        c.drawBitmap(sp.bmp, sp.src, dst, paint)
    }

    /** Draws [sp] (plus any --v2 team scarf/balloon overlays) anchored at screen ([sx], [sy]) with scale [u]. */
    fun drawAnchored(c: Canvas, sp: Sprite, sx: Float, sy: Float, u: Float, flip: Boolean, dst: RectF, paint: Paint) {
        if (flip) {
            c.save()
            c.scale(-1f, 1f, sx, sy)
        }
        drawSingleAnchored(c, sp, sx, sy, u, dst, paint)
        val ovs = sp.overlays
        if (ovs.isNotEmpty()) {
            for (i in ovs.indices) {
                val ov = ovs[i]
                val osp = get(ov.sprite) ?: continue
                osp.usedAt = sp.usedAt
                val ox = sx + ov.dx * u
                val oy = sy + ov.dy * u
                val ou = u * ov.scale
                if (ov.rot != 0f) {
                    c.save()
                    c.rotate(ov.rot, ox, oy)
                    drawSingleAnchored(c, osp, ox, oy, ou, dst, paint)
                    c.restore()
                } else {
                    drawSingleAnchored(c, osp, ox, oy, ou, dst, paint)
                }
            }
        }
        if (flip) c.restore()
    }

    /** Draws [sp] centred on screen ([cx], [cy]) at untrimmed height [hPx], honoring --v2 trim and overlays. */
    fun drawCentered(c: Canvas, sp: Sprite, cx: Float, cy: Float, hPx: Float, dst: RectF, paint: Paint) {
        val m = sp.meta
        if (m.h <= 0f) return
        val u = hPx / m.h
        val sx = cx + (m.ax - m.w * 0.5f) * u
        val sy = cy + (m.ay - m.h * 0.5f) * u
        drawAnchored(c, sp, sx, sy, u, flip = false, dst = dst, paint = paint)
    }

    /** Draws [sp] scaled into [box], honoring --v2 trim subrect placement. */
    fun drawBox(c: Canvas, sp: Sprite, box: RectF, dst: RectF, paint: Paint) {
        val m = sp.meta
        val t = sp.trim
        val fs = sp.frameScale
        if (t != null && t.size >= 4 && fs > 0f && m.w > 0f && m.h > 0f) {
            val ux = box.width() / m.w
            val uy = box.height() / m.h
            val left = box.left + (t[0] / fs) * ux
            val top = box.top + (t[1] / fs) * uy
            dst.set(left, top, left + (t[2] / fs) * ux, top + (t[3] / fs) * uy)
        } else {
            dst.set(box)
        }
        c.drawBitmap(sp.bmp, sp.src, dst, paint)
    }

    /**
     * Returns a standalone bitmap suitable for Compose [androidx.compose.foundation.Image].
     * Legacy untrimmed sprites return [Sprite.bmp] directly with zero copy; --v2 atlas slices or
     * sprites with overlays are materialized once onto a small cropped bitmap and cached.
     */
    fun uiBitmap(sp: Sprite): Bitmap {
        if (sp.src == null && sp.overlays.isEmpty()) return sp.bmp
        sp.uiBmp?.let { return it }
        val scale = max(1f, sp.frameScale)
        val bw = max(1, (sp.meta.w * scale).roundToInt())
        val bh = max(1, (sp.meta.h * scale).roundToInt())
        val out = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
        val cv = Canvas(out)
        val p = Paint(Paint.FILTER_BITMAP_FLAG)
        val dst = RectF()
        drawAnchored(cv, sp, sp.meta.ax * scale, sp.meta.ay * scale, scale, flip = false, dst = dst, paint = p)
        sp.uiBmp = out
        return out
    }

    fun trim(level: Int) {
        synchronized(lock) {
            val n = when {
                level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> {
                    val s = cache.size + atlasPages.size
                    cache.clear()
                    atlasPages.clear()
                    s
                }
                level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> cache.removeIf { k, _ -> k.startsWith("bg_") }
                level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> {
                    // Keep what the battle on screen drew in the last 5 s.
                    val cut = now() - 5000
                    cache.removeIf { _, v -> v.usedAt < cut }
                }
                else -> 0
            }
            if (n > 0) bumpGeneration()
        }
    }

    val count: Int get() = synchronized(lock) { files.size + atlas.frames.size }

    companion object {
        /** The clock for [Sprite.usedAt], in ms. */
        fun now(): Long = System.nanoTime() / 1_000_000

        /** Sprite name part for a Hob from its content id (`def`): "old_thumper" gives "thumper". */
        fun hobKey(def: String): String = when (def) {
            "old_thumper" -> "thumper"
            else -> def
        }

        /** Flattener sprite key matching tools/art-gen/sprite-flattener.mjs (`flattener_<key>_<pose>_<frame>`). */
        fun flattenerKey(def: String, cls: String = ""): String = when (def) {
            "hedge_snipper" -> "snipper"
            "rake_hand" -> "rake"
            "mower_minder" -> "tamper"
            "pebble_pitcher" -> "sniper"
            else -> when (cls) {
                "lobber" -> "snipper"
                "scatterjack" -> "rake"
                "peeper" -> "clerk"
                "zinger" -> "sniper"
                "delver", "boinker" -> "tamper"
                "sizzler" -> "pump"
                "patcher" -> "filler"
                else -> "snipper"
            }
        }

        /** Sprite name prefixes a battle draws, for [prefetch]: field art, HUD icons/portraits/pennants, Flatteners, props, and each Hob's poses (Android-M4). */
        /**
         * The look a side's Hobs wear: `blue` for side 0, `orange` for a person on side 1 (Couch Duel
         * player 2), `rival` for the game's side (slate Flattener hats, hatched scarf: `hob_<name>_rival_*`).
         */
        fun team(side: Int, human: Boolean): String = when {
            side == 0 -> "blue"
            human -> "orange"
            else -> "rival"
        }

        /** Sprite name prefixes for a fight, with each Hob as (content id, [team]). */
        fun battleSet(hobs: List<Pair<String, String>>): List<String> =
            listOf(
                "fx_", "block_", "kettle", "shell_", "bg_", "stomper_", "loophole_", "pot_lid",
                "nook", "flag_", "icon_", "ui_", "portrait_", "prop_", "fort_", "hob_scarf_", "flattener_",
            ) + hobs.map { (def, team) -> "hob_${hobKey(def)}_${team}_" }.distinct()
    }
}
