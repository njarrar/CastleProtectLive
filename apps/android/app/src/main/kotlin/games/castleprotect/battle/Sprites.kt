package games.castleprotect.battle

import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject

/**
 * Sprites from the shared assets/ folder, which the Gradle task copyCastleAssets
 * copies into the APK at build time (the @2x PNGs and manifest.json).
 *
 * Sizes and anchors are never hard-coded: they come from manifest.json, where
 * w, h and anchor are in px at @1x and one sim cell is 1 px at @1x. A missing
 * sprite returns null and the caller draws a flat shape instead, so the app
 * never depends on an asset being there.
 */
class Sprites(private val assets: AssetManager) {
    /** Size and anchor in @1x px, from the top left. */
    class Meta(val w: Float, val h: Float, val ax: Float, val ay: Float)
    class Sprite(val bmp: Bitmap, val meta: Meta)

    private val files = HashMap<String, String>()
    private val metas = HashMap<String, Meta>()
    private val cache = HashMap<String, Sprite?>()

    init {
        try {
            for (f in assets.list("sprites") ?: emptyArray()) {
                if (f.endsWith("@2x.png")) files[f.removeSuffix("@2x.png")] = "sprites/$f"
            }
            val m = JSONObject(assets.open("manifest.json").bufferedReader().use { it.readText() })
            val a = m.optJSONArray("sprites")
            if (a != null) for (i in 0 until a.length()) {
                val s = a.optJSONObject(i) ?: continue
                val an = s.optJSONArray("anchor")
                metas[s.optString("name")] = Meta(
                    s.optDouble("w", 16.0).toFloat(), s.optDouble("h", 16.0).toFloat(),
                    an?.optDouble(0, 0.0)?.toFloat() ?: 0f, an?.optDouble(1, 0.0)?.toFloat() ?: 0f,
                )
            }
        } catch (e: Exception) {
            // No assets in this build: every lookup falls back to shapes.
        }
    }

    /** First hit among the candidate names. */
    @Synchronized
    fun get(vararg names: String): Sprite? {
        for (n in names) {
            if (cache.containsKey(n)) { cache[n]?.let { return it }; continue }
            val path = files[n]
            val bmp = if (path == null) null else try { assets.open(path).use { BitmapFactory.decodeStream(it) } } catch (e: Exception) { null }
            val sp = if (bmp == null) null else Sprite(bmp, metas[n] ?: Meta(bmp.width / 2f, bmp.height / 2f, 0f, 0f))
            cache[n] = sp
            if (sp != null) return sp
        }
        return null
    }

    val count: Int get() = files.size

    companion object {
        /** Sprite name part for a Hob, from its id or display name: "old_thumper0" and "Old Thumper" both give "thumper". */
        fun hobKey(id: String, name: String): String {
            val known = listOf("marge", "quill", "jax", "grub", "bobbin", "hetty", "thumper", "nan")
            val hay = (id + " " + name).lowercase()
            return known.firstOrNull { Regex("(^|[^a-z])$it([^a-z]|$)").containsMatchIn(hay) } ?: "marge"
        }
        /** Plain Shot sprite by Class, per assets/README.md. */
        fun plainShell(cls: String): String = when (cls.lowercase()) {
            "lobber" -> "clodpot"; "zinger" -> "hatpin"; "scatterjack" -> "gravel"; "delver" -> "nibbler"; "boinker" -> "bouncebean"; "patcher" -> "mendglob"; else -> "clodpot"
        }
    }
}
