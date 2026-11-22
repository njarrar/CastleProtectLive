package games.castleprotect.game

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * The local save: campaign progress plus the battle in play.
 *
 * The core keeps no save of its own (core/API.md has no save call), so a battle in
 * play is stored the way the core's golden replays are: the setup, the seed and the
 * core's own command log (`{"cmd":"log"}`). Loading starts the battle again and replays
 * the log, so the core rebuilds the exact state. The app adds no rules to it.
 *
 * Safety rules (review H1, H2, H3):
 *  - Writes go to a temp file, are synced, then renamed over the save. The previous
 *    good save is kept as `<name>.prev`.
 *  - A save that cannot be read is never written over. It is moved aside as
 *    `<name>.bad-<time>` and the backup is tried; nothing is written until a load has
 *    worked or the bad file has been set aside.
 *  - The debug fixture player uses its own file name, so it never touches a real save.
 *
 * Plain java.io so the same code runs in JVM unit tests.
 */
class SaveStore(dir: File, name: String) {
    private val main = File(dir, name)
    private val prev = File(dir, "$name.prev")
    private val tmp = File(dir, "$name.tmp")
    private val dir0 = dir

    sealed class Loaded {
        object Missing : Loaded()
        class Ok(val data: SaveData, val fromBackup: Boolean) : Loaded()
        /** Neither the save nor its backup could be read. They were moved aside. */
        class Unreadable(val movedTo: List<File>, val why: String) : Loaded()
    }

    @Volatile var readOnly = true
        private set

    /** Reads the save. Must be called once before [write] is allowed. */
    @Synchronized
    fun load(): Loaded {
        tmp.delete()
        if (!main.exists() && !prev.exists()) { readOnly = false; return Loaded.Missing }
        val first = tryRead(main)
        if (first.first != null) { readOnly = false; return Loaded.Ok(first.first!!, false) }
        val moved = ArrayList<File>()
        val why = first.second
        if (main.exists()) moveAside(main)?.let { moved.add(it) }
        val second = tryRead(prev)
        if (second.first != null) {
            // Restore the backup as the main save, so the next write keeps a good .prev.
            try { prev.copyTo(main, overwrite = true) } catch (e: IOException) { }
            readOnly = false
            return Loaded.Ok(second.first!!, true)
        }
        if (prev.exists()) moveAside(prev)?.let { moved.add(it) }
        readOnly = false
        return Loaded.Unreadable(moved, why ?: second.second ?: "unknown")
    }

    private fun tryRead(f: File): Pair<SaveData?, String?> {
        if (!f.exists()) return null to "missing"
        return try {
            val text = f.readBytes().toString(Charsets.UTF_8)
            SaveData.parse(text) to null
        } catch (e: Exception) {
            null to (e.message ?: e.javaClass.simpleName)
        }
    }

    private fun moveAside(f: File): File? {
        val to = File(dir0, "${f.name}.bad-${System.currentTimeMillis()}")
        if (!f.renameTo(to)) return null
        pruneSetAside()
        return to
    }

    /** Set-aside saves are kept for support, but only the newest two (review 2 N-L15). */
    fun pruneSetAside() {
        val bad = dir0.listFiles { x -> x.name.contains(".bad-") } ?: return
        bad.sortedByDescending { it.name.substringAfterLast(".bad-").toLongOrNull() ?: 0L }.drop(2).forEach { it.delete() }
    }

    /** Writes the save atomically, keeping the last good one as `.prev`. Returns false on failure. */
    @Synchronized
    fun write(data: SaveData): Boolean {
        if (readOnly) return false
        val bytes = data.toJson().toByteArray(Charsets.UTF_8)
        try {
            dir0.mkdirs()
            FileOutputStream(tmp).use { out -> out.write(bytes); out.fd.sync() }
            if (main.exists()) {
                prev.delete()
                if (!main.renameTo(prev)) main.copyTo(prev, overwrite = true)
            }
            if (!tmp.renameTo(main)) { tmp.copyTo(main, overwrite = true); tmp.delete() }
            return true
        } catch (e: IOException) {
            tmp.delete()
            return false
        }
    }
}

/** A battle in play, as the core can rebuild it. */
data class SavedBattle(
    val setup: String, val seed: Long, val kind: String, val level: String, val seats: String,
    /** The core's command log, as raw JSON array text. */
    val log: String,
    /** The core version that wrote it, from cp_version. */
    val core: String,
)

/**
 * Everything the app saves. [pennants]: per campaign level, a bit per Pennant earned
 * (bit 0 is the first Pennant, which is the win).
 */
data class SaveData(
    val pennants: Map<String, Int> = emptyMap(),
    val battle: SavedBattle? = null,
    /** The last battle started, for Rematch after a cold start. */
    val last: SavedBattle? = null,
    /** Buttons earned, summed from the core's result.buttons. */
    val buttons: Int = 0,
    /** The Workshop fort: rows top down, the Footing row last (core/API.md `sides[i].rows`). Empty: none saved. */
    val fort: List<String> = emptyList(),
) {
    fun toJson(): String {
        val o = JSONObject().put("v", VERSION)
        val p = JSONObject(); for ((k, v) in pennants) p.put(k, v); o.put("pennants", p)
        battle?.let { o.put("battle", it.toJson()) }
        last?.let { o.put("last", it.toJson()) }
        o.put("buttons", buttons)
        if (fort.isNotEmpty()) o.put("fort", JSONArray(fort))
        return o.toString()
    }

    companion object {
        const val VERSION = 1

        /** Throws on anything that is not a save this app can read. */
        fun parse(text: String): SaveData {
            val o = JSONObject(text)
            val v = o.getInt("v")
            if (v > VERSION) throw IOException("save version $v is newer than this app ($VERSION)")
            val pen = HashMap<String, Int>()
            o.optJSONObject("pennants")?.let { p -> for (k in p.keys()) pen[k] = p.getInt(k) }
            val fort = o.optJSONArray("fort")?.let { a -> List(a.length()) { a.getString(it) } } ?: emptyList()
            return SaveData(pen, o.optJSONObject("battle")?.let { battle(it) }, o.optJSONObject("last")?.let { battle(it) }, o.optInt("buttons", 0), fort)
        }

        private fun battle(b: JSONObject) = SavedBattle(
            b.getString("setup"), b.getLong("seed"), b.getString("kind"), b.getString("level"), b.optString("seats", "one_seat"),
            b.optJSONArray("log")?.toString() ?: "[]", b.optString("core"),
        )

        private fun SavedBattle.toJson(): JSONObject = JSONObject().put("setup", setup).put("seed", seed).put("kind", kind).put("level", level)
            .put("seats", seats).put("log", JSONArray(log)).put("core", core)
    }
}
