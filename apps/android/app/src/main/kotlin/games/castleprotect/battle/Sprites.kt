package games.castleprotect.battle

import android.content.ComponentCallbacks2
import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject

/**
 * Sprites from the shared assets/ folder, which the Gradle task copyCastleAssets
 * copies into the APK at build time (the @2x PNGs and manifest.json).
 *
 * Sizes and anchors come from manifest.json (w, h, anchor in px at @1x; one sim
 * cell is 1 px at @1x). A missing sprite gives null and the caller draws a shape.
 *
 * Memory (review M5): the index is built on a worker thread, not at first
 * composition. Background layers are decoded at half size (the @1x size) and the
 * opaque sky as RGB_565, which brings the three of them from about 16 MB to about
 * 3 MB. [trim] drops decoded bitmaps when the system asks for memory.
 */
class Sprites(private val assets: AssetManager) {
    /** Size and anchor in @1x px, from the top left. */
    class Meta(val w: Float, val h: Float, val ax: Float, val ay: Float)
    class Sprite(val bmp: Bitmap, val meta: Meta)

    private val files = HashMap<String, String>()
    private val metas = HashMap<String, Meta>()
    private val cache = HashMap<String, Sprite?>()
    @Volatile private var ready = false
    private val lock = Object()
    /** Bumped when bitmaps are dropped, so holders of resolved sprites look them up again. */
    @Volatile var generation = 0
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

    fun get(name: String): Sprite? {
        synchronized(lock) {
            if (!ready) return null
            if (cache.containsKey(name)) return cache[name]
        }
        val path = synchronized(lock) { files[name] }
        val bmp = if (path == null) null else decode(name, path)
        val sp = if (bmp == null) null else Sprite(bmp, synchronized(lock) { metas[name] } ?: Meta(bmp.width / 2f, bmp.height / 2f, 0f, 0f))
        synchronized(lock) { cache[name] = sp }
        return sp
    }

    /** First hit of two names (the second is a fallback). */
    fun get(name: String, fallback: String): Sprite? = get(name) ?: get(fallback)

    private fun decode(name: String, path: String): Bitmap? = try {
        val o = BitmapFactory.Options()
        if (name.startsWith("bg_")) {
            o.inSampleSize = 2
            if (name.endsWith("_sky")) o.inPreferredConfig = Bitmap.Config.RGB_565
        }
        assets.open(path).use { BitmapFactory.decodeStream(it, null, o) }
    } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null }

    /** Drops decoded bitmaps when memory runs low. They decode again when next drawn. */
    fun trim(level: Int) {
        if (level < ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW && level != ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) return
        synchronized(lock) {
            if (level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
                // Hidden: drop only the big backgrounds.
                cache.keys.filter { it.startsWith("bg_") }.forEach { cache.remove(it) }
            } else cache.clear()
            generation++
        }
    }

    val count: Int get() = synchronized(lock) { files.size }

    companion object {
        /** Sprite name part for a Hob from its content id (`def`): "old_thumper" gives "thumper". */
        fun hobKey(def: String): String = when (def) {
            "old_thumper" -> "thumper"
            else -> def
        }
    }
}
