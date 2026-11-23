package games.castleprotect.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Shared app/content rules read from content/app.json (Android-H4, Android-L6).
 * Read-only data: the core owns every rule; menus and setups use these numbers so
 * wind presets, Workshop dims, campaign unlocks, and AI think timing never drift.
 */
data class AppConfig(
    val doodadsFrom: String = "1-10",
    val campaignDoodads: List<String> = listOf("mend_bucket", "pot_lid"),
    val modesAfter: String = "1-5",
    val windOff: Pair<Int, Int> = 0 to 0,
    val windLight: Pair<Int, Int> = 0 to 3,
    val windFull: Pair<Int, Int> = 0 to 6,
    val workshopCols: Int = 8,
    /** Buildable rows above Footing (`workshop.rows - 1`). */
    val workshopRows: Int = 9,
    val workshopMaxNooks: Int = 5,
    val workshopBudget: Int = 72,
    val rivalThinkMs: Long = 1000L,
    val joins: Map<String, String> = emptyMap(),
) {
    /** Wind range (min..max) for Skirmish/Couch preset index: 0 off, 1 light, 2 full. */
    fun windRange(preset: Int): Pair<Int, Int> = when (preset) {
        0 -> windOff
        2 -> windFull
        else -> windLight
    }

    /** True when campaign level [id] is at or after [from] (e.g. "1-10" >= "1-10"). */
    fun levelAtLeast(id: String, from: String): Boolean {
        val a = parseLevel(id) ?: return false
        val b = parseLevel(from) ?: return false
        return a.first > b.first || (a.first == b.first && a.second >= b.second)
    }

    companion object {
        private fun parseLevel(id: String): Pair<Int, Int>? {
            val parts = id.split('-')
            if (parts.size != 2) return null
            val r = parts[0].toIntOrNull() ?: return null
            val n = parts[1].toIntOrNull() ?: return null
            return r to n
        }

        private fun range(o: JSONObject?, def: Pair<Int, Int>): Pair<Int, Int> =
            if (o == null) def else o.optInt("min", def.first) to o.optInt("max", def.second)

        fun parse(o: JSONObject): AppConfig {
            val camp = o.optJSONObject("campaign")
            val dd = camp?.optJSONArray("doodads")?.let { a -> (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() } }
            val wp = o.optJSONObject("wind_presets")
            val ws = o.optJSONObject("workshop")
            val joins = HashMap<String, String>()
            o.optJSONObject("joins")?.let { j -> for (k in j.keys()) joins[k] = j.optString(k) }
            val thinkS = o.optDouble("rival_think_seconds", 1.0)
            val totalRows = ws?.optInt("rows", 10) ?: 10
            return AppConfig(
                doodadsFrom = camp?.optString("doodads_from", "1-10")?.ifEmpty { "1-10" } ?: "1-10",
                campaignDoodads = if (dd != null && dd.isNotEmpty()) dd else listOf("mend_bucket", "pot_lid"),
                modesAfter = camp?.optString("modes_after", "1-5")?.ifEmpty { "1-5" } ?: "1-5",
                windOff = range(wp?.optJSONObject("off"), 0 to 0),
                windLight = range(wp?.optJSONObject("light"), 0 to 3),
                windFull = range(wp?.optJSONObject("full"), 0 to 6),
                workshopCols = (ws?.optInt("cols", 8) ?: 8).coerceAtLeast(1),
                workshopRows = (totalRows - 1).coerceAtLeast(1),
                workshopMaxNooks = (ws?.optInt("max_nooks", 5) ?: 5).coerceIn(1, 5),
                workshopBudget = (ws?.optInt("budget", 72) ?: 72).coerceAtLeast(1),
                rivalThinkMs = (thinkS * 1000.0).toLong().coerceAtLeast(100L),
                joins = joins,
            )
        }
    }
}

