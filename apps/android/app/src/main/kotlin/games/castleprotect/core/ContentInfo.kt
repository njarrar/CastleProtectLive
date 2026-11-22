package games.castleprotect.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Names and texts for menus, read from the shared content/ folder (copied into the
 * APK at build time). Read-only data: the core has the same content built in and
 * owns every rule that uses it. Loaded once, off the main thread.
 */
class ContentInfo(
    val levels: List<LevelInfo>,
    private val shotNames: Map<String, String>,
    private val shotCards: Map<String, String>,
    private val hobNames: Map<String, String>,
    /** Trail look per shot id: blast, pierce, dig, fire or mend (from the shot's flight and damage type). */
    private val trails: Map<String, String> = emptyMap(),
) {
    fun trail(id: String): String = trails[id] ?: "blast"
    fun level(id: String): LevelInfo? = levels.firstOrNull { it.id == id }
    fun shotName(id: String): String = shotNames[id] ?: id.split('_').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }
    fun shotCard(id: String): String = shotCards[id] ?: ""
    fun hobName(id: String): String = hobNames[id] ?: shotName(id)

    val campaign: List<LevelInfo> get() = levels.filter { it.id.startsWith("1-") }.sortedBy { it.id.substringAfter('-').toIntOrNull() ?: 0 }
    val duelMaps: List<LevelInfo> get() = levels.filter { it.id.startsWith("d") }.sortedBy { it.id }

    companion object {
        val EMPTY = ContentInfo(emptyList(), emptyMap(), emptyMap(), emptyMap())

        /** The trail group of one shot from content/shots.json. */
        fun trailOf(o: JSONObject): String {
            val id = o.optString("id")
            val flight = o.optJSONObject("flight")?.optString("kind") ?: "arc"
            val text = o.toString()
            return when {
                flight == "dig" -> "dig"
                flight == "beam" || text.contains("\"dtype\":\"pierce\"") -> "pierce"
                id.startsWith("mend") || flight == "self" || text.contains("\"op\":\"mend") -> "mend"
                text.contains("\"dtype\":\"fire\"") -> "fire"
                else -> "blast"
            }
        }

        /** [read] returns a file's text by path under content/, or null. [list] lists content/levels. */
        fun load(read: (String) -> String?, list: () -> List<String>): ContentInfo = try {
            val levels = list().filter { it.endsWith(".json") }.mapNotNull { f -> read("levels/$f")?.let { LevelInfo.parse(JSONObject(it)) } }
            val names = HashMap<String, String>(); val cards = HashMap<String, String>(); val trails = HashMap<String, String>()
            read("shots.json")?.let { t -> val a = JSONArray(t); for (i in 0 until a.length()) a.optJSONObject(i)?.let { names[it.optString("id")] = it.optString("name"); cards[it.optString("id")] = it.optString("card"); trails[it.optString("id")] = trailOf(it) } }
            read("doodads.json")?.let { t -> runCatching { val a = JSONArray(t); for (i in 0 until a.length()) a.optJSONObject(i)?.let { names[it.optString("id")] = it.optString("name") } } }
            val hobs = HashMap<String, String>()
            read("hobs.json")?.let { t -> val a = JSONArray(t); for (i in 0 until a.length()) a.optJSONObject(i)?.let { hobs[it.optString("id")] = it.optString("name") } }
            ContentInfo(levels, names, cards, hobs, trails)
        } catch (e: Exception) { EMPTY }

        fun fromAssets(assets: android.content.res.AssetManager): ContentInfo = load(
            read = { p -> try { assets.open("content/$p").bufferedReader().use { it.readText() } } catch (e: Exception) { null } },
            list = { try { assets.list("content/levels")?.toList() ?: emptyList() } catch (e: Exception) { emptyList() } },
        )
    }
}

/** One level as the menus show it (content/levels/<id>.json). */
data class LevelInfo(
    val id: String, val name: String, val type: String, val roundCap: Int,
    val windMin: Int, val windMax: Int, val rival: String, val rivalAim: Int, val habit: String,
    val rivalCrew: List<String>, val pennants: List<String>, val note: String, val rummage: Boolean,
) {
    val windText: String get() = if (windMax == 0) "No wind" else "Wind $windMin to $windMax"

    companion object {
        fun parse(o: JSONObject): LevelInfo {
            val rival = o.optJSONObject("rival") ?: JSONObject()
            val rules = o.optJSONObject("rules") ?: JSONObject()
            val wind = rules.optJSONObject("wind") ?: JSONObject()
            val crew = rival.optJSONArray("crew") ?: JSONArray()
            val pen = o.optJSONArray("pennants") ?: JSONArray()
            val rum = rules.optJSONObject("rummage")
            return LevelInfo(
                o.optString("id"), o.optString("name"), o.optString("type", "siege"), rules.optInt("round_cap", 15),
                wind.optInt("min", 0), wind.optInt("max", 0), rival.optString("name", "Rival"), rival.optInt("aim", 1),
                rival.optString("habit"), (0 until crew.length()).map { crew.optString(it) },
                (0 until pen.length()).mapNotNull { pen.optJSONObject(it)?.optString("text") }, o.optString("new_thing"),
                (rum?.optInt("pool", 0) ?: 0) > 0,
            )
        }
    }
}
