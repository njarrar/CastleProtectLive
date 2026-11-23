package games.castleprotect.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlin.random.Random

/**
 * Every line a player reads or hears read out, from content/text.json (content/text.md).
 * The APK carries it as `content/text.json`, copied at build time like the other content.
 *
 * - Keys are dotted paths: `results.loss.title.kettle_pop`.
 * - Placeholders are `{word}`: pass them as `"word" to value`.
 * - A list is a pool: one line at random, never the same line twice running.
 * - Plurals hold `one` and `other`: [plural].
 * - Keys that start with `_` are notes and are never shown.
 * - Ids from the core: [byId] looks the id up under a group and falls back to `default`.
 *
 * A missing key shows the key itself, so a gap is easy to see and never crashes.
 * Unit tests (no APK) read the file from the repo root (system property `castle.repoRoot`).
 */
object Text {
    @Volatile private var root: JSONObject? = null
    private val lastPick = ConcurrentHashMap<String, Int>()
    private val rnd = Random(System.nanoTime())

    /** Loads the table from its JSON text. A bad file leaves an empty table. */
    fun install(json: String?) {
        root = json?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
        lastPick.clear()
    }

    fun fromAssets(assets: android.content.res.AssetManager) {
        install(try { assets.open("content/text.json").bufferedReader().use { it.readText() } } catch (e: Exception) { null })
    }

    private fun table(): JSONObject {
        root?.let { return it }
        // JVM unit tests: read the shared file straight from the repo.
        val dir = System.getProperty("castle.repoRoot") ?: "../../.."
        val f = File(dir, "content/text.json")
        install(if (f.isFile) f.readText() else null)
        return root ?: JSONObject()
    }

    /** The raw node at [key], or null. Note keys (`_x`) are never returned. */
    fun node(key: String): Any? {
        var cur: Any? = table()
        for (part in key.split('.')) {
            if (part.startsWith("_")) return null
            cur = (cur as? JSONObject)?.opt(part) ?: return null
        }
        return if (cur == JSONObject.NULL) null else cur
    }

    /** True when [key] holds a line, a pool or a plural pair. */
    fun has(key: String): Boolean = when (val n = node(key)) {
        is String -> true
        is JSONArray -> n.length() > 0
        is JSONObject -> n.has("other") || n.has("one")
        else -> false
    }

    /** The line at [key] with its placeholders filled. A pool gives one line at random. Missing: the key. */
    fun t(key: String, vararg args: Pair<String, Any?>): String = opt(key, *args) ?: key

    /** Like [t], but null when the key is missing. An empty string in the table stays empty. */
    fun opt(key: String, vararg args: Pair<String, Any?>): String? {
        val raw = when (val n = node(key)) {
            is String -> n
            is JSONArray -> pickFrom(key, n)
            is JSONObject -> n.optString("other").takeIf { n.has("other") }
            else -> null
        } ?: return null
        return fill(raw, args)
    }

    /** A plural line: `key.one` when [n] is 1, else `key.other`. `{n}` is filled for you. */
    fun plural(key: String, n: Int, vararg args: Pair<String, Any?>): String {
        val all = arrayOf("n" to n, *args)
        return opt("$key.${if (n == 1) "one" else "other"}", *all) ?: opt(key, *all) ?: key
    }

    /** An id from the core under [group]: `group.id`, else `group.default`, else the id in plain words. */
    fun byId(group: String, id: String?, vararg args: Pair<String, Any?>): String {
        if (!id.isNullOrEmpty()) opt("$group.$id", *args)?.let { return it }
        return opt("$group.default", *args) ?: id?.replace('_', ' ') ?: ""
    }

    /** Every line of a pool (or the one line) at [key], unfilled. */
    fun list(key: String): List<String> = when (val n = node(key)) {
        is String -> listOf(n)
        is JSONArray -> (0 until n.length()).map { n.optString(it) }.filter { it.isNotEmpty() }
        else -> emptyList()
    }

    /** Child keys of a group, notes left out. */
    fun keys(key: String): List<String> = (node(key) as? JSONObject)?.keys()?.asSequence()?.filter { !it.startsWith("_") }?.toList() ?: emptyList()

    /** Swaps each `{word}` for its value. Unknown placeholders stay as they are. */
    fun fill(line: String, args: Array<out Pair<String, Any?>>): String {
        if (args.isEmpty() || line.indexOf('{') < 0) return line
        var out = line
        for ((k, v) in args) out = out.replace("{$k}", v?.toString() ?: "")
        return out
    }

    /** One line from a pool at random, never the one shown last time for this key. */
    fun pickFrom(key: String, pool: JSONArray): String? {
        val n = pool.length()
        if (n == 0) return null
        var i = rnd.nextInt(n)
        if (n > 1 && lastPick[key] == i) i = (i + 1) % n
        lastPick[key] = i
        return pool.optString(i)
    }

    /** A random line from [lines] for [key], with no repeat of the last one. */
    fun pickFrom(key: String, lines: List<String>): String? {
        if (lines.isEmpty()) return null
        var i = rnd.nextInt(lines.size)
        if (lines.size > 1 && lastPick[key] == i) i = (i + 1) % lines.size
        lastPick[key] = i
        return lines[i]
    }
}