/** Read-only shot display card metadata parsed from content/shots.json for the Shell Inspect Card. */
data class ShotDetail(
    val id: String,
    val name: String,
    val kind: String,
    val weight: String,
    val matchClass: String,
    val card: String,
    val flightKind: String,
    val damage: Int,
    val dtype: String,
    val band: String,
    val tunnelCells: Int,
    val splitCount: Int,
    val bounces: Int,
    val mendHp: Int,
    val dud: Boolean,
    val tags: List<String>,
) {
    /** Weight in words, from content/text.json `shell_card.weight`. */
    val weightLabel: String get() = Text.t("shell_card.weight." + when (weight.uppercase()) { "H" -> "heavy"; "M" -> "medium"; else -> "light" })
    /** Display Rest Cogs count corresponding to weight (L -> 0, M -> 1, H -> 2). */
    val restCogs: Int get() = when (weight.uppercase()) {
        "H" -> 2; "M" -> 1; else -> 0
    }
    /** "No Rest", "Rest 1 turn", "Rest 2 turns" (`shell_card.rest`). */
    val restLabel: String get() = if (restCogs == 0) Text.t("shell_card.rest.none") else Text.plural("shell_card.rest", restCogs)
    /** The "Good at" line from `shots.<id>.good_at`, or empty. */
    val goodAt: String get() = Text.opt("shots.$id.good_at")?.takeIf { it.isNotEmpty() }?.let { Text.t("shell_card.good_at", "what" to it) } ?: ""
    /** Damage type in words (`shell_card.damage_types`). */
    val dtypeLabel: String get() = Text.t("shell_card.damage_types." + when {
        mendHp > 0 -> "mend"
        flightKind == "dig" && damage > 0 -> "dig"
        dtype == "pierce" -> "pierce"
        dtype == "fire" -> "fire"
        else -> "blast"
    })
}

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
    private val doodadCards: Map<String, String> = emptyMap(),
    private val shotDials: Map<String, List<String>> = emptyMap(),
    private val shotSelfTargets: Set<String> = emptySet(),
    private val blueprints: Map<String, List<String>> = emptyMap(),
    val app: AppConfig = AppConfig(),
    private val shotDetails: Map<String, ShotDetail> = emptyMap(),
    private val classHobs: Map<String, Pair<String, String>> = emptyMap(),
    val playerRoster: List<Pair<String, String>> = emptyList(),
    /** Class display names from content/classes.json (delver -> Digger). */
    private val classNames: Map<String, String> = emptyMap(),
) {
    fun trail(id: String): String = trails[id] ?: "blast"
    fun level(id: String): LevelInfo? = levels.firstOrNull { it.id == id }
    fun shotName(id: String): String = shotNames[id] ?: id.split('_').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }
    fun shotCard(id: String): String = shotCards[id] ?: ""
    fun shotDetail(id: String): ShotDetail? = shotDetails[id]
    fun doodadCard(id: String): String = doodadCards[id] ?: ""
    fun shotDials(id: String): List<String> = shotDials[id] ?: emptyList()
    fun hasSelfTarget(id: String): Boolean = id in shotSelfTargets
    fun blueprint(id: String): List<String>? = blueprints[id]
    /** A Hob's full name from content/hobs.json. */
    fun hobName(id: String): String = hobNames[id] ?: shotName(id)
    /** A Hob's short name for chips, banners and spoken lines: `hobs.<id>.short` in the string table. Never cut at a space. */
    fun hobShort(id: String): String = Names.hobShort(id, hobNames[id])
    /** A class's display name from content/classes.json ("delver" -> "Digger"), or empty for none or "all". */
    fun className(cls: String): String = when (cls.lowercase()) { "", "all" -> ""; else -> classNames[cls.lowercase()] ?: cls.replaceFirstChar { it.uppercase() } }
    /** First playable Hob (id to display name) for a class (e.g. "delver" -> "grub" to "Grub Mudgett"). */
    fun hobForClass(cls: String): Pair<String, String>? = classHobs[cls.lowercase()]

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

        private fun parseShotDetail(o: JSONObject, rawById: Map<String, JSONObject>): ShotDetail {
            val id = o.optString("id")
            val name = o.optString("name", id)
            val kind = o.optString("kind", "trick")
            val weight = o.optString("weight", "L")
            val matchClass = o.optString("match_class", "")
            val card = o.optString("card", "")
            val dud = o.optBoolean("dud", false)
            val flight = o.optJSONObject("flight")
            val flightKind = flight?.optString("kind", "arc") ?: "arc"
            val tunnelCells = flight?.optInt("max_cells", 0) ?: 0
            val bounces = flight?.optInt("bounces", 0) ?: 0
            var damage = flight?.optInt("block_dmg", 0) ?: 0
            var dtype = if (flightKind == "dig" && damage > 0) "dig" else if (flightKind == "beam") "pierce" else "blast"
            var band = ""
            var splitCount = 0
            var childRef = ""
            var mendHp = 0
            fun scanOps(arr: JSONArray?) {
                if (arr == null) return
                for (j in 0 until arr.length()) {
                    val opObj = arr.optJSONObject(j) ?: continue
                    when (opObj.optString("op")) {
                        "explode", "column" -> {
                            val d = opObj.optInt("dmg", 0)
                            if (d > damage) {
                                damage = d
                                dtype = opObj.optString("dtype", dtype).ifEmpty { dtype }
                                band = opObj.optString("band", band).ifEmpty { band }
                            }
                        }
                        "split" -> {
                            splitCount = maxOf(splitCount, opObj.optInt("count", 0))
                            if (childRef.isEmpty()) childRef = opObj.optString("child", "")
                        }
                        "become_prop" -> {
                            if (childRef.isEmpty()) childRef = opObj.optString("shot", "")
                        }
                        "mend" -> mendHp = maxOf(mendHp, opObj.optInt("hp", 0))
                        "rebuild" -> mendHp = maxOf(mendHp, opObj.optInt("hp_pct", 0))
                    }
                }
            }
            val triggers = o.optJSONArray("triggers")
            if (triggers != null) {
                for (i in 0 until triggers.length()) {
                    scanOps(triggers.optJSONObject(i)?.optJSONArray("do"))
                }
            }
            scanOps(o.optJSONArray("self_effects"))
            if (damage == 0 && childRef.isNotEmpty()) {
                val childObj = rawById[childRef]
                val cTriggers = childObj?.optJSONArray("triggers")
                if (cTriggers != null) {
                    for (i in 0 until cTriggers.length()) {
                        val cDo = cTriggers.optJSONObject(i)?.optJSONArray("do") ?: continue
                        for (j in 0 until cDo.length()) {
                            val opObj = cDo.optJSONObject(j) ?: continue
                            if (opObj.optString("op") == "explode") {
                                val d = opObj.optInt("dmg", 0)
                                if (d > damage) {
                                    damage = d
                                    dtype = opObj.optString("dtype", dtype).ifEmpty { dtype }
                                    band = opObj.optString("band", band).ifEmpty { band }
                                }
                            }
                        }
                    }
                }
            }
            val tagsArr = o.optJSONArray("tags")
            val tags = if (tagsArr != null) (0 until tagsArr.length()).map { tagsArr.optString(it) }.filter { it.isNotEmpty() } else emptyList()
            return ShotDetail(id, name, kind, weight, matchClass, card, flightKind, damage, dtype, band, tunnelCells, splitCount, bounces, mendHp, dud, tags)
        }

        /** [read] returns a file's text by path under content/, or null. [list] lists content/levels. */
        fun load(read: (String) -> String?, list: () -> List<String>): ContentInfo = try {
            val levels = list().filter { it.endsWith(".json") }.mapNotNull { f -> read("levels/$f")?.let { LevelInfo.parse(JSONObject(it)) } }
            val names = HashMap<String, String>(); val cards = HashMap<String, String>(); val trails = HashMap<String, String>()
            val dials = HashMap<String, List<String>>(); val selfTargets = HashSet<String>()
            val details = HashMap<String, ShotDetail>()
            read("shots.json")?.let { t ->
                val a = JSONArray(t)
                val rawById = HashMap<String, JSONObject>()
                for (i in 0 until a.length()) a.optJSONObject(i)?.let { o ->
                    val id = o.optString("id")
                    if (id.isNotEmpty()) rawById[id] = o
                    names[id] = o.optString("name"); cards[id] = o.optString("card"); trails[id] = trailOf(o)
                    o.optJSONArray("dials")?.let { d -> if (d.length() > 0) dials[id] = (0 until d.length()).map { d.optString(it) }.filter { it.isNotEmpty() } }
                    o.optJSONArray("self_effects")?.let { se -> if (se.length() > 0) selfTargets.add(id) }
                }
                for (i in 0 until a.length()) a.optJSONObject(i)?.let { o ->
                    val id = o.optString("id")
                    if (id.isNotEmpty()) details[id] = parseShotDetail(o, rawById)
                }
            }
            val dCards = HashMap<String, String>()
            read("doodads.json")?.let { t ->
                runCatching {
                    val a = JSONArray(t)
                    for (i in 0 until a.length()) a.optJSONObject(i)?.let { o ->
                        val id = o.optString("id")
                        names[id] = o.optString("name")
                        dCards[id] = o.optString("card")
                    }
                }
            }
            val hobs = HashMap<String, String>()
            val classHobs = HashMap<String, Pair<String, String>>()
            val roster = ArrayList<Pair<String, String>>()
            read("hobs.json")?.let { t ->
                val a = JSONArray(t)
                for (i in 0 until a.length()) a.optJSONObject(i)?.let { o ->
                    val id = o.optString("id")
                    val name = o.optString("name")
                    hobs[id] = name
                    if (o.optBoolean("player", false)) {
                        roster.add(id to Names.hobShort(id, name))
                        val cls = o.optString("class").lowercase()
                        if (cls.isNotEmpty() && cls !in classHobs) classHobs[cls] = id to name
                    }
                }
            }
            val bps = HashMap<String, List<String>>()
            read("blueprints.json")?.let { t ->
                runCatching {
                    val a = JSONArray(t)
                    for (i in 0 until a.length()) a.optJSONObject(i)?.let { o ->
                        val id = o.optString("id")
                        val rows = o.optJSONArray("rows")?.let { r -> (0 until r.length()).map { r.optString(it) } }
                        if (id.isNotEmpty() && !rows.isNullOrEmpty()) bps[id] = rows
                    }
                }
            }
            val app = read("app.json")?.let { runCatching { AppConfig.parse(JSONObject(it)) }.getOrNull() } ?: AppConfig()
            val classNames = HashMap<String, String>()
            read("classes.json")?.let { t ->
                runCatching {
                    val a = JSONArray(t)
                    for (i in 0 until a.length()) a.optJSONObject(i)?.let { o -> classNames[o.optString("id").lowercase()] = o.optString("name") }
                }
            }
            ContentInfo(levels, names, cards, hobs, trails, dCards, dials, selfTargets, bps, app, details, classHobs, roster, classNames)
        } catch (e: Exception) { EMPTY }

        fun fromAssets(assets: android.content.res.AssetManager): ContentInfo = load(
            read = { p -> try { assets.open("content/$p").bufferedReader().use { it.readText() } } catch (e: Exception) { null } },
            list = { try { assets.list("content/levels")?.toList() ?: emptyList() } catch (e: Exception) { emptyList() } },
        )
    }
}

