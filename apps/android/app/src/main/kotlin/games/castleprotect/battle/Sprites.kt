package games.castleprotect.battle

import android.content.ComponentCallbacks2
import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject

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

/**
 * Sprites from the shared assets/ folder, which the Gradle task copyCastleAssets
 * copies into the APK at build time (the @2x PNGs and manifest.json).
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
    class Sprite(val bmp: Bitmap, val meta: Meta) {
        @Volatile var usedAt = 0L
    }

    private val files = HashMap<String, String>()
    private val metas = HashMap<String, Meta>()
    private val cache = CostLru<String, Sprite>(budgetBytes) { it.bmp.allocationByteCount.toLong() }
    private val missing = HashSet<String>()
    @Volatile private var ready = false
    private val lock = Object()
    /** Bumped when bitmaps are dropped, so holders of resolved sprites look them up again. */
    @Volatile override var generation = 0
        private set

    init {
        Thread({
            val f = HashMap<String, String>(); val m = HashMap<String, Meta>()
            try {
                for (name in assets.list("sprites") ?: emptyArray()) if (name.endsWith("@2x.png")) f[name.removeSuffix("@2x.png")] = "sprites/$name"
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
            } catch (e: Exception) {
                // No assets in this build: every lookup falls back to shapes.
            }
            synchronized(lock) { files.putAll(f); metas.putAll(m); ready = true; lock.notifyAll() }
        }, "sprites-index").start()
    }

    /** Waits (briefly) for the index. The render thread calls this once before its first frame. */
    fun awaitIndex(ms: Long = 2000) {
        synchronized(lock) { if (!ready) try { lock.wait(ms) } catch (e: InterruptedException) { } }
    }

    override fun get(name: String): Sprite? {
        val path: String
        synchronized(lock) {
            if (!ready) return null
            cache[name]?.let { it.usedAt = now(); return it }
            if (name in missing) return null
            path = files[name] ?: run { missing.add(name); return null }
        }
        val bmp = decode(name, path) ?: return null // not cached: tried again next time
        val sp = Sprite(bmp, synchronized(lock) { metas[name] } ?: Meta(bmp.width / 2f, bmp.height / 2f, 0f, 0f))
        sp.usedAt = now()
        synchronized(lock) {
            cache[name]?.let { return it } // another thread decoded it first
            if (cache.put(name, sp) > 0) generation++
        }
        return sp
    }

    /** First hit of two names (the second is a fallback). */
    fun get(name: String, fallback: String): Sprite? = get(name) ?: get(fallback)

    /** Decodes, on a worker thread, every sprite whose name starts with one of [prefixes] (a battle's set). */
    fun prefetch(prefixes: List<String>) {
        Thread({
            awaitIndex()
            val names = synchronized(lock) { files.keys.filter { n -> prefixes.any { n.startsWith(it) } } }
            for (n in names) { if (synchronized(lock) { cache.containsKey(n) }) continue; get(n) }
        }, "sprites-prefetch").also { it.priority = Thread.MIN_PRIORITY }.start()
    }

    private fun decode(name: String, path: String): Bitmap? = try {
        val o = BitmapFactory.Options()
        if (name.startsWith("bg_")) {
            o.inSampleSize = 2
            if (name.endsWith("_sky")) o.inPreferredConfig = Bitmap.Config.RGB_565
        }
        assets.open(path).use { BitmapFactory.decodeStream(it, null, o) }
    } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null }

    fun trim(level: Int) {
        synchronized(lock) {
            val n = when {
                level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> { val s = cache.size; cache.clear(); s }
                level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN -> cache.removeIf { k, _ -> k.startsWith("bg_") }
                level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> {
                    // Keep what the battle on screen drew in the last 5 s.
                    val cut = now() - 5000
                    cache.removeIf { _, v -> v.usedAt < cut }
                }
                else -> 0
            }
            if (n > 0) generation++
        }
    }

    val count: Int get() = synchronized(lock) { files.size }

    companion object {
        /** The clock for [Sprite.usedAt], in ms. */
        fun now(): Long = System.nanoTime() / 1_000_000

        /** Sprite name part for a Hob from its content id (`def`): "old_thumper" gives "thumper". */
        fun hobKey(def: String): String = when (def) {
            "old_thumper" -> "thumper"
            else -> def
        }

        /** Sprite name prefixes a battle draws, for [prefetch]: the field's art and each Hob's poses. */
        fun battleSet(hobs: List<Pair<String, Int>>): List<String> =
            listOf("fx_", "block_", "kettle", "shell_", "bg_", "stomper_", "loophole_", "pot_lid", "nook", "flag_") +
                hobs.map { (def, side) -> "hob_${hobKey(def)}_${if (side == 0) "blue" else "orange"}_" }.distinct()
    }
}