/** One Pennant goal in a level file: its type, value and the level file's own words. */
data class PennantInfo(val type: String, val value: Int, val text: String)

/** One named Rival a Skirmish map can pick by seed (`rival.roster`). */
data class RosterRival(val name: String, val thinkMs: Int)

/** One level as the menus show it (content/levels/<id>.json). */
data class LevelInfo(
    val id: String, val name: String, val type: String, val roundCap: Int,
    val windMin: Int, val windMax: Int,
    /** The Rival's display name from the level file, or empty (Skirmish maps pick one from [roster]). */
    val rival: String, val rivalAim: Int, val habit: String,
    val rivalCrew: List<String>, val goals: List<PennantInfo>, val note: String, val rummage: Boolean,
    val playerCrew: List<String> = emptyList(), val crewSize: Int = 0, val playerBlueprint: String = "",
    /** `rival.think_ms`, or 0 when the level has none. */
    val thinkMs: Int = 0,
    val roster: List<RosterRival> = emptyList(),
) {
    /** Goal wording for each Pennant (content/text.md "Goals"). */
    val pennants: List<String> get() = goals.map { Names.goal(id, it) }
    /** "No wind", "Wind 3", "Wind 0 to 6" (`level_card.wind_*`). */
    val windText: String get() = when {
        windMax == 0 -> Text.t("level_card.wind_none")
        windMin == windMax -> Text.t("level_card.wind_one", "n" to windMax)
        else -> Text.t("level_card.wind_range", "min" to windMin, "max" to windMax)
    }
    /** Effective seat count for the player's default fort on this level. */
    val defaultSeats: Int get() = if (crewSize > 0) crewSize else playerCrew.size.coerceIn(1, 5)

    /** The Rival a fight with [seed] meets before it starts: the level's own, or `roster[seed % size]` (Skirmish). */
    fun rivalFor(seed: Long): RosterRival? {
        if (rival.isNotEmpty()) return RosterRival(rival, thinkMs)
        if (roster.isEmpty()) return null
        return roster[Math.floorMod(seed, roster.size.toLong()).toInt()]
    }

    companion object {
        fun parse(o: JSONObject): LevelInfo {
            val player = o.optJSONObject("player") ?: JSONObject()
            val pCrew = player.optJSONArray("crew") ?: JSONArray()
            val rival = o.optJSONObject("rival") ?: JSONObject()
            val rules = o.optJSONObject("rules") ?: JSONObject()
            val wind = rules.optJSONObject("wind") ?: JSONObject()
            val crew = rival.optJSONArray("crew") ?: JSONArray()
            val pen = o.optJSONArray("pennants") ?: JSONArray()
            val rum = rules.optJSONObject("rummage")
            val ros = rival.optJSONArray("roster") ?: JSONArray()
            return LevelInfo(
                o.optString("id"), o.optString("name"), o.optString("type", "siege"), rules.optInt("round_cap", 15),
                wind.optInt("min", 0), wind.optInt("max", 0), rival.optString("name", ""), rival.optInt("aim", 1),
                rival.optString("habit"), (0 until crew.length()).map { crew.optString(it) },
                (0 until pen.length()).mapNotNull { pen.optJSONObject(it)?.let { p -> PennantInfo(p.optString("type"), p.optInt("value", 0), p.optString("text")) } },
                o.optString("new_thing"),
                (rum?.optInt("pool", 0) ?: 0) > 0,
                (0 until pCrew.length()).map { pCrew.optString(it) }.filter { it.isNotEmpty() },
                player.optInt("crew_size", 0),
                player.optString("blueprint"),
                rival.optInt("think_ms", 0),
                (0 until ros.length()).mapNotNull { ros.optJSONObject(it)?.let { r -> RosterRival(r.optString("name"), r.optInt("think_ms", 0)) } }.filter { it.name.isNotEmpty() },
            )
        }
    }
}
